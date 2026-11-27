#!/usr/bin/env python3
"""Adds the kind of every typed key to the cast JSON files, for keyboard sounds.

    python3 pipeline/key_kinds.py

Reads the original recordings (assets/recordings/casts/*.cast) with the same
timing rules as project/term/cast2json.mjs and writes, next to the existing
"keys" (times of typed characters), the fields
    keyKinds  "n" normal key, "s" space bar, one per entry of "keys"
    enters    times of the Enter key (the line break echoed after typing)
Nothing else in the JSON changes. A file is skipped if the recomputed key
times do not match the stored ones exactly.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def replay(cast: Path, idle: float):
    lines = cast.read_text().strip().split("\n")
    v3 = json.loads(lines[0]).get("version") == 3
    t, last_abs = 0.0, 0.0
    keys, kinds, enters = [], [], []
    for raw in lines[1:]:
        if not raw.startswith("["):
            continue
        time, code, data = json.loads(raw)
        gap = time if v3 else time - last_abs
        if not v3:
            last_abs = time
        t += min(gap, idle)
        if code != "o":
            continue
        tt = round(t * 1000) / 1000
        if len(data) == 1 and " " <= data <= "~":
            keys.append(tt)
            kinds.append("s" if data == " " else "n")
        elif "\n" in data and keys and (not enters or enters[-1] < keys[-1]) and tt - keys[-1] < 2.0:
            enters.append(tt)  # first line break after a typed burst = Enter
    return keys, kinds, enters


def main():
    for js in sorted((ROOT / "project/src/casts").glob("*.json")):
        cast = ROOT / "assets/recordings/casts" / (js.stem + ".cast")
        d = json.loads(js.read_text())
        if not cast.exists():
            print(f"{js.name}: no recording, skipped")
            continue
        for idle in (3, 2, 1.5, 1, 4, 5, 10, 1e9):
            keys, kinds, enters = replay(cast, idle)
            if keys == d["keys"]:
                break
        else:
            print(f"{js.name}: key times differ, skipped")
            continue
        d["keyKinds"], d["enters"] = "".join(kinds), enters
        js.write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
        print(f"{js.name}: {len(keys)} keys ({kinds.count('s')} space), {len(enters)} enter (idle {idle})")


if __name__ == "__main__":
    main()
