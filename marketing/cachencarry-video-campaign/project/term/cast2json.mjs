// Converts an asciicast (v2 or v3) into screen snapshots for the Remotion
// Terminal component. The real byte stream is replayed into a headless xterm
// emulator, so the picture is exactly what the terminal showed.
//   node term/cast2json.mjs in.cast out.json [--mask REGEX]... [--speed-idle SECONDS]
// --mask hides matching text (setup token etc.) behind a blur in the video.
// --idle caps pauses longer than SECONDS (like asciinema's idle time limit).
import { readFileSync, writeFileSync } from "node:fs";
import xterm from "@xterm/headless";
const { Terminal } = xterm;

const [, , input, output, ...rest] = process.argv;
const masks = [];
let idle = 3;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--mask") masks.push(new RegExp(rest[++i], "g"));
  if (rest[i] === "--idle") idle = Number(rest[++i]);
}
const lines = readFileSync(input, "utf8").trim().split("\n");
const header = JSON.parse(lines[0]);
const cols = header.term?.cols ?? header.width;
const rows = header.term?.rows ?? header.height;
const v3 = header.version === 3;

const term = new Terminal({ cols, rows, allowProposedApi: true, scrollback: 0 });
const write = (d) => new Promise((r) => term.write(d, r));

const PALETTE = ["#1b2230", "#f87171", "#34d399", "#fbbf24", "#60a5fa", "#c084fc", "#22d3ee", "#e2e8f0",
  "#64748b", "#fca5a5", "#6ee7b7", "#fde68a", "#93c5fd", "#d8b4fe", "#67e8f9", "#f8fafc"];
function color(cell, fg) {
  const mode = fg ? cell.getFgColorMode() : cell.getBgColorMode();
  const v = fg ? cell.getFgColor() : cell.getBgColor();
  if (fg ? cell.isFgDefault() : cell.isBgDefault()) return null;
  if (fg ? cell.isFgPalette() : cell.isBgPalette()) {
    if (v < 16) return PALETTE[v];
    if (v >= 232) { const g = 8 + (v - 232) * 10; return `rgb(${g},${g},${g})`; }
    const n = v - 16, c = [Math.floor(n / 36), Math.floor(n / 6) % 6, n % 6].map((x) => (x ? 55 + x * 40 : 0));
    return `rgb(${c.join(",")})`;
  }
  if (fg ? cell.isFgRGB() : cell.isBgRGB()) return `#${v.toString(16).padStart(6, "0")}`;
  return null;
}

function snapshot() {
  const buf = term.buffer.active;
  const out = [];
  const cell = buf.getNullCell();
  for (let y = 0; y < rows; y++) {
    const line = buf.getLine(buf.viewportY + y);
    const spans = [];
    let cur = null;
    for (let x = 0; x < cols; x++) {
      line.getCell(x, cell);
      const ch = cell.getChars() || " ";
      if (cell.getWidth() === 0) continue;
      const st = { f: color(cell, true), b: color(cell, false), w: cell.isBold() ? 1 : 0 };
      if (cell.isInverse()) { st.b = st.f || "#e2e8f0"; st.f = "#0a0e17"; }
      if (cur && cur.f === st.f && cur.b === st.b && cur.w === st.w) cur.t += ch;
      else { cur = { t: ch, ...st }; spans.push(cur); }
    }
    // Hide secrets: split spans where a mask matches.
    const text = spans.map((s) => s.t).join("");
    const hidden = new Array(text.length).fill(false);
    for (const m of masks) for (const r of text.matchAll(m)) for (let k = r.index; k < r.index + r[0].length; k++) hidden[k] = true;
    const final = [];
    let pos = 0;
    for (const s of spans) {
      for (let k = 0; k < s.t.length; k++) {
        const h = hidden[pos + k];
        const last = final[final.length - 1];
        // Hidden characters never reach the output file: they become dots (and are blurred in the video).
        const ch = h ? "•" : s.t[k];
        if (last && last.f === s.f && last.b === s.b && last.w === s.w && !!last.h === h) last.t += ch;
        else final.push({ t: ch, f: s.f, b: s.b, w: s.w, ...(h ? { h: 1 } : {}) });
      }
      pos += s.t.length;
    }
    // Trim trailing blanks.
    while (final.length && !final[final.length - 1].b && !final[final.length - 1].h && final[final.length - 1].t.trim() === "") final.pop();
    if (final.length) final[final.length - 1].t = final[final.length - 1].t.replace(/\s+$/, "") || final[final.length - 1].t;
    out.push(final.map((s) => { const o = { t: s.t }; if (s.f) o.f = s.f; if (s.b) o.b = s.b; if (s.w) o.w = 1; if (s.h) o.h = 1; return o; }));
  }
  return { lines: out, cx: buf.cursorX, cy: buf.cursorY };
}

const frames = [];
let t = 0, last = "";
const keys = []; // times of single typed characters, for keyboard sounds
for (const raw of lines.slice(1)) {
  if (!raw.startsWith("[")) continue;
  const [time, code, data] = JSON.parse(raw);
  const gap = v3 ? time : time - (frames.lastAbs ?? 0);
  if (!v3) frames.lastAbs = time;
  t += Math.min(gap, idle);
  if (code !== "o") continue;
  if (data.length === 1 && /[ -~]/.test(data)) keys.push(Math.round(t * 1000) / 1000);
  await write(data);
  const s = snapshot();
  const key = JSON.stringify(s);
  if (key === last) continue;
  last = key;
  const at = Math.round(t * 30) / 30;
  if (frames.length && frames[frames.length - 1].t === at) frames[frames.length - 1] = { t: at, ...s };
  else frames.push({ t: at, ...s });
}
writeFileSync(output, JSON.stringify({ cols, rows, duration: Math.round(t * 1000) / 1000, keys, frames }));
console.log(`${output}: ${frames.length} snapshots, ${t.toFixed(1)} s, ${cols}x${rows}`);
