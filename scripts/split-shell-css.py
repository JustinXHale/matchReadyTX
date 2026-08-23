"""Split monolithic shell.css into modular CSS files (move-only refactor).

Original shell.css was removed after split. Re-run only if restoring from git history.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src/app/shell.css"


def classify_selectors(text: str) -> str:
    order = [
        ("features/insights/insights.css", [r"\.rs-insights", r"\.rs-coach-feedback-trailing"]),
        ("features/auth/onboarding.css", [r"\.rs-onboard", r"\.pf-v6-theme-dark \.rs-onboard"]),
        ("features/teamAdmin/team-admin.css", [r"\.rs-team-admin", r"\.rs-fixture-req"]),
        ("features/scheduler/scheduler.css", [r"\.rs-queue", r"\.rs-scheduler"]),
        ("features/availability/availability.css", [r"\.rs-avail"]),
        ("features/referee/reports/reports.css", [r"\.rs-report", r"\.rs-perf-report"]),
        (
            "features/matches/match-detail.css",
            [r"\.rs-detail", r"\.rs-official-picker", r"\.rs-proposal", r"\.rs-match-detail"],
        ),
        ("features/members/members.css", [r"\.rs-member"]),
        ("features/about/about.css", [r"\.rs-about"]),
        ("styles/shell/signin.css", [r"\.rs-signin", r"\.rs-social-btn", r"\.rs-login"]),
        (
            "styles/shell/list-row.css",
            [
                r"\.rs-list-row",
                r"\.rs-list\b",
                r"\.rs-raise-hand",
                r"\.rs-appt-crew",
                r"\.rs-request-remove",
                r"\.rs-assign-overlap",
            ],
        ),
        ("styles/shell/pills.css", [r"\.rs-pill"]),
        (
            "styles/shell/brand-masthead.css",
            [
                r"\.rs-brand",
                r"\.rs-masthead",
                r"\.rs-demo",
                r"\.rs-theme-toggle",
                r"\.rs-nav-badge",
                r"\.rs-role-switcher",
                r"\.rs-bottom-nav",
                r"\.rs-fab",
                r"\.rs-pwa-install",
            ],
        ),
        (
            "styles/shell/base.css",
            [
                r"^html",
                r"^body",
                r"#root",
                r"\.pf-v6-c-button",
                r"\.pf-v6-c-masthead",
                r"\.pf-v6-c-page",
                r"\.rs-page-body",
                r"\.rs-page--auth",
                r"\.rs-stack\b",
                r"\.rs-form-stack",
                r"\.pf-v6-c-modal-box__body",
            ],
        ),
    ]
    for path, patterns in order:
        for pat in patterns:
            if re.search(pat, text, re.M):
                return path
    return "styles/shell/layout.css"


def parse_blocks(text: str) -> list[str]:
    lines = text.splitlines(keepends=True)
    blocks: list[str] = []
    i = 0
    while i < len(lines):
        start = i
        while i < len(lines):
            stripped = lines[i].strip()
            if stripped.startswith("@media") or stripped.startswith(".") or stripped.startswith(":"):
                break
            if "{" in lines[i] and not stripped.startswith("/*"):
                break
            i += 1
        if i >= len(lines):
            tail = "".join(lines[start:i])
            if tail.strip():
                blocks.append(tail)
            break

        if lines[i].strip().startswith("@media"):
            block_start = i
            depth = 0
            while i < len(lines):
                depth += lines[i].count("{") - lines[i].count("}")
                i += 1
                if depth <= 0 and i > block_start:
                    break
            blocks.append("".join(lines[block_start:i]))
            continue

        rule_start = i
        depth = 0
        started = False
        while i < len(lines):
            if "{" in lines[i]:
                started = True
            depth += lines[i].count("{") - lines[i].count("}")
            i += 1
            if started and depth <= 0:
                break
        blocks.append("".join(lines[start:i]))
    return blocks


def main() -> None:
    src = SRC.read_text()
    src = re.sub(r"@import\s+['\"].*tokens\.css['\"];\s*", "", src, count=1)

    files: dict[str, list[str]] = {}
    for block in parse_blocks(src):
        if not block.strip():
            continue
        path = classify_selectors(block)
        files.setdefault(path, []).append(block if block.endswith("\n") else block + "\n")

    for rel, chunks in files.items():
        out = ROOT / "src" / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("".join(chunks))

    print(f"Split {SRC} into {len(files)} files")
    for rel in sorted(files.keys()):
        n = len(files[rel])
        chars = sum(len(c) for c in files[rel])
        print(f"  {rel}: {n} blocks, {chars} chars")


if __name__ == "__main__":
    main()
