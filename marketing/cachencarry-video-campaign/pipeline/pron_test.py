#!/usr/bin/env python3
"""Tests pronunciation candidates with the configured voice and a local whisper.

    HF_HOME=~/.cache/ccvt/hf tools/venv/bin/python pipeline/pron_test.py [term ...]

For every term in voice/pron_candidates.yaml, every candidate is spoken in three
carrier sentences, transcribed by faster-whisper (small, CPU, int8) and scored
against the term's accept pattern. Writes voice/pron_test_report.md and one
sample WAV per term and candidate to research/samples/pron/ for listening.
Whisper only checks intelligibility. It does not replace listening.
"""
import re, sys
from pathlib import Path
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import voice as V

CARRIERS = ["Das ist {}.", "Wir nutzen {} jeden Tag.", "Mit {} geht es schneller."]


def main(only):
    from faster_whisper import WhisperModel
    cfg = V.load_config()
    pv = V.load_voice(cfg)
    m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=3)
    out = V.ROOT / "research/samples/pron"
    out.mkdir(parents=True, exist_ok=True)
    items = yaml.safe_load((V.ROOT / "voice/pron_candidates.yaml").read_text())
    rows = ["# Aussprachetest", "", f"Stimme `{cfg['model']}`, whisper small. Je Kandidat drei Trägersätze.", "",
            "| Begriff | Kandidat | erkannt | gehört (falsche) |", "|---|---|---|---|"]
    for it in items:
        if only and it["term"] not in only:
            continue
        for i, c in enumerate(it["cand"]):
            ok, wrong = 0, []
            for j, carrier in enumerate(CARRIERS):
                p = out / f"{re.sub(r'[^A-Za-z0-9]+', '_', it['term'])}_{i}_{j}.wav"
                V.synth(pv, V.synth_config(cfg, "neutral"), carrier.format(c), p, cfg)
                t = " ".join(s.text for s in m.transcribe(str(p), language="de")[0]).strip()
                if re.search(it["accept"], t.lower()):
                    ok += 1
                else:
                    wrong.append(t)
                if j:
                    p.unlink()  # keep one sample per candidate
            line = f"| {it['term']} | `{c}` | {ok}/3 | {' / '.join(wrong)} |"
            rows.append(line)
            print(line, flush=True)
    (V.ROOT / "voice/pron_test_report.md").write_text("\n".join(rows) + "\n")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
