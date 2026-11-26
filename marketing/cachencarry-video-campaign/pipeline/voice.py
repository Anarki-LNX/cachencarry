#!/usr/bin/env python3
"""Builds the German voice-over, the timeline and the subtitle files of one video.

    tools/venv/bin/python pipeline/voice.py scripts/presentation.json

For every line of the script, Piper (local, offline) speaks the German text
with the Thorsten voice (high), trims
the silence and normalizes the peak. The measured length of each recording decides the
timing of the scenes, so the burned-in subtitles and the .srt files are in
sync with the voice by construction.

Writes
    project/public/vo/<id>/<n>.wav          one file per spoken line
    project/src/timelines/<id>.json         scene and line timing for Remotion
    subtitles/de/<file>_de.srt, subtitles/en/<file>_en.srt
"""
import io, json, re, sys, wave, textwrap
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "tools/voices/de_DE-thorsten-high.onnx"
FPS = 30

# How Piper should pronounce words it would otherwise read as German.
# Applied in this order, only to the spoken text, never to subtitles.
LEXICON = [
    (r"Claude", "Klohd"),
    (r"Cache & Carry", "Käsch änd Kärri"),
    (r"CachyOS", "Kätschi O S"),
    (r"Cache", "Käsch"),
    (r"cache", "käsch"),
    (r"\bHIT\b", "Hitt"),
    (r"\bHITs\b", "Hitts"),
    (r"Upstream", "Appstriem"),
    (r"Mirrors?", "Mirrer"),
    (r"Homelab", "Hohmläb"),
    (r"GitHub", "Gitt Habb"),
    (r"Clients?", "Kleients"),
    (r"Pacman", "Päckmän"),
    (r"\bAPT\b", "A P T"),
    (r"Apache", "Äpätschi"),
    (r"Debian", "Debbian"),
    (r"\bArch\b", "Ahrtsch"),
    (r"\bLAN\b", "Lan"),
    (r"systemd", "System D"),
    (r"Docker Compose", "Docker Kompohs"),
    (r"Live-Traffic", "Leif-Träffick"),
    (r"\bMiB\b", "Mebibeit"),
    (r"\bGB\b", "Gigabeit"),
    (r"\bms\b", "Millisekunden"),
    (r"amd64", "A M D 64"),
    (r"arm64", "Arm 64"),
    (r"SHA-256", "Scha 256"),
    (r"\bIP\b", "I P"),
    (r"\bURL\b", "U R L"),
    (r"\bCPU\b", "C P U"),
    (r"\bRAM\b", "Ramm"),
    (r"\bLXC\b", "L X C"),
    (r"Setup-Token", "Einrichtungs-Tohken"),
    (r"Token", "Tohken"),
    (r"Repository", "Ripositorie"),
    (r"Repositories", "Ripositories"),
    (r"Dashboard", "Däschbord"),
    (r"\bsu\b", "S U"),
]


def spoken(text: str) -> str:
    for pat, rep in LEXICON:
        text = re.sub(pat, rep, text)
    return text


def wrap(text: str, width: int = 42) -> str:
    """Two balanced lines at most, split at the space nearest the middle."""
    if len(text) <= width:
        return text
    mid = len(text) // 2
    spaces = [i for i, c in enumerate(text) if c == " "]
    cut = min(spaces, key=lambda i: abs(i - mid))
    return text[:cut] + "\n" + text[cut + 1:]


def ts(sec: float) -> str:
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def synth(voice, cfg, text: str, path: Path) -> float:
    """One line: synthesize, trim silence to 30 ms before and 100 ms after,
    normalize the peak to 0.89. Returns the length in seconds."""
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        voice.synthesize_wav(text, w, syn_config=cfg)
    b.seek(0)
    with wave.open(b) as r:
        sr = r.getframerate()
        x = np.frombuffer(r.readframes(r.getnframes()), "<i2").astype(np.float32) / 32768
    idx = np.where(np.abs(x) > 0.004)[0]
    x = x[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.1 * sr)]
    x = x / max(1e-6, np.abs(x).max()) * 0.89
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    return len(x) / sr


def main(script_path: str) -> None:
    from piper import PiperVoice, SynthesisConfig

    script = json.loads(Path(script_path).read_text())
    vid = script["id"]
    voice = PiperVoice.load(str(MODEL))
    cfg = SynthesisConfig(length_scale=script.get("length_scale", 1.0))
    out_dir = ROOT / "project/public/vo" / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.wav"):
        old.unlink()

    t = 0.0
    scenes, cues = [], []
    n = 0
    for sc in script["scenes"]:
        start = t
        cursor = start + sc.get("lead", 0.5)
        lines = []
        for ln in sc.get("lines", []):
            n += 1
            if "at" in ln:  # absolute offset inside the scene, for lines tied to footage
                cursor = max(cursor, start + ln["at"])
            name = f"{n:02}.wav"
            dur = synth(voice, cfg, ln.get("say") or spoken(ln["de"]), out_dir / name)
            lines.append({"file": f"vo/{vid}/{name}", "start": round((cursor - start) * FPS), "frames": round(dur * FPS),
                          "de": ln["de"], "en": ln["en"]})
            cues.append((cursor, cursor + dur, ln["de"], ln["en"]))
            cursor += dur + ln.get("gap", sc.get("gap", 0.35))
        end = max(cursor - sc.get("gap", 0.35) + sc.get("tail", 0.6), start + sc.get("min", 0))
        scenes.append({"id": sc["id"], "start": round(start * FPS), "frames": round(end * FPS) - round(start * FPS), "lines": lines,
                       **{k: v for k, v in sc.items() if k not in ("id", "lines", "lead", "gap", "tail", "min")}})
        t = end
    total = round(t * FPS)
    tl = ROOT / "project/src/timelines" / f"{vid}.json"
    tl.parent.mkdir(parents=True, exist_ok=True)
    tl.write_text(json.dumps({"id": vid, "fps": FPS, "frames": total, "scenes": scenes}, ensure_ascii=False, indent=1))

    base = script["file"]
    for lang, idx in (("de", 2), ("en", 3)):
        p = ROOT / "subtitles" / lang / f"{base}_{lang}.srt"
        p.parent.mkdir(parents=True, exist_ok=True)
        rows = []
        for i, c in enumerate(cues):
            end = c[1] + 0.25
            if i + 1 < len(cues):
                end = min(end, cues[i + 1][0] - 0.05)
            rows.append(f"{i + 1}\n{ts(c[0])} --> {ts(end)}\n{wrap(c[idx])}\n")
        p.write_text("\n".join(rows))
    print(f"{vid}: {len(cues)} lines, {total / FPS:.1f} s ({total} frames)")
    for s in scenes:
        print(f"  {s['id']:<14} {s['start'] / FPS:6.1f} s  {s['frames'] / FPS:5.1f} s")


if __name__ == "__main__":
    for a in sys.argv[1:]:
        main(a)
