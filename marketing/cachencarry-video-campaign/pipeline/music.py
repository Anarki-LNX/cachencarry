#!/usr/bin/env python3
"""Original soundtrack and sound effects for the campaign, synthesized with numpy.

Nothing is sampled or downloaded: every sound is computed here, so the music
belongs to the project and needs no licence.

    python3 pipeline/music.py            # all tracks and effects
    python3 pipeline/music.py fx         # only the effects

Tracks follow the scene timing in project/src/timelines/<id>.json, so run
pipeline/voice.py first. Output: project/public/audio/*.wav (48 kHz stereo).
"""
import json, sys, wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "project/public/audio"
SR = 48000
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def save(name: str, x: np.ndarray, normalize: bool = True) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    if normalize:
        peak = np.max(np.abs(x)) or 1.0
        x = x / peak * 0.89
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print(f"wrote {name} ({len(x) / SR:.1f} s)")


def t_axis(sec: float) -> np.ndarray:
    return np.arange(int(sec * SR)) / SR


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def lp(x, f, order=2):
    b, a = signal.butter(order, min(f, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


def saw(f, t, voices=1, detune=0.0):
    out = np.zeros_like(t)
    for v in range(voices):
        d = 1 + detune * (v - (voices - 1) / 2)
        ph = rng.random()
        out += 2 * ((t * f * d + ph) % 1.0) - 1
    return out / voices


def reverb(x, seconds=2.2, mix=0.25, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    env = np.exp(-np.arange(n) / SR * (6.9 / seconds))
    irl = r.standard_normal(n) * env
    irr = r.standard_normal(n) * env
    irl, irr = lp(irl, 6000), lp(irr, 6000)
    irl /= np.sqrt(np.sum(irl ** 2))
    irr /= np.sqrt(np.sum(irr ** 2))
    mono = x if x.ndim == 1 else x.mean(axis=1)
    wl = signal.fftconvolve(mono, irl)[: len(mono)]
    wr = signal.fftconvolve(mono, irr)[: len(mono)]
    dry = x if x.ndim == 2 else np.stack([x, x], axis=1)
    return dry * (1 - mix) + np.stack([wl, wr], axis=1) * mix


def place(buf, snd, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    n = min(len(snd), len(buf) - i)
    buf[i:i + n] += snd[:n]


def pan(x, p):
    """p from -1 (left) to 1 (right)."""
    return np.stack([x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2)], axis=1)


# ---------------------------------------------------------------- instruments
def kick(level=1.0):
    t = t_axis(0.45)
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.25
    return (body + click) * level


def hat(level=0.25, decay=55):
    t = t_axis(0.12)
    return hp(rng.standard_normal(len(t)), 7000, 4) * np.exp(-t * decay) * level


def clap(level=0.5):
    t = t_axis(0.35)
    n = bp(rng.standard_normal(len(t)), 900, 4000)
    env = np.exp(-t * 18)
    for k in (0.0, 0.011, 0.022):
        env += np.where(t >= k, np.exp(-(t - k) * 140), 0) * 0.6
    return n * env * level


def pluck(f, dur=0.32, level=0.3, bright=4000):
    t = t_axis(dur)
    x = 0.6 * np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.15 * saw(f, t)
    x = lp(x, bright) * np.exp(-t * 9)
    return x * level


def bass_note(f, dur, level=0.5, cutoff=420):
    t = t_axis(dur)
    x = saw(f, t, voices=2, detune=0.006) + 0.6 * np.sin(2 * np.pi * f * t)
    env = np.minimum(1, t / 0.008) * np.exp(-t * 3.2)
    return lp(x * env, cutoff, 2) * level


def pad_chord(notes, dur, level=0.18, cutoff=1800, attack=1.2):
    t = t_axis(dur)
    x = sum(saw(hz(n), t, voices=3, detune=0.004) for n in notes) / len(notes)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.8).clip(0, 1)
    return lp(x, cutoff, 2) * env * level


def riser(dur=2.0, level=0.35):
    t = t_axis(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(n)
    # sweep the band upwards in slices
    steps = 24
    for s in range(steps):
        a, b = int(s * len(t) / steps), int((s + 1) * len(t) / steps)
        f = 300 * (12 ** (s / steps))
        out[a:b] = bp(n[a:b], f, min(f * 2.5, 16000))
    return out * (t / dur) ** 2.2 * level


def whoosh(dur=0.9, level=0.5):
    t = t_axis(dur)
    n = rng.standard_normal(len(t))
    env = np.exp(-((t - dur * 0.45) / (dur * 0.22)) ** 2)
    x = bp(n, 500, 5000) * env
    return pan(x * level, 0) * np.stack([np.linspace(1.2, 0.7, len(t)), np.linspace(0.7, 1.2, len(t))], axis=1)


def impact(level=0.9):
    t = t_axis(2.6)
    f = 32 + 60 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    noise = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 7) * 0.45
    return reverb(boom + noise, 2.5, 0.35) * level


def chime(level=0.4):
    """Cache HIT confirmation: two bright, quick notes upwards."""
    out = np.zeros(int(0.9 * SR))
    for i, m in enumerate((84, 91)):
        t = t_axis(0.8)
        x = (np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(2 * np.pi * hz(m) * 2.01 * t)) * np.exp(-t * 6)
        place(out, x, i * 0.075)
    return reverb(out * level, 1.2, 0.3)


def miss_tone(level=0.35):
    """Cache MISS: a soft, lower double pulse."""
    out = np.zeros(int(0.7 * SR))
    for i, m in enumerate((64, 60)):
        t = t_axis(0.35)
        x = np.sin(2 * np.pi * hz(m) * t) * np.exp(-t * 11)
        place(out, x, i * 0.11)
    return reverb(out * level, 0.9, 0.25)


def data_pulse(level=0.3):
    t = t_axis(0.25)
    f = 1800 - 1100 * t / 0.25
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16)
    return reverb(x * level, 0.6, 0.2)


def key_press(kind: str, r) -> np.ndarray:
    """One key of a real-sounding keyboard, dull rather than clicky: a soft
    low-passed touch, a short wooden "thock" (body resonance), the bottom-out
    and, a little later, the quieter release. Space and Enter are larger keys
    with a lower body and a stabilizer rattle. Everything below about 2.8 kHz.
    Variation per call: body pitch about +-7 %, level about +-1.5 dB."""
    body = {"n": 230.0, "s": 118.0, "e": 150.0}[kind] * (1 + r.uniform(-0.07, 0.07))
    dec = {"n": 0.018, "s": 0.032, "e": 0.026}[kind]
    t = t_axis(0.16)
    soft = 1 - np.exp(-t / 0.0015)                      # soft attack, no hard click
    touch = lp(r.standard_normal(len(t)), 2500, 2) * soft * np.exp(-t / 0.006) * 0.55
    thock = (np.sin(2 * np.pi * body * t) * 0.6 + np.sin(2 * np.pi * body * 2.3 * t + 1.1) * 0.18 * np.exp(-t / 0.006)) \
        * soft * np.exp(-t / dec)
    bottom = lp(r.standard_normal(len(t)), 1200, 2) * soft * np.exp(-t / 0.012) * 0.5
    x = touch + thock + bottom
    if kind != "n":  # stabilizer rattle of the long keys
        place(x, lp(r.standard_normal(int(0.02 * SR)), 1800, 2) * np.exp(-t_axis(0.02) / 0.004) * 0.35, 0.007)
    rel_at = r.uniform(0.055, 0.08) if kind == "n" else r.uniform(0.08, 0.1)
    rel = lp(r.standard_normal(int(0.03 * SR)), 2000, 2) * np.exp(-t_axis(0.03) / 0.005) * 0.22
    place(x, rel, rel_at)
    x = hp(lp(x, 2800, 4), 60)
    return x * {"n": 1.0, "s": 1.15, "e": 1.1}[kind] * 10 ** (r.uniform(-1.5, 1.5) / 20)


def keyboard_set():
    """fx_kbd_n0..7 (letters), fx_kbd_s0..2 (space), fx_kbd_e0..2 (enter).
    One common scale for all files, so their relative loudness stays real."""
    r = np.random.default_rng(11)
    sounds = {f"fx_kbd_n{i}.wav": key_press("n", r) for i in range(8)}
    sounds |= {f"fx_kbd_s{i}.wav": key_press("s", r) for i in range(3)}
    sounds |= {f"fx_kbd_e{i}.wav": key_press("e", r) for i in range(3)}
    scale = 0.89 / max(np.abs(x).max() for x in sounds.values())
    for name, x in sounds.items():
        save(name, x * scale, normalize=False)


def logo_sting(level=0.6):
    out = np.zeros(int(3.5 * SR))
    for i, m in enumerate((57, 64, 69, 76)):
        place(out, pluck(hz(m), 1.6, 0.35, 5000), i * 0.09)
    place(out, np.sin(2 * np.pi * hz(45) * t_axis(2.5)) * np.exp(-t_axis(2.5) * 1.5) * 0.5, 0)
    return reverb(out * level, 2.8, 0.4)


# ---------------------------------------------------------------- arrangement
PROG = [(57, [57, 60, 64, 69]), (53, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (55, [55, 59, 62, 67])]  # Am F C G


def groove(total, bpm, sections, energy="mid"):
    """sections: list of (start_s, end_s, set_of_layers)."""
    beat = 60 / bpm
    bar = beat * 4
    n = int(total * SR) + SR
    mix = np.zeros((n, 2))
    drums = np.zeros(n)
    bass = np.zeros(n)
    arp = np.zeros(n)
    pads = np.zeros(n)

    def layers_at(sec):
        for a, b, ls in sections:
            if a <= sec < b:
                return ls
        return set()

    nbars = int(total / bar) + 1
    for bi in range(nbars):
        t0 = bi * bar
        root, chord = PROG[bi % 4]
        ls = layers_at(t0 + 0.01)
        if "pad" in ls:
            place(pads, pad_chord(chord, bar + 0.9, 0.2 if "big" in ls else 0.15, 2400 if "big" in ls else 1500, 0.6), t0)
        if "drone" in ls:
            tt = t_axis(bar + 0.5)
            d = (np.sin(2 * np.pi * hz(root - 24) * tt) + 0.4 * saw(hz(root - 12), tt)) * np.minimum(1, tt / 0.5) * np.minimum(1, (bar + 0.5 - tt) / 0.5).clip(0, 1)
            place(pads, lp(d, 500) * 0.25, t0)
        for s in range(16):
            ts = t0 + s * beat / 4
            ls = layers_at(ts)
            if "kick" in ls and s % 4 == 0:
                place(drums, kick(0.9), ts)
            if "kick2" in ls and s in (10,):
                place(drums, kick(0.55), ts)
            if "clap" in ls and s in (4, 12):
                place(drums, clap(0.4), ts)
            if "hat" in ls and s % 2 == 1:
                place(drums, hat(0.10), ts)
            if "hat16" in ls and s % 2 == 0 and s % 4 != 0:
                place(drums, hat(0.045, 90), ts)
            if "pulse" in ls and s % 2 == 0:
                place(bass, bass_note(hz(root - 24), beat / 2, 0.3, 300), ts)
            if "bass" in ls and s % 2 == 0:
                place(bass, bass_note(hz(root - 12 - (12 if s % 4 == 0 else 0)), beat / 2 * 0.95, 0.42, 520 if "big" in ls else 400), ts)
            if "arp" in ls:
                note = chord[[0, 2, 1, 3, 2, 1, 3, 2][s % 8]] + 12
                place(arp, pluck(hz(note), 0.3, 0.12, 3200 if "big" in ls else 2200), ts)
    # side-chain feel: duck bass and pads after each kick
    env = np.ones(n)
    k = (np.minimum(1, np.arange(int(beat * SR)) / (beat * SR * 0.45))) ** 0.7
    for bi in range(int(total / beat) + 1):
        ts = bi * beat
        if "kick" in layers_at(ts):
            i = int(ts * SR)
            m = min(len(k), n - i)
            env[i:i + m] = np.minimum(env[i:i + m], 0.45 + 0.55 * k[:m])
    pads *= env
    bass *= env
    delay = int(beat * 0.75 * SR)
    arp_l = arp.copy()
    arp_r = np.zeros(n)
    arp_r[delay:] += arp[:-delay] * 0.5
    arp_l[2 * delay:] += arp[:-2 * delay] * 0.28
    mix += reverb(pads, 3.0, 0.35)
    mix += pan(bass, 0) * 1.0
    mix += reverb(np.stack([arp_l, arp_r], axis=1), 1.8, 0.25) * 0.9
    mix += reverb(drums, 0.8, 0.1)
    return mix[: int(total * SR)]


def timeline(vid):
    p = ROOT / "project/src/timelines" / f"{vid}.json"
    tl = json.loads(p.read_text())
    return tl, {s["id"]: (s["start"] / tl["fps"], (s["start"] + s["frames"]) / tl["fps"]) for s in tl["scenes"]}


def fade(x, fin=0.5, fout=3.0):
    n = len(x)
    e = np.ones(n)
    a, b = int(fin * SR), int(fout * SR)
    e[:a] = np.linspace(0, 1, a)
    e[n - b:] *= np.linspace(1, 0, b) ** 1.5
    return x * e[:, None]


def track_presentation():
    tl, sc = timeline("presentation")
    total = tl["frames"] / tl["fps"]
    secs = [
        (0, sc["idea"][0], {"drone", "pulse", "hat16"}),
        (sc["idea"][0], sc["meet"][0], {"pad", "arp", "pulse"}),
        (sc["meet"][0], sc["meet"][0] + 4, {"pad", "arp"}),
        (sc["meet"][0] + 4, sc["shared"][0], {"pad", "arp", "kick", "hat", "bass"}),
        (sc["shared"][0], sc["homelab"][0], {"pad", "arp", "kick", "kick2", "hat", "hat16", "bass", "clap", "big"}),
        (sc["homelab"][0], sc["cta"][0], {"pad", "arp", "kick", "hat", "bass", "clap"}),
        (sc["cta"][0], sc["cta"][0] + 9, {"pad", "arp", "kick", "hat", "hat16", "bass", "clap", "big"}),
        (sc["cta"][0] + 9, total + 5, {"pad", "big"}),
    ]
    mix = groove(total, 120, secs)
    for a, _ in list(sc.values())[1:]:
        place(mix, riser(1.6, 0.18)[:, None] * np.ones(2), a - 1.6)
    place(mix, impact(0.7), sc["meet"][0] + 1.0)
    save("music_presentation.wav", fade(mix, 1.0, 3.0))


def track_install(vid="install"):
    """Install video: like the presentation for the pitch, calmer for the three ways."""
    tl, sc = timeline(vid)
    total = tl["frames"] / tl["fps"]
    secs = [
        (0, sc["solution"][0], {"drone", "pulse", "hat16"}),
        (sc["solution"][0], sc["pitch"][0], {"pad", "arp", "kick", "hat", "bass"}),
        (sc["pitch"][0], sc["ways"][0], {"pad", "arp", "kick", "hat", "hat16", "bass", "clap", "big"}),
        (sc["ways"][0], sc["cta"][0], {"pad", "arp", "pulse"}),
        (sc["cta"][0], total - 4, {"pad", "arp", "kick", "hat", "bass", "clap"}),
        (total - 4, total + 5, {"pad", "big"}),
    ]
    mix = groove(total, 112, secs)
    for k in ("solution", "pitch", "ways", "cta"):
        place(mix, riser(1.6, 0.16)[:, None] * np.ones(2), sc[k][0] - 1.6)
    place(mix, impact(0.6), sc["solution"][0] + 0.2)
    save(f"music_{vid}.wav", fade(mix, 1.0, 3.0))


def track_tutorial():
    tl, _ = timeline("tutorial")
    total = tl["frames"] / tl["fps"]
    mix = groove(total, 84, [(0, total + 5, {"pad", "arp"})])
    save("music_tutorial.wav", fade(lp(mix, 2600), 2.0, 4.0))


def track_short(vid, drop):
    tl, sc = timeline(vid)
    total = tl["frames"] / tl["fps"]
    names = list(sc)
    d = sc[names[min(drop, len(names) - 1)]][0]
    secs = [
        (0, d, {"pulse", "hat", "hat16", "drone"}),
        (d, total - 2.2, {"pad", "arp", "kick", "kick2", "hat", "hat16", "bass", "clap", "big"}),
        (total - 2.2, total + 5, {"pad", "big"}),
    ]
    mix = groove(total, 124, secs)
    place(mix, riser(1.4, 0.22)[:, None] * np.ones(2), d - 1.4)
    place(mix, impact(0.6), d)
    save(f"music_{vid}.wav", fade(mix, 0.05, 1.8))


def effects():
    save("fx_whoosh.wav", whoosh())
    save("fx_impact.wav", impact())
    save("fx_hit.wav", chime())
    save("fx_miss.wav", miss_tone())
    save("fx_pulse.wav", data_pulse())
    save("fx_logo.wav", logo_sting())
    keyboard_set()


if __name__ == "__main__":
    what = sys.argv[1:] or ["fx", "presentation", "tutorial", "install", "shorts"]
    if "fx" in what:
        effects()
    if "presentation" in what:
        track_presentation()
    if "tutorial" in what:
        track_tutorial()
    if "install" in what:
        track_install()
        track_install("install_en")
    if "shorts" in what:
        for vid, drop in (("short01", 2), ("short02", 1), ("short03", 1), ("short04", 1), ("short05", 1), ("short06", 1), ("reel_install", 1), ("reel_install_en", 1)):
            if (ROOT / "project/src/timelines" / f"{vid}.json").exists():
                track_short(vid, drop)
