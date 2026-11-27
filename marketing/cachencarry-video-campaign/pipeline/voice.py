#!/usr/bin/env python3
"""Builds the German voice-over, the timeline and the subtitle files of one video.

    tools/venv/bin/python pipeline/voice.py scripts/presentation.json

Two texts per line, strictly separated:
    de   display text: subtitles, on-screen text, descriptions (correct spelling)
    tts  optional spoken text: may restructure the sentence, spell out numbers
         and add pauses ({p300} = 300 ms). Written in normal spelling.
The pronunciation dictionary (voice/pronunciation_dictionary.yaml) is applied
only to the spoken text, right before Piper. Phonetic spellings and IPA never
reach the subtitles.

Every line is spoken by Piper (local, offline) with the voice in voice/voice.yaml,
sentence by sentence with a controlled pause, in the delivery style of its
scene, then gently mastered (high-pass, EQ, de-esser, compressor, equal speech
level, fades, peak limit). The measured length of each recording decides the
timing of the scenes, so the .srt files are in sync with the voice.

Writes
    project/public/vo/<id>/<n>.wav          one mastered file per spoken line (48 kHz mono)
    project/src/timelines/<id>.json         scene and line timing for Remotion
    subtitles/de/<file>_de.srt, subtitles/en/<file>_en.srt

Environment
    VO_REUSE=1      keep existing recordings, only redo timing and subtitles
    VO_REDO=regex   with VO_REUSE: record again the lines whose spoken text matches
    VO_TAKES=N      record N takes per line, keep the most intelligible (whisper);
                    default from the script's "takes", else 1. Log: voice/takes/<id>.md
"""
import io, json, os, re, subprocess, sys, wave
import numpy as np
import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30
PAUSE = re.compile(r"\{p(\d+)\}")
TMP = Path.home() / ".cache/ccvt/voice"


def load_config() -> dict:
    return yaml.safe_load((ROOT / "voice/voice.yaml").read_text())


def load_dictionary(cfg: dict) -> list:
    d = yaml.safe_load((ROOT / cfg["dictionary"]).read_text())
    out = []
    for e in d["pronunciations"]:
        pat = e.get("match") or r"(?<!\w)" + re.escape(e["term"]) + r"(?!\w)"
        out.append({**e, "re": re.compile(pat)})
    return out


def load_voice(cfg: dict):
    from piper import PiperVoice
    return PiperVoice.load(str(ROOT / cfg["model"]))


def synth_config(cfg: dict, style: str, rate: float = 1.0):
    from piper import SynthesisConfig
    st = cfg["styles"][style]
    return SynthesisConfig(length_scale=st["length_scale"] * rate, noise_scale=st["noise_scale"],
                           noise_w_scale=st["noise_w_scale"])


def to_tts(text: str, dictionary: list) -> str:
    """Spoken text -> what Piper gets: dictionary entries replaced, nothing else."""
    for e in dictionary:
        text = e["re"].sub(e["spoken"].replace("\\", "\\\\"), text)
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


def _trim(x: np.ndarray, sr: int, before: float, after: float) -> np.ndarray:
    idx = np.where(np.abs(x) > 0.004)[0]
    if not len(idx):
        return x[:0]
    return x[max(0, idx[0] - int(before * sr)): idx[-1] + int(after * sr)]


def raw(pv, syn, text: str, style: dict, m: dict) -> tuple[np.ndarray, int]:
    """Piper output for one line: sentence by sentence, each trimmed, joined with
    the style's sentence pause; {pNNN} markers insert explicit pauses."""
    parts, sr = [], 22050
    for k, seg in enumerate(PAUSE.split(text)):
        if k % 2:  # pause marker
            parts.append(np.zeros(int(int(seg) / 1000 * sr), np.float32))
            continue
        if not seg.strip():
            continue
        sents = []
        for ch in pv.synthesize(seg, syn_config=syn):
            sr = ch.sample_rate
            x = np.frombuffer(ch.audio_int16_bytes, "<i2").astype(np.float32) / 32768
            x = _trim(x, sr, 0.02, 0.06)
            if len(x):
                sents.append(x)
        for i, x in enumerate(sents):
            if i:
                parts.append(np.zeros(int(style["sentence_pause"] * sr), np.float32))
            parts.append(x)
    x = np.concatenate(parts) if parts else np.zeros(1, np.float32)
    return _trim(x, sr, m["trim_before_ms"] / 1000, m["trim_after_ms"] / 1000), sr


def master(x: np.ndarray, sr: int, m: dict) -> tuple[np.ndarray, int]:
    """Gentle mastering with ffmpeg, then equal speech level, fades and peak limit."""
    TMP.mkdir(parents=True, exist_ok=True)
    src, dst = TMP / f"in_{os.getpid()}.wav", TMP / f"out_{os.getpid()}.wav"
    write_wav(src, x, sr)
    c = m["compressor"]
    chain = [f"aresample={m['sample_rate']}:resampler=soxr", f"highpass=f={m['highpass_hz']}"]
    chain += [f"equalizer=f={e['f']}:t=o:w={e['w']}:g={e['g']}" for e in m["eq"]]
    if m.get("deesser"):
        chain.append(f"deesser=i={m['deesser']}")
    chain.append(f"acompressor=threshold={c['threshold_db']}dB:ratio={c['ratio']}:attack={c['attack_ms']}:release={c['release_ms']}")
    subprocess.run(["nice", "-n", "19", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-threads", "1",
                    "-i", str(src), "-af", ",".join(chain), "-c:a", "pcm_f32le", str(dst)], check=True)
    y, sr2 = read_wav_f32(dst)
    src.unlink(); dst.unlink()
    # equal speech level: RMS over the louder half of 20 ms frames
    fr = int(0.02 * sr2)
    frames = y[: len(y) // fr * fr].reshape(-1, fr)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    speech = np.sort(rms)[len(rms) // 2:]
    level = np.sqrt((speech ** 2).mean()) if len(speech) else 1e-6
    y = y * (10 ** (m["speech_rms_db"] / 20) / max(level, 1e-6))
    pk = np.abs(y).max()
    if pk > m["peak"]:
        y = y * (m["peak"] / pk)
    fi, fo = int(m["fade_in_ms"] / 1000 * sr2), int(m["fade_out_ms"] / 1000 * sr2)
    y[:fi] *= np.linspace(0, 1, fi)
    y[len(y) - fo:] *= np.linspace(1, 0, fo)
    return y, sr2


def read_wav_f32(path: Path) -> tuple[np.ndarray, int]:
    """Reads a mono WAV (16-bit or 32-bit float) as float32."""
    b = Path(path).read_bytes()
    i, sr, fmt, data = 12, 0, 1, b""
    while i < len(b):
        cid, size = b[i:i + 4], int.from_bytes(b[i + 4:i + 8], "little")
        body = b[i + 8:i + 8 + size]
        if cid == b"fmt ":
            fmt, sr = int.from_bytes(body[0:2], "little"), int.from_bytes(body[4:8], "little")
        elif cid == b"data":
            data = body
        i += 8 + size + (size & 1)
    if fmt == 3:
        return np.frombuffer(data, "<f4").astype(np.float32), sr
    return np.frombuffer(data, "<i2").astype(np.float32) / 32768, sr


def write_wav(path: Path, x: np.ndarray, sr: int) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def synth(pv, syn, text: str, path: Path, cfg: dict, style: str = "neutral") -> float:
    """One line: Piper, sentence pauses, mastering. Returns the length in seconds."""
    x, sr = raw(pv, syn, text, cfg["styles"][style], cfg["master"])
    y, sr2 = master(x, sr, cfg["master"])
    write_wav(path, y, sr2)
    return len(y) / sr2


def wav_seconds(path: Path) -> float:
    with wave.open(str(path)) as r:
        return r.getnframes() / r.getframerate()


def line_texts(ln: dict, dictionary: list) -> tuple[str, str]:
    """(spoken text in normal spelling, text handed to Piper)."""
    spoken = ln.get("tts") or ln["de"]
    return spoken, to_tts(spoken, dictionary)


class TakePicker:
    """Records several takes of a line and keeps the most intelligible one,
    judged by a local whisper: every dictionary term of the line must be heard
    (accept patterns from voice/pron_candidates.yaml), then word overlap."""

    def __init__(self, dictionary: list):
        from faster_whisper import WhisperModel
        os.environ.setdefault("HF_HOME", str(Path.home() / ".cache/ccvt/hf"))
        self.m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=3)
        self.dictionary = dictionary
        cands = yaml.safe_load((ROOT / "voice/pron_candidates.yaml").read_text())
        self.accept = {c["term"]: re.compile(c["accept"]) for c in cands}
        self.log: list[str] = []

    @staticmethod
    def _words(t: str) -> list[str]:
        return re.sub(r"[^a-zäöüß0-9 ]", " ", t.lower()).split()

    def score(self, wav: Path, display: str) -> tuple[float, str]:
        heard = " ".join(x.text for x in self.m.transcribe(str(wav), language="de")[0]).strip()
        h = heard.lower()
        terms = [e["term"] for e in self.dictionary if e["term"] in self.accept and e["re"].search(display)]
        ok = sum(1 for t in terms if self.accept[t].search(h))
        exp, got = self._words(display), set(self._words(heard))
        overlap = sum(1 for w in exp if w in got) / max(1, len(exp))
        return ok * 2 + overlap, heard

    def best(self, make, display: str, path: Path, takes: int) -> float:
        results = []
        for k in range(takes):
            tmp = path.with_name(f"{path.stem}.take{k}.wav")
            dur = make(tmp)
            sc, heard = self.score(tmp, display)
            results.append((sc, k, dur, tmp, heard))
        results.sort(key=lambda r: -r[0])
        sc, k, dur, tmp, heard = results[0]
        tmp.replace(path)
        for r in results[1:]:
            r[3].unlink()
        self.log.append(f"| {path.parent.name}/{path.name} | {len(results)} | take {k + 1} | {sc:.2f} | {heard} |")
        return dur


def main(script_path: str) -> None:
    cfg = load_config()
    dictionary = load_dictionary(cfg)
    script = json.loads(Path(script_path).read_text())
    vid = script["id"]
    pv = load_voice(cfg)
    out_dir = ROOT / "project/public/vo" / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    reuse = bool(os.environ.get("VO_REUSE"))
    redo = os.environ.get("VO_REDO")
    takes = int(os.environ.get("VO_TAKES", script.get("takes", 1)))
    picker = TakePicker(dictionary) if takes > 1 else None
    if not reuse:
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
            _, text = line_texts(ln, dictionary)
            style = ln.get("style") or sc.get("style") or script.get("style", "neutral")
            if reuse and (out_dir / name).exists() and not (redo and re.search(redo, text)):
                dur = wav_seconds(out_dir / name)
            else:
                syn = synth_config(cfg, style, ln.get("rate", 1.0))
                make = lambda p, syn=syn, text=text, style=style: synth(pv, syn, text, p, cfg, style)
                dur = picker.best(make, ln["de"], out_dir / name, takes) if picker else make(out_dir / name)
            lines.append({"file": f"vo/{vid}/{name}", "start": round((cursor - start) * FPS), "frames": round(dur * FPS),
                          "de": ln["de"], "en": ln["en"]})
            cues.append((cursor, cursor + dur, ln["de"], ln["en"]))
            cursor += dur + ln.get("gap", sc.get("gap", 0.35))
        end = max(cursor - sc.get("gap", 0.35) + sc.get("tail", 0.6), start + sc.get("min", 0))
        scenes.append({"id": sc["id"], "start": round(start * FPS), "frames": round(end * FPS) - round(start * FPS), "lines": lines,
                       **{k: v for k, v in sc.items() if k not in ("id", "lines", "lead", "gap", "tail", "min", "style")}})
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
    if picker and picker.log:
        lp = ROOT / "voice/takes" / f"{vid}.md"
        lp.parent.mkdir(parents=True, exist_ok=True)
        lp.write_text(f"# Take-Auswahl {vid}\n\nBeste von {takes} Aufnahmen je Satz, bewertet mit whisper small.\n\n"
                      "| Datei | Takes | gewählt | Punkte | gehört |\n|---|---|---|---|---|\n" + "\n".join(picker.log) + "\n")
    print(f"{vid}: {len(cues)} lines, {total / FPS:.1f} s ({total} frames)")
    for s in scenes:
        print(f"  {s['id']:<14} {s['start'] / FPS:6.1f} s  {s['frames'] / FPS:5.1f} s")


if __name__ == "__main__":
    for a in sys.argv[1:]:
        main(a)
