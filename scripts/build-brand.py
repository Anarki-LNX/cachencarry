#!/usr/bin/env python3
"""Builds the Cache & Carry brand files in assets/brand.

The wordmark is converted to outlines so the SVG files look the same
everywhere, without the font installed. Needs fontTools and a copy of
Adwaita Sans (SIL Open Font License); PNG export needs rsvg-convert.

    python3 scripts/build-brand.py
"""
import pathlib
import shutil
import subprocess

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONT = "/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "brand"

GREEN = "#34d399"
GREEN_DARK = "#059669"   # on light backgrounds
INK = "#0f1623"          # dark surface / dark text
PAPER = "#f8fafc"        # light text
MUTED_ON_DARK = "#94a3b8"
MUTED_ON_LIGHT = "#475569"

SLOGAN_1 = "Your network's package warehouse."
SLOGAN_2 = "Download once, carry out as often as you like."

_fonts = {}


def font(weight):
    if weight not in _fonts:
        f = TTFont(FONT)
        _fonts[weight] = instancer.instantiateVariableFont(f, {"wght": weight}, inplace=False)
    return _fonts[weight]


def text_path(text, size, weight, x=0.0, y=0.0, tracking=0.0):
    """Returns (svg path data, advance width) for text with its baseline at y."""
    f = font(weight)
    glyphs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
    scale = size / f["head"].unitsPerEm
    pen = SVGPathPen(glyphs)
    cursor = x
    for ch in text:
        name = cmap.get(ord(ch), ".notdef")
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, y)))
        cursor += hmtx[name][0] * scale + tracking * size
    return pen.getCommands(), cursor - x


def mark(stroke, accent, x=0.0, y=0.0, size=64.0):
    """The trolley carrying a package. Drawn on a 64 x 64 grid."""
    s = size / 64.0
    return f'''<g transform="translate({x:.2f} {y:.2f}) scale({s:.4f})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 13h8.5l5.2 29.500h31.300" stroke="{stroke}" stroke-width="4.200"/>
    <rect x="25" y="14.500" width="25" height="21.500" rx="4" stroke="{stroke}" stroke-width="4.200"/>
    <path d="M37.500 20v9.500m-4.700-4.300 4.700 4.700 4.700-4.700" stroke="{accent}" stroke-width="3.600"/>
    <circle cx="26" cy="52" r="3.300" fill="{stroke}" stroke="{stroke}" stroke-width="2.400"/>
    <circle cx="46.500" cy="52" r="3.300" fill="{stroke}" stroke="{stroke}" stroke-width="2.400"/>
  </g>'''


def svg(width, height, body, title="Cache &amp; Carry"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" '
            f'width="{width:.0f}" height="{height:.0f}" role="img" aria-label="{title}">\n'
            f'  <title>{title}</title>\n  {body}\n</svg>\n')


def icon(rounded=True):
    r = 'rx="14"' if rounded else ""
    return svg(64, 64, f'<rect width="64" height="64" {r} fill="{INK}"/>\n  ' + mark(GREEN, PAPER, 8, 6, 50))


def wordmark(size, x, y, text_color, amp_color):
    parts, cursor = [], x
    for chunk, color in (("Cache", text_color), ("&", amp_color), ("Carry", text_color)):
        d, w = text_path(chunk, size, 750, cursor, y, tracking=-0.018)
        parts.append(f'<path d="{d}" fill="{color}"/>')
        cursor += w + size * 0.24
    return "\n  ".join(parts), cursor - size * 0.24 - x


def lockup(dark, slogan):
    text_color = PAPER if dark else INK
    green = GREEN if dark else GREEN_DARK
    muted = MUTED_ON_DARK if dark else MUTED_ON_LIGHT
    pad, mark_size, gap, size = 8, 64, 18, 40
    words, w = wordmark(size, pad + mark_size + gap, pad + 46, text_color, green)
    body = mark(green, text_color, pad, pad, mark_size) + "\n  " + words
    width, height = pad + mark_size + gap + w + pad, pad + mark_size + pad
    if slogan:
        d1, w1 = text_path(SLOGAN_1, 17, 560, pad, height + 20)
        d2, w2 = text_path(SLOGAN_2, 17, 420, pad, height + 44)
        body += f'\n  <path d="{d1}" fill="{text_color}"/>\n  <path d="{d2}" fill="{muted}"/>'
        width, height = max(width, pad + max(w1, w2) + pad), height + 58
    return svg(width, height, body)


def social():
    """1280 x 640 card for link previews and the repository page."""
    w, h = 1280, 640
    words, ww = wordmark(92, 0, 0, PAPER, GREEN)
    block = 150 + 44 + ww
    x0 = (w - block) / 2
    d1, w1 = text_path(SLOGAN_1, 40, 600, 0, 0)
    d2, w2 = text_path(SLOGAN_2, 34, 420, 0, 0)
    body = f'''<defs>
    <radialGradient id="g" cx="50%" cy="0%" r="90%">
      <stop offset="0" stop-color="#16324a"/><stop offset="0.550" stop-color="#0f1623"/><stop offset="1" stop-color="#0a0f18"/>
    </radialGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#g)"/>
  {mark(GREEN, PAPER, x0, 150, 150)}
  <g transform="translate({x0 + 194:.1f} 262)">{words}</g>
  <path transform="translate({(w - w1) / 2:.1f} 420)" d="{d1}" fill="{PAPER}"/>
  <path transform="translate({(w - w2) / 2:.1f} 482)" d="{d2}" fill="{MUTED_ON_DARK}"/>
  <rect x="{w / 2 - 44}" y="536" width="88" height="5" rx="2.500" fill="{GREEN}"/>'''
    return svg(w, h, body)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "icon.svg": icon(),
        "mark-on-dark.svg": svg(64, 64, mark(GREEN, PAPER)),
        "mark-on-light.svg": svg(64, 64, mark(GREEN_DARK, INK)),
        "logo-on-dark.svg": lockup(True, False),
        "logo-on-light.svg": lockup(False, False),
        "logo-slogan-on-dark.svg": lockup(True, True),
        "logo-slogan-on-light.svg": lockup(False, True),
        "social-card.svg": social(),
    }
    for name, content in files.items():
        (OUT / name).write_text(content)
    if not shutil.which("rsvg-convert"):
        print("rsvg-convert not found: PNG files were not written")
        return
    png = [("icon.svg", "icon-512.png", 512), ("icon.svg", "icon-192.png", 192), ("icon.svg", "icon-64.png", 64),
           ("icon.svg", "icon-32.png", 32), ("logo-on-dark.svg", "logo-on-dark.png", 1200),
           ("logo-on-light.svg", "logo-on-light.png", 1200), ("logo-slogan-on-dark.svg", "logo-slogan-on-dark.png", 1400),
           ("logo-slogan-on-light.svg", "logo-slogan-on-light.png", 1400), ("social-card.svg", "social-card.png", 1280)]
    for src, dst, width in png:
        subprocess.run(["rsvg-convert", "-w", str(width), str(OUT / src), "-o", str(OUT / dst)], check=True)
    print(f"wrote {len(files)} SVG and {len(png)} PNG files to {OUT}")


if __name__ == "__main__":
    main()
