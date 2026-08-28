#!/usr/bin/env python3
"""One-shot import of 2025 Google Form MO performance reports into Firestore.

Joins form rows to Auth users by email (with roster name fallback). Skips HS and
7s/tournament rows. Does not link to schedule matches. Idempotent doc ids.

Usage:
  python3 scripts/import-2025-match-reports.py           # dry-run
  python3 scripts/import-2025-match-reports.py --write   # PATCH Firestore
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
FORM_CSV = ROOT / "docs/2025MatchReports.csv"
ALIASES_CSV = ROOT / "docs/2025-team-aliases.csv"
ROSTER_CSV = ROOT / "docs/2025RefereeEmails.csv"
AUTH_EXPORT = Path("/tmp/mrtx-auth-users.json")
FIREBASE_TOOLS = Path.home() / ".config/configstore/firebase-tools.json"
PROJECT = "matchreadytx"
ORG_ID = "lonestar"
TZ = ZoneInfo("America/Chicago")

FB_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
FB_CLIENT_SECRET = "5Fsf9ZtajJ4_MKc3jDWbCEIP"

BREAKDOWN_OPTIONS = {
    "tackler not rolling": "Tackler Not Rolling",
    "tackler not releasing": "Tackler Not Releasing",
    "ball carrier not releasing": "Ball Carrier Not Releasing",
    "ball carrier not realsing": "Ball Carrier Not Releasing",
    "defense off feet": "Defense Off Feet",
    "attack off feet": "Attack Off Feet",
}

EMAIL_ALIASES = {
    "joshcop1234@yahoo.com": "2crvcb24rv@privaterelay.appleid.com",
    "rugbydude34@hotmail.com": "jonocooper1997@outlook.com",
    "jackson4143@outlook.com": "jacksonedaniel4143@gmail.com",
}

HS_DIVISION = re.compile(r"high school|^hs\b|hs vc|hs d", re.I)


def firestore_value(v):
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int) and not isinstance(v, bool):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, list):
        if not v:
            return {"arrayValue": {}}
        return {"arrayValue": {"values": [firestore_value(x) for x in v]}}
    if isinstance(v, dict):
        fields = {
            k: firestore_value(val) for k, val in v.items() if val is not None
        }
        return {"mapValue": {"fields": fields}}
    raise TypeError(type(v))


def doc_fields(obj: dict) -> dict:
    return {k: firestore_value(v) for k, v in obj.items() if v is not None}


def chicago_iso(dt: datetime) -> str:
    return (
        dt.replace(tzinfo=TZ)
        .astimezone(ZoneInfo("UTC"))
        .strftime("%Y-%m-%dT%H:%M:%S.000Z")
    )


def parse_date_noon(date_s: str) -> str:
    d = datetime.strptime(date_s.strip(), "%m/%d/%Y")
    return chicago_iso(d.replace(hour=12, minute=0, second=0))


def parse_timestamp(ts: str) -> str:
    d = datetime.strptime(ts.strip(), "%m/%d/%Y %H:%M:%S")
    return chicago_iso(d)


def parse_scale(raw: str) -> int | None:
    text = (raw or "").strip()
    if text in {"1", "2", "3", "4", "5"}:
        return int(text)
    return None


def parse_format(raw: str) -> str | None:
    text = (raw or "").strip().lower()
    if text in {"7s", "10s", "15s"}:
        return text
    return None


def parse_score(raw: str) -> int | None:
    text = (raw or "").strip().upper()
    if text in {"", "NA", "N/A"}:
        return None
    if re.match(r"^-?\d+$", text):
        return int(text)
    return None


def parse_breakdown(raw: str) -> list[str]:
    out: list[str] = []
    for part in re.split(r",\s*", (raw or "").strip()):
        key = part.strip().lower()
        if not key:
            continue
        mapped = BREAKDOWN_OPTIONS.get(key)
        if mapped and mapped not in out:
            out.append(mapped)
    return out


def match_id(date_s: str, home: str, away: str, email: str) -> str:
    raw = "|".join(
        [
            date_s.strip().lower(),
            home.strip().lower(),
            away.strip().lower(),
            email.strip().lower(),
        ]
    )
    return "legacy_mo_" + hashlib.sha1(raw.encode()).hexdigest()[:12]


def report_doc_id(match_id_s: str, official_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", f"{match_id_s}_{official_id}_mo")[:120]


def load_aliases() -> dict[str, dict]:
    aliases: dict[str, dict] = {}
    with ALIASES_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            aliases[row["sheet_team"]] = row
    return aliases


def load_roster_emails() -> dict[str, str]:
    by_name: dict[str, str] = {}
    with ROSTER_CSV.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = (row.get("Full Name") or "").strip().lower()
            email = (row.get("Email") or "").strip()
            if name and email:
                by_name[name] = email
    return by_name


def load_auth() -> tuple[dict[str, dict], dict[str, dict]]:
    data = json.loads(AUTH_EXPORT.read_text())
    by_email = {
        u["email"].strip().lower(): u
        for u in data.get("users", [])
        if u.get("email")
    }
    by_name: dict[str, dict] = {}
    for u in data.get("users", []):
        key = re.sub(r"[^a-z]+", " ", (u.get("displayName") or "").lower()).strip()
        if key and key not in by_name:
            by_name[key] = u
    return by_email, by_name


def lookup_user(
    by_email: dict,
    by_name: dict,
    email: str,
    referee_name: str,
    roster_by_name: dict[str, str],
):
    e = (email or "").strip().lower()
    if not e:
        key = referee_name.strip().lower()
        e = (roster_by_name.get(key) or "").strip().lower()
    e = EMAIL_ALIASES.get(e, e)
    u = by_email.get(e)
    if not u:
        key = re.sub(r"[^a-z]+", " ", referee_name.lower()).strip()
        u = by_name.get(key)
        if not u and key in roster_by_name:
            e2 = roster_by_name[key].strip().lower()
            u = by_email.get(EMAIL_ALIASES.get(e2, e2))
    if not u:
        return None
    used = (u.get("email") or e).strip().lower()
    return u["localId"], u.get("displayName") or referee_name, used


def should_skip(row: dict) -> str | None:
    div = (row.get("Division") or "").strip()
    fmt = (row.get("Format") or "").strip().lower()
    away = (row.get("AWAY Team") or "").strip()
    if HS_DIVISION.search(div):
        return "high school"
    if fmt == "7s" or "," in away:
        return "7s/tournament"
    return None


def apply_row_fixes(row: dict) -> dict:
    """Manual corrections agreed during data cleanup."""
    out = dict(row)
    ref = (out.get("Referee Name") or "").strip().lower()
    date = (out.get("Date of Match") or "").strip()

    # Brad DuLong — shifted columns; SNU won 128-0
    if "dulong" in ref and date.startswith("9/13/2035"):
        out["Date of Match"] = "9/13/2025"
        out["HOME Team"] = "University of Oklahoma"
        out["HOME Points"] = "0"
        out["AWAY Team"] = "Southern Nazarene University"
        out["AWAY Points"] = "128"

    # Christopher Pugh — away team/score misplaced
    if ref == "christopher pugh" and date == "10/4/2025":
        out["AWAY Team"] = "University of Dallas"
        out["AWAY Points"] = "0"

    return out


def resolve_team(
    raw: str,
    aliases: dict[str, dict],
    division: str,
) -> tuple[str, str, str]:
    text = (raw or "").strip()
    alias = aliases.get(text)
    if not alias:
        raise KeyError(f"no alias for {text!r}")
    name = alias["canonical_name"]
    second = (alias.get("second_side") or "").strip().lower() == "yes"
    if not second and re.search(r"second side|2nd side", division, re.I):
        second = True
    label = f"{name} (2nd side)" if second else name
    return alias["canonical_abbrev"], label, alias.get("notes") or ""


def build_docs(by_email: dict, by_name: dict, roster_by_name: dict[str, str]):
    aliases = load_aliases()
    with FORM_CSV.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    ready: list[dict] = []
    skipped: list[dict] = []

    for idx, raw_row in enumerate(rows, start=2):
        row = apply_row_fixes(raw_row)
        skip = should_skip(row)
        if skip:
            skipped.append(
                {
                    "line": idx,
                    "referee": row.get("Referee Name"),
                    "date": row.get("Date of Match"),
                    "reason": skip,
                }
            )
            continue

        email = (row.get("Email Address") or "").strip()
        referee_name = (row.get("Referee Name") or "").strip()
        user = lookup_user(by_email, by_name, email, referee_name, roster_by_name)
        if not user:
            skipped.append(
                {
                    "line": idx,
                    "referee": referee_name,
                    "date": row.get("Date of Match"),
                    "reason": "no Firebase account",
                }
            )
            continue

        uid, display_name, used_email = user
        date_s = (row.get("Date of Match") or "").strip()
        division = (row.get("Division") or "").strip()
        home_raw = (row.get("HOME Team") or "").strip()
        away_raw = (row.get("AWAY Team") or "").strip()

        try:
            _, home_name, _ = resolve_team(home_raw, aliases, division)
            _, away_name, _ = resolve_team(away_raw, aliases, division)
        except KeyError as exc:
            skipped.append(
                {
                    "line": idx,
                    "referee": referee_name,
                    "date": date_s,
                    "reason": str(exc),
                }
            )
            continue

        home_pts = parse_score(row.get("HOME Points", ""))
        away_pts = parse_score(row.get("AWAY Points", ""))
        if home_pts is None or away_pts is None:
            skipped.append(
                {
                    "line": idx,
                    "referee": referee_name,
                    "date": date_s,
                    "reason": f"missing score: {row.get('HOME Points')!r} – {row.get('AWAY Points')!r}",
                }
            )
            continue

        mid = match_id(date_s, home_name, away_name, used_email)
        kickoff = parse_date_noon(date_s)
        submitted = parse_timestamp(row.get("Timestamp") or "")
        teams_text = f"{home_name} ({home_pts}) vs {away_name} ({away_pts})"
        fmt = parse_format(row.get("Format") or "") or "15s"
        crew_note = (row.get("Did you have a Referee Team? If so list those individuals.") or "").strip()

        mo_payload = {
            "homePoints": home_pts,
            "awayPoints": away_pts,
            "yellowCards": 0,
            "redCards": 0,
            "homeYellowCards": 0,
            "homeRedCards": 0,
            "awayYellowCards": 0,
            "awayRedCards": 0,
            "refereeName": referee_name or display_name,
            "matchDate": date_s,
            "format": fmt,
            "division": division,
            "homeTeamName": home_name,
            "awayTeamName": away_name,
            "refereeTeamNote": crew_note or None,
            "gameTemperature": parse_scale(row.get("Game temperature (1–5)", "")),
            "controlAndFlow": parse_scale(row.get("Control & flow (1–5)", "")),
            "todayIPerformed": (row.get("Today I performed…") or "").strip() or None,
            "typeOfMoment": (row.get("Type of moment") or "").strip() or None,
            "decidedAndWhy": (row.get("What did you decide and why?") or "").strip() or None,
            "breakdownRewards": parse_breakdown(
                row.get("Breakdown: What did you reward most? (checkboxes)", "")
            )
            or None,
            "setPieceChallenge": (row.get("Set piece: Biggest challenge today") or "").strip() or None,
            "advantageUse": parse_scale(row.get("Advantage use (1–5)", "")),
            "nonCardProblems": (
                row.get(
                    "Any problems from teams/players/coaches...that are not card reports...ENTER below",
                    "",
                )
                or ""
            ).strip()
            or None,
            "otherCommentsOrLink": (
                row.get(
                    "Any other comments? Also if there is a link to your game add it here PLEASE!",
                    "",
                )
                or ""
            ).strip()
            or None,
        }
        mo_payload = {k: v for k, v in mo_payload.items() if v is not None}

        doc = {
            "orgId": ORG_ID,
            "id": report_doc_id(mid, uid),
            "matchId": mid,
            "officialId": uid,
            "slot": "mo",
            "formKind": "mo_performance",
            "status": "submitted",
            "source": "legacy_form",
            "dueAt": kickoff,
            "kickoffAt": kickoff,
            "submittedAt": submitted,
            "createdAt": submitted,
            "updatedAt": submitted,
            "legacyFixture": {
                "teamsText": teams_text,
                "matchLevel": division,
                "homeTeamName": home_name,
                "awayTeamName": away_name,
                "homeScore": home_pts,
                "awayScore": away_pts,
            },
            "moPayload": mo_payload,
        }
        ready.append(
            {
                "doc": doc,
                "label": {
                    "line": idx,
                    "date": date_s,
                    "teams": teams_text,
                    "referee": referee_name,
                    "email": used_email,
                    "uid": uid,
                    "matchId": mid,
                    "docId": doc["id"],
                },
            }
        )

    return ready, skipped


def load_token() -> str:
    cfg = json.loads(FIREBASE_TOOLS.read_text())
    token = cfg.get("tokens", {}).get("access_token")
    if not token:
        sys.exit("No Firebase CLI access token. Run: firebase login")
    return token


def refresh_token() -> str:
    cfg = json.loads(FIREBASE_TOOLS.read_text())
    refresh = cfg["tokens"]["refresh_token"]
    body = urllib.parse.urlencode(
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh,
            "client_id": FB_CLIENT_ID,
            "client_secret": FB_CLIENT_SECRET,
        }
    ).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req) as resp:
        payload = json.loads(resp.read().decode())
    access = payload["access_token"]
    cfg["tokens"]["access_token"] = access
    FIREBASE_TOOLS.write_text(json.dumps(cfg, indent=2))
    return access


def http_json(method: str, url: str, token: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"error": {"message": raw[:400]}}
        return exc.code, payload


def write_docs(ready: list[dict], token: str) -> None:
    ok = fail = 0
    for item in ready:
        doc = item["doc"]
        url = (
            f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)"
            f"/documents/orgs/{ORG_ID}/matchReports/{doc['id']}"
        )
        status, body = http_json("PATCH", url, token, {"fields": doc_fields(doc)})
        if status == 401:
            token = refresh_token()
            status, body = http_json("PATCH", url, token, {"fields": doc_fields(doc)})
        if status == 200:
            ok += 1
            print(f"  wrote {item['label']['docId']}")
        else:
            fail += 1
            print(
                f"  FAIL {item['label']['docId']} {status} "
                f"{body.get('error', {}).get('message', '')[:240]}"
            )
    print(f"\nwrote {ok}  failed {fail}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    for path in (FORM_CSV, ALIASES_CSV, ROSTER_CSV):
        if not path.exists():
            sys.exit(f"Missing {path}")
    if args.write and not AUTH_EXPORT.exists():
        sys.exit(
            f"Missing {AUTH_EXPORT}. Export with: "
            f"firebase auth:export {AUTH_EXPORT} --project {PROJECT} --format json"
        )

    by_email, by_name = load_auth() if AUTH_EXPORT.exists() else ({}, {})
    roster_by_name = load_roster_emails()
    ready, skipped = build_docs(by_email, by_name, roster_by_name)

    print(f"importable {len(ready)}  skipped {len(skipped)}\n")
    print("=== IMPORT ===")
    for item in ready:
        lb = item["label"]
        print(
            f"  L{lb['line']:>2} {lb['date']}  {lb['teams'][:52]:<52}  "
            f"{lb['referee']} <{lb['email']}>"
        )
    if skipped:
        print("\n=== SKIPPED ===")
        for s in skipped:
            print(f"  L{s.get('line', '?')} {s.get('date', '')} {s.get('referee', '')}: {s['reason']}")

    if args.write:
        if not ready:
            sys.exit("Nothing to write.")
        token = load_token()
        write_docs(ready, token)
    else:
        print("\n(dry-run — pass --write to PATCH Firestore)")


if __name__ == "__main__":
    main()
