#!/usr/bin/env python3
"""Validate current documentation links and required truth-in-status files."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "README.md",
    "CHANGELOG.md",
    "docs/STATUS.md",
    "docs/HARNESS_APP.md",
    "docs/LOCAL_QA.md",
    "docs/FRONTEND.md",
    "docs/ARCHITECTURE.md",
    "docs/MODELS.md",
    "docs/COSTS.md",
    "electron/README.md",
    "reference/README.md",
]
LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^\s)]+)(?:\s+[^)]*)?\)")
SKIP_PREFIXES = ("http://", "https://", "mailto:", "data:", "#", "app://")

def validate() -> list[str]:
    problems: list[str] = []
    for item in REQUIRED:
        if not (ROOT / item).is_file():
            problems.append(f"missing required documentation: {item}")
    files = [p for p in ROOT.rglob("*.md") if ".git" not in p.parts]
    for file in files:
        content = file.read_text(encoding="utf-8")
        for match in LINK.finditer(content):
            target = unquote(match.group(1).split("#", 1)[0])
            if not target or target.lower().startswith(SKIP_PREFIXES):
                continue
            if ":" in target.split("/", 1)[0]:
                continue
            expected = (file.parent / target).resolve()
            if not expected.is_relative_to(ROOT):
                problems.append(f"{file.relative_to(ROOT)}: link escapes repository: {target}")
            elif not expected.exists():
                problems.append(f"{file.relative_to(ROOT)}: broken local link: {target}")
    status = ROOT / "docs/STATUS.md"
    if status.exists():
        text = status.read_text(encoding="utf-8").lower()
        for phrase in ("native", "unverified", "monitor", "project", "sandbox"):
            if phrase not in text:
                problems.append(f"docs/STATUS.md: missing contract term '{phrase}'")
    return problems

if __name__ == "__main__":
    problems = validate()
    if problems:
        for item in problems:
            print("DOC CHECK FAILED:", item, file=sys.stderr)
        sys.exit(1)
    print("DOC CHECK OK: required docs, repository links and status boundary")
