#!/usr/bin/env python3
"""Pre-render check of the voice-over. Run before every render (build-all.sh does).

    tools/venv/bin/python pipeline/voice_qa.py [video-id ...]

Checks
  1. English and foreign terms in the spoken text: each one must be covered by
     the pronunciation dictionary or be listed as "as_is" (tested, fine as written).
     Unknown ones are reported as warnings.
  2. Separation of display and spoken text: no phonetic spelling, IPA ([[ ]]) or
     pause marker ({p..}) in subtitles, scripts' display text, on-screen text
     (project/src) or the social texts.
  3. Audio: every line of the timeline has its WAV, the length matches the
     timeline, no clipping.
Writes voice/voiceover_quality_report.md, voice/voiceover_display_text.md and
voice/voiceover_tts_text.md. Exit code 1 if an error was found.
"""
import json, re, sys
from pathlib import Path
import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import voice as V

ROOT = V.ROOT
VIDEOS = ["presentation", "tutorial", "short01", "short02", "short03", "short04", "short05", "short06"]
TOKEN = re.compile(r"[A-Za-zÄÖÜäöüß][\w&./-]*")
IPA = re.compile(r"\[\[[^\]\"']*[ˈˌːɐəɛɪʊʃʒæœŋ]")
FOREIGN = re.compile(r"(th|sh(?!e)|ck\b|oo|ee|ea|ou|ay|y\b|tion\b|^c[^h]|^x|[a-z][A-Z]|^[A-Z]{2,}|\d|[/._])")


WATCH = {w for l in (ROOT / "voice/english_watchlist.txt").read_text().splitlines() if not l.startswith("#") for w in l.split()}


def foreign_tokens(text: str, covered: list[tuple[int, int]], as_is: set) -> list[str]:
    out = []
    for m in TOKEN.finditer(text):
        if any(a <= m.start() < b for a, b in covered):
            continue
        for w in m.group(0).rstrip(".-").split("-"):  # compounds: check every part
            if not w or w in as_is or w.lower() in as_is:
                continue
            if w.lower() in WATCH or FOREIGN.search(w) and not re.fullmatch(r"[A-ZÄÖÜ][a-zäöüß]+", w) or re.fullmatch(r"[A-Z]{2,}", w):
                out.append(w)
    return out


def parse_srt(p: Path) -> list[tuple[float, float, str]]:
    def sec(x):
        h, m, r = x.split(":"); s_, ms = r.split(",")
        return int(h) * 3600 + int(m) * 60 + int(s_) + int(ms) / 1000
    out = []
    for block in p.read_text().strip().split("\n\n"):
        rows = block.split("\n")
        a, b = rows[1].split(" --> ")
        out.append((sec(a), sec(b), " ".join(rows[2:])))
    return out


def video_seconds(path: Path):
    import subprocess
    if not path.exists():
        return None
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def check_subtitles(vid: str, S: dict, tl: dict, errors: list, rows: list):
    """SRT files must match the final video: one cue per spoken line, starting
    with the voice, text equal to the display text, nothing after the end."""
    lines = [ln for sc in S["scenes"] for ln in sc.get("lines", [])]
    starts = [(s["start"] + l["start"]) / V.FPS for s in tl["scenes"] for l in s["lines"]]
    total = tl["frames"] / V.FPS
    mp4 = video_seconds(ROOT / "final/de" / f"{S['file']}_de.mp4")
    for lang in ("de", "en"):
        p = ROOT / "subtitles" / lang / f"{S['file']}_{lang}.srt"
        if not p.exists():
            errors.append(f"{p.relative_to(ROOT)} fehlt")
            continue
        cues = parse_srt(p)
        if len(cues) != len(lines):
            errors.append(f"{p.name}: {len(cues)} Untertitel, aber {len(lines)} Sätze")
        for i, (a, b, text) in enumerate(cues[:len(lines)]):
            if text != lines[i][lang]:
                errors.append(f"{p.name} Nr. {i + 1}: Text weicht vom Skript ab")
            if abs(a - starts[i]) > 1 / V.FPS:
                errors.append(f"{p.name} Nr. {i + 1}: beginnt {a:.2f} s, Stimme bei {starts[i]:.2f} s")
            if b <= a or (i + 1 < len(cues) and b > cues[i + 1][0]):
                errors.append(f"{p.name} Nr. {i + 1}: Zeiten überlappen")
        end = cues[-1][1] if cues else 0
        if end > total or (mp4 and end > mp4):
            errors.append(f"{p.name}: letzter Untertitel endet {end:.2f} s, Video {mp4 or total:.2f} s")
        rows.append(f"| {p.name} | {len(cues)} | {end:.2f} s | {total:.2f} s | " + (f"{mp4:.2f} s" if mp4 else "nicht gerendert") + " |")


def main(only):
    cfg = V.load_config()
    dic = V.load_dictionary(cfg)
    raw = yaml.safe_load((ROOT / cfg["dictionary"]).read_text())
    as_is = set(raw.get("as_is", []))
    errors, warnings, rows, srt_rows = [], [], [], []
    disp_md = ["# Anzeigetext (Untertitel, Bildtext, Beschreibungen)", "",
               "Erzeugt von `pipeline/voice_qa.py` aus `scripts/*.json` (Feld `de`). Richtige Schreibweise, keine Lautschrift.", ""]
    tts_md = ["# Sprechtext (nur für die Sprachsynthese)", "",
              "Erzeugt von `pipeline/voice_qa.py`. Je Satz: **Sprechfassung** (Feld `tts`, normale Schreibweise, sonst `de`)",
              "und darunter, was Piper nach der Ausspracheliste bekommt. `[[ ]]` ist Lautschrift (IPA), `{p300}` eine Pause von 300 ms.",
              "Dieser Text darf nie in Untertitel, Bildtexte oder Beschreibungen gelangen.", ""]
    spoken_forms = sorted({e["spoken"] for e in dic if e["spoken"] != e["term"] and not e["spoken"].startswith("[[")}, key=len, reverse=True)

    for vid in VIDEOS:
        if only and vid not in only:
            continue
        S = json.loads((ROOT / f"scripts/{vid}.json").read_text())
        disp_md += [f"## {vid}", ""]
        check_subtitles(vid, S, json.loads((ROOT / f"project/src/timelines/{vid}.json").read_text()), errors, srt_rows)
        tts_md += [f"## {vid}", ""]
        tl = json.loads((ROOT / f"project/src/timelines/{vid}.json").read_text())
        tl_lines = [l for s in tl["scenes"] for l in s["lines"]]
        n = 0
        for sc in S["scenes"]:
            style = sc.get("style") or S.get("style", "neutral")
            for ln in sc.get("lines", []):
                n += 1
                spoken, piper = V.line_texts(ln, dic)
                st = ln.get("style") or style
                if st not in cfg["styles"]:
                    errors.append(f"{vid} Zeile {n}: unbekannter Stil `{st}`")
                disp_md.append(f"- **{sc['id']}** {ln['de']}")
                tts_md.append(f"- **{sc['id']}** ({st}) {spoken}  \n  `{piper}`")
                # 1. terms
                covered = [(m.start(), m.end()) for e in dic for m in e["re"].finditer(spoken)]
                for w in foreign_tokens(spoken, covered, as_is):
                    warnings.append(f"{vid} Zeile {n}: `{w}` steht nicht in der Ausspracheliste")
                # 2. separation inside the script itself
                for f in ("de", "en"):
                    if IPA.search(ln[f]) or "[[" in ln[f] or V.PAUSE.search(ln[f]):
                        errors.append(f"{vid} Zeile {n}: Lautschrift oder Pause im Feld `{f}`")
                    for sp in spoken_forms:
                        if re.search(r"(?<!\w)" + re.escape(sp) + r"(?!\w)", ln[f]):
                            errors.append(f"{vid} Zeile {n}: Sprechform `{sp}` im Anzeigetext `{f}`")
                # 3. audio
                if n > len(tl_lines):
                    errors.append(f"{vid} Zeile {n}: fehlt in der Timeline")
                    continue
                wav = ROOT / "project/public" / tl_lines[n - 1]["file"]
                if not wav.exists():
                    errors.append(f"{vid} Zeile {n}: Audiodatei fehlt ({wav.name})")
                    continue
                x, sr = V.read_wav_f32(wav)
                dur = len(x) / sr
                if abs(dur * V.FPS - tl_lines[n - 1]["frames"]) > 1:
                    errors.append(f"{vid} Zeile {n}: Länge {dur:.2f} s passt nicht zur Timeline")
                pk = float(np.abs(x).max())
                clip = int((np.abs(x) >= 0.999).sum())
                if clip:
                    errors.append(f"{vid} Zeile {n}: {clip} übersteuerte Samples")
                rows.append(f"| {vid} | {n:02} | {sc['id']} | {st} | {dur:.2f} s | {20 * np.log10(max(pk, 1e-9)):.1f} dBFS |")
        disp_md.append("")
        tts_md.append("")

    # 2. leaks in every display file
    for p in list((ROOT / "subtitles").rglob("*.srt")) + list((ROOT / "social").glob("*.md")) + list((ROOT / "project/src").glob("*.tsx")):
        t = p.read_text()
        if IPA.search(t) or V.PAUSE.search(t):
            errors.append(f"{p.relative_to(ROOT)}: Lautschrift oder Pausenmarke")
        for sp in spoken_forms:
            if re.search(r"(?<!\w)" + re.escape(sp) + r"(?!\w)", t):
                errors.append(f"{p.relative_to(ROOT)}: Sprechform `{sp}` im Anzeigetext")

    rep = ["# Prüfbericht Sprecher", "",
           f"Stimme `{cfg['model']}`, Ausspracheliste `{cfg['dictionary']}` ({len(dic)} Einträge, {len(as_is)} geprüfte Wörter ohne Änderung).",
           "Erzeugt von `pipeline/voice_qa.py` vor dem Render.", "",
           f"**Ergebnis: {len(errors)} Fehler, {len(warnings)} Warnungen.**", ""]
    rep += ["## Fehler", ""] + ([f"- {e}" for e in errors] or ["keine"]) + [""]
    rep += ["## Warnungen", ""] + ([f"- {w}" for w in sorted(set(warnings))] or ["keine"]) + [""]
    rep += ["## Geprüft", "",
            "- englische und fremde Begriffe gegen die Ausspracheliste",
            "- keine Lautschrift, IPA oder Pausenmarke in Untertiteln, Anzeigetext der Skripte, Bildtext (`project/src`) und Begleittexten (`social/`)",
            "- jede Audiodatei vorhanden, Länge passt zur Timeline, keine übersteuerten Samples",
            "- Untertitel (SRT, Deutsch und Englisch): ein Eintrag je Satz, Text gleich dem Skript, Beginn mit der Stimme, keine Überlappung, nichts nach dem Videoende", "",
            "## Untertitel", "", "| Datei | Einträge | letzter endet | Timeline | Video in final/de |", "|---|---|---|---|---|"] + srt_rows + ["",
            "## Audiodateien", "", "| Video | Zeile | Szene | Stil | Länge | Spitze |", "|---|---|---|---|---|---|"] + rows
    (ROOT / "voice/voiceover_quality_report.md").write_text("\n".join(rep) + "\n")
    (ROOT / "voice/voiceover_display_text.md").write_text("\n".join(disp_md) + "\n")
    (ROOT / "voice/voiceover_tts_text.md").write_text("\n".join(tts_md) + "\n")
    print(f"voice QA: {len(errors)} Fehler, {len(warnings)} Warnungen (voice/voiceover_quality_report.md)")
    for e in errors[:20]:
        print("  FEHLER", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main(set(sys.argv[1:]))
