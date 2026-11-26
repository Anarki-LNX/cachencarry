// Building blocks shared by all campaign videos.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FPS, MONO } from "./theme";

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ramp = (frame: number, from: number, length: number) => interpolate(frame, [from, from + length], [0, 1], { ...clamp, easing: ease });
export const fade = (frame: number, length: number, f = 12) =>
  Math.min(interpolate(frame, [0, f], [0, 1], clamp), interpolate(frame, [length - f, length], [1, 0], clamp));
export const sec = (s: number) => Math.round(s * FPS);

export type Rect = { x: number; y: number; w: number; h: number };
export type Line = { file: string; start: number; frames: number; de: string; en: string };
export type Scene = { id: string; start: number; frames: number; lines: Line[] };
export type Timeline = { id: string; fps: number; frames: number; scenes: Scene[] };

export const sceneOf = (tl: Timeline, id: string) => {
  const s = tl.scenes.find((x) => x.id === id);
  if (!s) throw new Error("scene missing: " + id);
  return s;
};
/** Frame (inside the scene) where the n-th spoken line of a scene starts. */
export const lineAt = (s: Scene, n: number) => s.lines[n]?.start ?? 0;

// ---------------------------------------------------------------- background
export const Backdrop = ({ glow = 1 }: { glow?: number }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const a = frame / 260;
  const big = Math.max(width, height);
  const orb = (color: string, x: number, y: number, size: number): CSSProperties => ({
    position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 66%)`, filter: "blur(50px)", opacity: glow,
  });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 35%, ${C.navy} 0%, ${C.bg} 62%, #05070c 100%)` }}>
      <div style={orb("rgba(34,211,238,0.13)", width * 0.22 + Math.sin(a * 2.1) * width * 0.08, height * 0.3 + Math.cos(a * 1.7) * height * 0.08, big * 0.6)} />
      <div style={orb("rgba(52,211,153,0.10)", width * 0.8 + Math.cos(a * 1.6) * width * 0.07, height * 0.72 + Math.sin(a * 2.3) * height * 0.07, big * 0.62)} />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.line}66 1px, transparent 1px), linear-gradient(90deg, ${C.line}66 1px, transparent 1px)`,
          backgroundSize: "80px 80px", backgroundPosition: `${(frame * 0.15) % 80}px ${(frame * 0.1) % 80}px`,
          maskImage: "radial-gradient(ellipse at 50% 50%, black 5%, transparent 70%)", opacity: 0.35,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- windows
export const Win = ({ x, y, w, h, title, children, delay = 0, accent = C.cyan, tilt = 0, glow = 0.12 }: {
  x: number; y: number; w: number; h: number; title?: string; children: ReactNode; delay?: number; accent?: string; tilt?: number; glow?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.8 } });
  const bar = title ? 38 : 0;
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 18, overflow: "hidden", background: "#0b1019",
        border: `1.5px solid ${C.line}`, opacity: e,
        boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 70px ${accent}${Math.round(glow * 255).toString(16).padStart(2, "0")}`,
        transform: `perspective(2200px) rotateY(${tilt}deg) translateY(${(1 - e) * 50}px) scale(${0.95 + e * 0.05})`,
      }}
    >
      {title && (
        <div style={{ height: bar, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#0f1522", borderBottom: `1px solid ${C.line}` }}>
          {["#f87171", "#fbbf24", "#34d399"].map((c) => <div key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c, opacity: 0.8 }} />)}
          <div style={{ marginLeft: 12, fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.muted, letterSpacing: 0.3 }}>{title}</div>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: bar, bottom: 0 }}>{children}</div>
    </div>
  );
};

// ---------------------------------------------------------------- terminal
type Span = { t: string; f?: string; b?: string; w?: number; h?: number };
export type Cast = { cols: number; rows: number; duration: number; keys: number[]; frames: { t: number; lines: Span[][]; cx: number; cy: number }[] };

/** Screen of a real recording at time `t` (seconds into the recording). */
export const Terminal = ({ cast, t, fontSize, pad = 16, cursor = true, firstRow = 0, highlight = false }: { cast: Cast; t: number; fontSize: number; pad?: number; cursor?: boolean; firstRow?: number; highlight?: boolean }) => {
  let lo = 0, hi = cast.frames.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cast.frames[mid].t <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  const snap = idx >= 0 ? cast.frames[idx] : { lines: [] as Span[][], cx: 0, cy: 0 };
  const lh = fontSize * 1.32;
  const blink = Math.floor(t * 2) % 2 === 0;
  // While a command is being typed, its line gets a soft highlight.
  let lastKey = -99;
  for (const k of cast.keys) if (k <= t) lastKey = k;
  const hl = highlight && t - lastKey < 1.1 ? Math.min(1, 1.1 - (t - lastKey)) : 0;
  return (
    <div style={{ position: "absolute", inset: 0, padding: pad, fontFamily: MONO, fontSize, lineHeight: `${lh}px`, color: "#d7dee9", whiteSpace: "pre" }}>
      {hl > 0 && snap.cy - firstRow >= 0 && (
        <div style={{ position: "absolute", left: 6, right: 6, top: pad + (snap.cy - firstRow) * lh - 2, height: lh + 4, borderRadius: 6, background: `rgba(34,211,238,${0.13 * hl})`, borderLeft: `4px solid rgba(34,211,238,${0.9 * hl})` }} />
      )}
      {snap.lines.slice(firstRow).map((ln, i) => (
        <div key={i} style={{ height: lh }}>
          {ln.map((s, k) => (
            <span
              key={k}
              style={{
                color: s.f, background: s.b, fontWeight: s.w ? 700 : 400,
                ...(s.h ? { filter: "blur(7px)", background: "rgba(148,163,184,0.35)", borderRadius: 4 } : {}),
              }}
            >
              {s.t}
            </span>
          ))}
        </div>
      ))}
      {cursor && blink && snap.cy - firstRow >= 0 && (
        <div style={{ position: "absolute", left: pad + snap.cx * fontSize * 0.6, top: pad + (snap.cy - firstRow) * lh + 2, width: fontSize * 0.6, height: lh - 4, background: C.cyan, opacity: 0.85 }} />
      )}
    </div>
  );
};

/** Keyboard clicks at the real keystroke times of a recording. */
export const KeySounds = ({ cast, offset, rate = 1, until, volume = 0.35 }: { cast: Cast; offset: number; rate?: number; until?: number; volume?: number }) => (
  <>
    {cast.keys
      .map((k) => Math.round(((k - offset) / rate) * FPS))
      .filter((f) => f >= 0 && (until === undefined || f < until))
      .map((f, i) => (
        <Sequence key={i} from={f} durationInFrames={6} layout="none">
          <Audio src={staticFile("audio/fx_key.wav")} volume={volume * (0.8 + ((i * 37) % 10) / 25)} />
        </Sequence>
      ))}
  </>
);

// ---------------------------------------------------------------- footage
/** Index of the recorded image (6 per second) that belongs to `t` seconds. */
export const seqFrame = (name: string, t: number, count: number) =>
  `footage/${name}/${String(Math.min(count - 1, Math.max(0, Math.floor(t * 6)))).padStart(3, "0")}.jpg`;

/**
 * A part of a recorded interface image. `view` is a rectangle in the CSS
 * pixels of the recording (recordings are stored at 2x, so zooms stay sharp).
 * The image fills `w` x `h`; the view is scaled to the width.
 */
export const Shot = ({ src, srcW, w, h, view, children }: { src: string; srcW: number; w: number; h: number; view: Rect; children?: (map: (r: Rect) => CSSProperties) => ReactNode }) => {
  const s = w / view.w;
  const map = (r: Rect): CSSProperties => ({ position: "absolute", left: (r.x - view.x) * s, top: (r.y - view.y) * s, width: r.w * s, height: r.h * s });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", width: w, height: h }}>
      <Img src={staticFile(src)} style={{ position: "absolute", left: -view.x * s, top: -view.y * s, width: srcW * s, maxWidth: "none" }} />
      {children?.(map)}
    </div>
  );
};
export const lerpRect = (a: Rect, b: Rect, p: number): Rect => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p });

/** Glowing outline with an optional label, used on footage. */
export const Mark = ({ style, color = C.green, at = 0, label, labelSide = "top", radius = 10 }: { style: CSSProperties; color?: string; at?: number; label?: string; labelSide?: "top" | "bottom" | "right"; radius?: number }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 8], [0, 1], clamp);
  if (o <= 0) return null;
  const pulse = 1 + Math.sin((frame - at) / 6) * 0.01;
  const pos: CSSProperties = labelSide === "top" ? { bottom: "100%", left: 0, marginBottom: 10 } : labelSide === "bottom" ? { top: "100%", left: 0, marginTop: 10 } : { left: "100%", top: 0, marginLeft: 14 };
  return (
    <div style={{ ...style, opacity: o, transform: `scale(${pulse})` }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: radius, border: `3px solid ${color}`, boxShadow: `0 0 26px ${color}, inset 0 0 18px ${color}44` }} />
      {label && (
        <div style={{ position: "absolute", ...pos, whiteSpace: "nowrap", fontFamily: FONT, fontWeight: 800, fontSize: 24, letterSpacing: 1.5, color: "#0a0e17", background: color, padding: "6px 14px", borderRadius: 8 }}>
          {label}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- text
export const Kicker = ({ children, color = C.cyan, size = 22, delay = 0, style }: { children: ReactNode; color?: string; size?: number; delay?: number; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, delay, 16);
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 800, letterSpacing: size * 0.22, color, opacity: p, transform: `translateY(${(1 - p) * 14}px)`, ...style }}>
      {children}
    </div>
  );
};

/** Big headline, word by word. */
export const Title = ({ text, size, delay = 0, color = C.fg, accent, align = "left", style, lineHeight = 1.04 }: {
  text: string; size: number; delay?: number; color?: string; accent?: string[]; align?: "left" | "center"; style?: CSSProperties; lineHeight?: number;
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: FONT, fontSize: size, lineHeight, fontWeight: 850, letterSpacing: -size * 0.025, color, textAlign: align, display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `0 ${size * 0.26}px`, ...style }}>
      {words.map((w, i) => {
        if (w === "|") return <div key={i} style={{ flexBasis: "100%", height: 0 }} />;
        const p = ramp(frame, delay + i * 3, 16);
        const isAccent = accent?.some((a) => w.replace(/[.,!?:]/g, "") === a);
        return (
          <span key={i} style={{ color: isAccent ? (accent ? C.cyan : color) : color, opacity: p, transform: `translateY(${(1 - p) * size * 0.45}px)`, filter: `blur(${(1 - p) * 8}px)`, display: "inline-block" }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Pill = ({ children, color = C.fg, border = C.line, delay = 0, size = 26, style }: { children: ReactNode; color?: string; border?: string; delay?: number; size?: number; style?: CSSProperties }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, delay, 14);
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 700, color, padding: `${size * 0.36}px ${size * 0.8}px`, borderRadius: 999, border: `2px solid ${border}`, background: "rgba(13,20,36,0.88)", opacity: p, transform: `translateY(${(1 - p) * 18}px) scale(${0.96 + p * 0.04})`, whiteSpace: "nowrap", ...style }}>
      {children}
    </div>
  );
};

// ---------------------------------------------------------------- subtitles and audio
/** Burned-in subtitles: German first, English smaller and quieter below. No box. */
export const Subtitles = ({ tl, portrait = false, bottom }: { tl: Timeline; portrait?: boolean; bottom?: number }) => {
  const frame = useCurrentFrame();
  let cur: { line: Line; from: number } | null = null;
  for (const s of tl.scenes)
    for (const l of s.lines) {
      const from = s.start + l.start;
      if (frame >= from - 2 && frame < from + l.frames + 8) cur = { line: l, from };
    }
  if (!cur) return null;
  const local = frame - cur.from;
  const o = Math.min(interpolate(local, [-2, 4], [0, 1], clamp), interpolate(local, [cur.line.frames + 2, cur.line.frames + 8], [1, 0], clamp));
  // Burned in: English only. The German text is spoken, both languages also ship as .srt.
  const size = portrait ? 48 : 42;
  const shadow = "0 2px 4px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,1)";
  return (
    <div style={{ position: "absolute", left: portrait ? 70 : 220, right: portrait ? 70 : 220, bottom: bottom ?? (portrait ? 330 : 60), textAlign: "center", opacity: o, fontFamily: FONT }}>
      <div style={{ fontSize: size, lineHeight: 1.22, fontWeight: 650, color: "#ffffff", textShadow: shadow, textWrap: "balance" } as CSSProperties}>{cur.line.en}</div>
    </div>
  );
};

export const Voice = ({ tl, volume = 1 }: { tl: Timeline; volume?: number }) => (
  <>
    {tl.scenes.flatMap((s) =>
      s.lines.map((l) => (
        <Sequence key={l.file} from={s.start + l.start} durationInFrames={l.frames + 10} layout="none">
          <Audio src={staticFile(l.file)} volume={volume} />
        </Sequence>
      )),
    )}
  </>
);

/** Music bed that gets quieter while the voice speaks. */
export const Music = ({ tl, src, base = 0.5, duck = 0.18 }: { tl: Timeline; src: string; base?: number; duck?: number }) => {
  const spans = tl.scenes.flatMap((s) => s.lines.map((l) => [s.start + l.start, s.start + l.start + l.frames] as const));
  return (
    <Audio
      src={staticFile(src)}
      volume={(f) => {
        let d = 0;
        for (const [a, b] of spans) {
          const v = interpolate(f, [a - 8, a, b, b + 14], [0, 1, 1, 0], clamp);
          d = Math.max(d, v);
        }
        return base - (base - duck) * d;
      }}
    />
  );
};

export const Sfx = ({ at, src, volume = 0.6 }: { at: number; src: string; volume?: number }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={sec(4)} layout="none">
    <Audio src={staticFile(`audio/${src}.wav`)} volume={volume} />
  </Sequence>
);

// ---------------------------------------------------------------- brand
export const Logo = ({ width, delay = 0, slogan = false }: { width: number; delay?: number; slogan?: boolean }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, delay, 26);
  return (
    <Img
      src={staticFile(slogan ? "brand/logo-slogan-on-dark.svg" : "brand/logo-on-dark.svg")}
      style={{ width, opacity: p, transform: `scale(${0.9 + p * 0.1})`, filter: `blur(${(1 - p) * 14}px) drop-shadow(0 0 ${30 * p}px rgba(52,211,153,0.25))` }}
    />
  );
};

export const Mark3 = ({ size, delay = 0 }: { size: number; delay?: number }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, delay, 22);
  return <Img src={staticFile("brand/mark-on-dark.svg")} style={{ width: size, opacity: p, transform: `scale(${0.7 + p * 0.3})`, filter: `drop-shadow(0 0 ${40 * p}px rgba(52,211,153,0.45))` }} />;
};

// ---------------------------------------------------------------- network diagrams
export type Pt = { x: number; y: number };

/** A connection with data particles running from `a` to `b`. */
export const Flow = ({ a, b, color, on, speed = 0.9, count = 4, width = 3, dashed = false, size = 9 }: { a: Pt; b: Pt; color: string; on: number; speed?: number; count?: number; width?: number; dashed?: boolean; size?: number }) => {
  const frame = useCurrentFrame();
  if (on <= 0.001) return null;
  const dots = [...Array(count)].map((_, i) => ((frame / FPS) * speed + i / count) % 1);
  return (
    <g opacity={on}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeOpacity={0.35} strokeWidth={width} strokeDasharray={dashed ? "10 10" : undefined} strokeLinecap="round" />
      {dots.map((d, i) => (
        <circle key={i} cx={a.x + (b.x - a.x) * d} cy={a.y + (b.y - a.y) * d} r={size / 2} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      ))}
    </g>
  );
};

/** Round node with an icon-like label. */
export const Node = ({ x, y, label, sub, color = C.fg, glow = 0, size = 120, kind = "pc", appear = 1 }: {
  x: number; y: number; label: string; sub?: string; color?: string; glow?: number; size?: number; kind?: "pc" | "cloud" | "server"; appear?: number;
}) => {
  const icon =
    kind === "cloud" ? (
      <path d="M-30 12 a18 18 0 0 1 4 -35 a24 24 0 0 1 45 6 a16 16 0 0 1 3 29 z" fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" />
    ) : kind === "server" ? (
      <g fill="none" stroke={color} strokeWidth={4}>
        <rect x={-26} y={-28} width={52} height={22} rx={5} />
        <rect x={-26} y={2} width={52} height={22} rx={5} />
        <circle cx={-14} cy={-17} r={2.5} fill={color} />
        <circle cx={-14} cy={13} r={2.5} fill={color} />
      </g>
    ) : (
      <g fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round">
        <rect x={-28} y={-24} width={56} height={36} rx={5} />
        <path d="M-12 22 h24 M0 12 v10" />
      </g>
    );
  return (
    <g transform={`translate(${x} ${y}) scale(${0.8 + 0.2 * appear})`} opacity={appear}>
      <circle r={size / 2 + 26} fill={color} opacity={0.1 * glow} style={{ filter: "blur(18px)" }} />
      <circle r={size / 2} fill="#0d1424" stroke={glow > 0.5 ? color : C.line} strokeWidth={3} style={{ filter: glow > 0 ? `drop-shadow(0 0 ${22 * glow}px ${color})` : undefined }} />
      {icon}
      <text y={size / 2 + 40} textAnchor="middle" fill={C.fg} fontFamily={FONT} fontWeight={700} fontSize={26}>{label}</text>
      {sub && <text y={size / 2 + 70} textAnchor="middle" fill={C.muted} fontFamily={FONT} fontWeight={500} fontSize={21}>{sub}</text>}
    </g>
  );
};
