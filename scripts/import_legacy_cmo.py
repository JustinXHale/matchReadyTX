#!/usr/bin/env python3
"""One-shot import of 2025 Google Form CMO reports into orgs/lonestar/matchReports.

Joins form rows to Auth users by email. Imports when **either** MO or CMO has an
account (the other side is stored on legacyFixture for a later resync). Skips only
when neither has an account. Does not create schedule fixtures. Idempotent doc ids.

Usage:
  python3 scripts/import_legacy_cmo.py           # dry-run
  python3 scripts/import_legacy_cmo.py --write   # PATCH Firestore
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
FORM_CSV = ROOT / "docs/2025CMOreports"
PREVIEW_CSV = ROOT / "docs/2025CmoMatchPreview.csv"
AUTH_EXPORT = Path("/tmp/mrtx-auth-users.json")
FIREBASE_TOOLS = Path.home() / ".config/configstore/firebase-tools.json"
PROJECT = "matchreadytx"
ORG_ID = "lonestar"
TZ = ZoneInfo("America/Chicago")

# Public OAuth client shipped with firebase-tools (token refresh).
FB_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
FB_CLIENT_SECRET = "5Fsf9ZtajJ4_MKc3jDWbCEIP"

CMO_SCALE_KEYS = [
    "scrum",
    "breakdown",
    "advantage",
    "gameControl",
    "communication",
    "materiality",
    "positioning",
    "lineout",
    "fitness",
    "bigDecisions",
]
SCALE_COLS = {
    "scrum": (17, 18),
    "breakdown": (19, 20),
    "advantage": (21, 22),
    "gameControl": (23, 24),
    "communication": (25, 26),
    "materiality": (27, 28),
    "positioning": (29, 30),
    "lineout": (31, 32),
    "fitness": (33, 34),
    "bigDecisions": (35, 36),
}
COMPLEXITY_OPTIONS = [
    "Severe weather (wind, rain, etc...)",
    "scrums frequently unstable",
    "repeated foul play theme",
    "rivalry/high stakes",
    "short benches/injuries",
    "coach/crowd pressure",
    "travel squad/new players",
    "NO MAJOR FAVORS. GREAT DAY",
]
MATCH_KINDS = {"League Match", "Friendly", "Play-off", "Championship"}
UNLINKED_OFFICIAL_PREFIX = "legacy_unlinked_"

# Roster / form emails that are not the Auth login.
EMAIL_ALIASES = {
    "joshcop1234@yahoo.com": "2crvcb24rv@privaterelay.appleid.com",
    "mssheila93@hotmail.com": "adamssheila319@gmail.com",
    "jimbob_jones@hotmail.com": "d5fjgpb6ph@privaterelay.appleid.com",
}


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
        fields = {k: firestore_value(val) for k, val in v.items() if val is not None}
        return {"mapValue": {"fields": fields}}
    raise TypeError(type(v))


def doc_fields(obj: dict) -> dict:
    return {k: firestore_value(v) for k, v in obj.items() if v is not None}


def parse_assessed(raw: str) -> int | None:
    text = (raw or "").strip()
    if not text:
        return None
    m = re.match(r"^level\s+(\d{1,2})\b", text, re.I)
    n = int(m.group(1)) if m else (int(text) if text.isdigit() else None)
    if n is None or n < 1 or n > 10:
        return None
    return n


def parse_scale(raw: str):
    text = (raw or "").strip()
    if text in ("0", ""):
        return "na" if text == "0" else None
    if text in {"1", "2", "3", "4", "5"}:
        return int(text)
    return None


def parse_teams(teams: str) -> dict:
    text = (teams or "").strip()
    m = re.match(
        r"^(.+?)(?:\s*\((\d+)\))?\s+vs\.?\s+(.+?)(?:\s*\((\d+)\))?$",
        text,
        re.I,
    )
    if not m:
        return {
            "teamsText": text,
            "homeTeamName": text or "Home",
            "awayTeamName": "Away",
        }
    out = {
        "teamsText": text,
        "homeTeamName": m.group(1).strip() or "Home",
        "awayTeamName": m.group(3).strip() or "Away",
    }
    if m.group(2) is not None:
        out["homeScore"] = int(m.group(2))
    if m.group(4) is not None:
        out["awayScore"] = int(m.group(4))
    return out


def parse_complexity(raw: str) -> tuple[list[str], str | None]:
    parts = [p.strip() for p in (raw or "").split(",") if p.strip()]
    known = [p for p in parts if p in COMPLEXITY_OPTIONS]
    other = ", ".join(p for p in parts if p not in COMPLEXITY_OPTIONS)
    return known, (other or None)


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


def match_id(date_s: str, teams: str, ref_email: str, cmo_email: str) -> str:
    raw = "|".join(
        [
            date_s.strip().lower(),
            teams.strip().lower(),
            ref_email.strip().lower(),
            cmo_email.strip().lower(),
        ]
    )
    return "legacy_cmo_" + hashlib.sha1(raw.encode()).hexdigest()[:12]


def unlinked_official_id(match_id_s: str) -> str:
    return UNLINKED_OFFICIAL_PREFIX + hashlib.sha1(match_id_s.encode()).hexdigest()[:12]


def report_doc_id(match_id_s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", f"{match_id_s}_cmo")[:120]


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


def lookup(by_email: dict, by_name: dict, email: str, *name_hints: str):
    e = (email or "").strip().lower()
    e = EMAIL_ALIASES.get(e, e)
    u = by_email.get(e)
    if not u:
        for hint in name_hints:
            key = re.sub(r"[^a-z]+", " ", (hint or "").lower()).strip()
            if key:
                u = by_name.get(key)
                if u:
                    break
    if not u:
        return None
    used = (u.get("email") or e).strip().lower()
    return u["localId"], u.get("displayName") or used, used


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
    try:
        with urllib.request.urlopen(req) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        sys.exit(
            "Firebase CLI auth expired. Re-authenticate, then retry:\n"
            "  firebase login --reauth\n"
            f"(token refresh failed: HTTP {exc.code})"
        )
    access = payload["access_token"]
    cfg["tokens"]["access_token"] = access
    FIREBASE_TOOLS.write_text(json.dumps(cfg, indent=2))
    return access


def auth_token_or_exit() -> str:
    token = load_token()
    status, _ = http_json(
        "GET",
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/orgs/{ORG_ID}",
        token,
    )
    if status == 401:
        token = refresh_token()
    return token


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


def payload_from_row(row: list[str]) -> dict:
    scales = {}
    comments = {}
    for key, (si, ci) in SCALE_COLS.items():
        val = parse_scale(row[si] if si < len(row) else "")
        if val is not None:
            scales[key] = val
        comment = (row[ci] if ci < len(row) else "").strip()
        if comment:
            comments[key] = comment
    factors, other = parse_complexity(row[15] if len(row) > 15 else "")
    attend = (row[6] or "").strip().lower()
    video = (row[7] or "").strip()
    match_kind = (row[11] or "").strip()
    temp = parse_scale(row[13] if len(row) > 13 else "")
    balance = parse_scale(row[14] if len(row) > 14 else "")
    conf = parse_scale(row[42] if len(row) > 42 else "")
    cmo = {
        "scales": scales,
        "comments": comments,
        "playedLike": (row[12] or "").strip() or None,
        "matchKind": match_kind if match_kind in MATCH_KINDS else None,
        "gameTemperature": temp if isinstance(temp, int) else None,
        "contestBalance": balance if isinstance(balance, int) else None,
        "complexityFactors": factors or None,
        "complexityOther": other,
        "penaltyCount": (row[16] or "").strip() or None,
        "attendedInPerson": "yes"
        if attend == "yes"
        else ("no" if attend == "no" else None),
        "videoLink": video if video.lower().startswith("http") else None,
        "keep": (row[37] or "").strip() or None,
        "start": (row[38] or "").strip() or None,
        "stop": (row[39] or "").strip() or None,
        "overallComment": (row[40] or "").strip() or None,
        "assessedRating": parse_assessed(row[41] if len(row) > 41 else ""),
        "gradingConfidence": conf if isinstance(conf, int) else None,
        "gradingRationale": (row[43] or "").strip() or None,
    }
    return {k: v for k, v in cmo.items() if v is not None}


def build_docs(by_email: dict, by_name: dict) -> tuple[list[dict], list[dict]]:
    with FORM_CSV.open(newline="") as f:
        form_rows = list(csv.reader(f))[1:]
    with PREVIEW_CSV.open(newline="") as f:
        preview = list(csv.DictReader(f))
    if len(form_rows) != len(preview):
        sys.exit(f"Row count mismatch: form={len(form_rows)} preview={len(preview)}")

    ready = []
    skipped = []
    for form, prev in zip(form_rows, preview):
        date_s = form[9].strip()
        teams = form[10].strip()
        if date_s != prev["match_date"].strip() or teams != prev["teams"].strip():
            sys.exit(
                f"Preview/form mismatch: form {date_s} {teams!r} vs "
                f"{prev['match_date']} {prev['teams']!r}"
            )
        ref_email = prev["referee_email"]
        cmo_email = prev["cmo_email"]
        ref_names = (
            prev.get("referee_roster_name"),
            prev.get("referee_full_name"),
            prev.get("referee_form_name"),
            form[3],
        )
        cmo_names = (prev.get("cmo_name"), form[2])
        ref = lookup(by_email, by_name, ref_email, *ref_names)
        cmo = lookup(by_email, by_name, cmo_email, *cmo_names)
        ref_label = (
            prev.get("referee_roster_name")
            or prev.get("referee_form_name")
            or form[3]
        )
        cmo_label = prev.get("cmo_name") or form[2]
        label = {
            "date": date_s,
            "teams": teams,
            "referee": ref_label,
            "cmo": cmo_label,
            "referee_email": ref_email,
            "cmo_email": cmo_email,
        }
        if not ref and not cmo:
            skipped.append(
                {
                    **label,
                    "reason": "missing account: MO and CMO",
                }
            )
            continue

        ref_uid = ref[0] if ref else None
        ref_name = ref[1] if ref else ref_label
        ref_e = ref[2] if ref else (ref_email or "").strip().lower()
        cmo_uid = cmo[0] if cmo else None
        cmo_name = cmo[1] if cmo else cmo_label
        cmo_e = cmo[2] if cmo else (cmo_email or "").strip().lower()

        link = []
        if ref_uid and cmo_uid:
            link.append("both")
        elif ref_uid:
            link.append("MO-only")
        else:
            link.append("CMO-only")

        mid = match_id(date_s, teams, ref_e, cmo_e)
        kickoff = parse_date_noon(date_s)
        submitted = parse_timestamp(form[0])
        teams_fx = parse_teams(teams)
        teams_fx["matchLevel"] = (form[8] or "").strip() or None
        teams_fx["subjectOfficialName"] = ref_label or None
        teams_fx["subjectOfficialEmail"] = (ref_email or "").strip() or None
        teams_fx["cmoOfficialName"] = cmo_label or None
        teams_fx["cmoOfficialEmail"] = (cmo_email or "").strip() or None
        teams_fx = {k: v for k, v in teams_fx.items() if v}

        official_id = cmo_uid or unlinked_official_id(mid)
        doc = {
            "orgId": ORG_ID,
            "id": report_doc_id(mid),
            "matchId": mid,
            "officialId": official_id,
            "slot": "cmo",
            "formKind": "cmo",
            "status": "submitted",
            "source": "legacy_form",
            "dueAt": kickoff,
            "deadlineAt": kickoff,
            "kickoffAt": kickoff,
            "submittedAt": submitted,
            "createdAt": submitted,
            "updatedAt": submitted,
            "legacyFixture": teams_fx,
            "cmoPayload": payload_from_row(form),
        }
        if ref_uid:
            doc["subjectOfficialId"] = ref_uid
        ready.append(
            {
                "doc": doc,
                "label": {
                    **label,
                    "link": ",".join(link),
                    "referee_uid": ref_uid,
                    "cmo_uid": cmo_uid,
                    "referee_name": ref_name,
                    "cmo_name": cmo_name,
                    "matchId": mid,
                    "docId": doc["id"],
                    "assessed": doc["cmoPayload"].get("assessedRating"),
                },
            }
        )
    return ready, skipped


def delete_permcheck(token: str) -> str:
    """Best-effort removal of an old probe doc; never blocks import."""
    url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)"
        f"/documents/orgs/{ORG_ID}/matchReports?pageSize=100"
    )
    status, body = http_json("GET", url, token)
    if status == 401:
        try:
            token = refresh_token()
        except SystemExit:
            raise
        status, body = http_json("GET", url, token)
    if status != 200:
        print(
            "skip probe cleanup:",
            status,
            body.get("error", {}).get("message", "")[:200],
        )
        return token
    for doc in body.get("documents") or []:
        name = doc.get("name", "")
        if "legacy_cmo_permcheck_" in name:
            dstatus, _ = http_json(
                "DELETE", f"https://firestore.googleapis.com/v1/{name}", token
            )
            print(f"deleted probe doc {name.rsplit('/', 1)[-1]} status={dstatus}")
    return token


def write_docs(ready: list[dict], token: str) -> None:
    token = delete_permcheck(token)
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
    if not FORM_CSV.exists() or not PREVIEW_CSV.exists():
        sys.exit(f"Missing {FORM_CSV} or {PREVIEW_CSV}")
    if not AUTH_EXPORT.exists():
        sys.exit(f"Missing {AUTH_EXPORT}. Export with: firebase auth:export {AUTH_EXPORT} --project {PROJECT} --format json")
    by_email, by_name = load_auth()
    ready, skipped = build_docs(by_email, by_name)
    print(f"importable {len(ready)}  skipped {len(skipped)}\n")
    print("=== IMPORT ===")
    for item in ready:
        lab = item["label"]
        print(
            f"  {lab['date']:<12} {lab['referee']:<22} <- {lab['cmo']:<16} "
            f"[{lab['link']}] grade={lab['assessed']}  {lab['matchId']}"
        )
    print("\n=== SKIP ===")
    for row in skipped:
        print(f"  {row['date']:<12} {row['referee']:<22} {row['reason']}")
    if not args.write:
        print("\nDry-run only. Pass --write to PATCH Firestore.")
        return
    token = auth_token_or_exit()
    write_docs(ready, token)


if __name__ == "__main__":
    main()
