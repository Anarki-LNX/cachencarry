#!/usr/bin/env python3
"""Checks on-screen text: no semicolons and no dashes (–, —, " - ") in
subtitles, scripts and the visible strings of the Remotion scenes."""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
bad = re.compile(r";|–|—| - ")
problems = 0
for p in sorted((ROOT / "scripts").glob("*.json")):
    for sc in json.loads(p.read_text())["scenes"]:
        for ln in sc["lines"]:
            for k in ("de", "en"):
                if bad.search(ln[k]):
                    print(f"{p.name}: {k}: {ln[k]}"); problems += 1
for p in sorted((ROOT / "subtitles").rglob("*.srt")):
    for i, line in enumerate(p.read_text().splitlines(), 1):
        if "-->" not in line and bad.search(line):
            print(f"{p.name}:{i}: {line}"); problems += 1
# Visible text in TSX: JSX text nodes and string literals that contain a space or capital letters.
for p in sorted((ROOT / "project/src").glob("*.tsx")):
    src = p.read_text()
    for m in re.finditer(r'>([^<>{}\n]+)<|"([^"\n]{3,})"|`([^`\n]{3,})`', src):
        s = next(g for g in m.groups() if g)
        if re.search(r"[A-Za-zÄÖÜäöü]", s) and bad.search(s) and not re.search(r"rgba|px|\$\{|=>|linear-gradient|&&", s):
            line = src[: m.start()].count("\n") + 1
            print(f"{p.name}:{line}: {s.strip()}"); problems += 1
print("OK, no semicolons or dashes in on-screen text" if not problems else f"{problems} problem(s)")
sys.exit(1 if problems else 0)
