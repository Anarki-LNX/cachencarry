#!/usr/bin/env python3
"""English voice-over with Kokoro (am_michael by the user's choice), for the
English versions. Same mastering, timing and subtitle rules as pipeline/voice.py.

    tools/venv-kokoro/bin/python pipeline/voice_en.py scripts/<video>.json

Reads the "en" text of every line ("tts_en" if a spoken form is needed) and writes
    project/public/vo/<id>_en/NN.wav
    project/src/timelines/<id>_en.json
    subtitles/en-video/<file_en>_en.srt   (English video, English text)
"""
import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import voice as V
from kokoro_onnx import Kokoro

ROOT = V.ROOT
FPS = V.FPS
MODEL = ROOT / "tools/voices/en"


def main(script_path: str) -> None:
    cfg = V.load_config()
    m = cfg["master"]
    script = json.loads(Path(script_path).read_text())
    vid = script["id"] + "_en"
    voice = script.get("voice_en", "am_michael")
    k = Kokoro(str(MODEL / "kokoro-v1.0.onnx"), str(MODEL / "voices-v1.0.bin"))
    out_dir = ROOT / "project/public/vo" / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.wav"):
        old.unlink()
    t, n = 0.0, 0
    scenes, cues = [], []
    for sc in script["scenes"]:
        start = t
        cursor = start + sc.get("lead", 0.5)
        lines = []
        for ln in sc.get("lines", []):
            n += 1
            name = f"{n:02}.wav"
            x, sr = k.create(ln.get("tts_en", ln["en"]), voice=voice, speed=ln.get("rate_en", 1.0), lang="en-us")
            x = V._trim(np.asarray(x, np.float32), sr, m["trim_before_ms"] / 1000, m["trim_after_ms"] / 1000)
            y, sr2 = V.master(x, sr, m)
            V.write_wav(out_dir / name, y, sr2)
            dur = len(y) / sr2
            lines.append({"file": f"vo/{vid}/{name}", "start": round((cursor - start) * FPS), "frames": round(dur * FPS), "de": ln["en"], "en": ln["en"]})
            cues.append((cursor, cursor + dur, ln["en"]))
            cursor += dur + ln.get("gap", sc.get("gap", 0.35))
        end = max(cursor - sc.get("gap", 0.35) + sc.get("tail", 0.6), start + sc.get("min", 0))
        scenes.append({"id": sc["id"], "start": round(start * FPS), "frames": round(end * FPS) - round(start * FPS), "lines": lines})
        t = end
    total = round(t * FPS)
    (ROOT / "project/src/timelines" / f"{vid}.json").write_text(json.dumps({"id": vid, "fps": FPS, "frames": total, "scenes": scenes}, ensure_ascii=False, indent=1))
    p = ROOT / "subtitles/en-video" / f"{script.get('file_en', script['file'])}_en.srt"
    p.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, c in enumerate(cues):
        e = c[1] + 0.25
        if i + 1 < len(cues):
            e = min(e, cues[i + 1][0] - 0.05)
        rows.append(f"{i + 1}\n{V.ts(c[0])} --> {V.ts(e)}\n{V.wrap(c[2])}\n")
    p.write_text("\n".join(rows))
    print(f"{vid}: {len(cues)} lines, {total / FPS:.1f} s ({total} frames), voice {voice}")
    for s in scenes:
        print(f"  {s['id']:<14} {s['start'] / FPS:6.1f} s  {s['frames'] / FPS:5.1f} s")


if __name__ == "__main__":
    for a in sys.argv[1:]:
        main(a)
