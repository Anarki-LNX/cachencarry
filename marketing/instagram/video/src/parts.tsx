import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, SAFE } from "./theme";

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 to 1 over [from, from + length], eased. */
export const ramp = (frame: number, from: number, length: number) => interpolate(frame, [from, from + length], [0, 1], { ...clamp, easing: ease });

/** Fades a scene in and out at its edges. */
export const sceneOpacity = (frame: number, length: number, fade = 10) =>
  Math.min(interpolate(frame, [0, fade], [0, 1], clamp), interpolate(frame, [length - fade, length], [1, 0], clamp));

/** Slowly drifting glows on the dark brand background. */
export const Background = () => {
  const frame = useCurrentFrame();
  const a = frame / 240;
  const glow = (color: string, x: number, y: number, size: number): CSSProperties => ({
    position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 65%)`, filter: "blur(40px)",
  });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #0d1422 0%, ${C.bg} 45%, #070a11 100%)` }}>
      <div style={glow("rgba(52,211,153,0.200)", 300 + Math.sin(a * 2.1) * 160, 420 + Math.cos(a * 1.7) * 120, 900)} />
      <div style={glow("rgba(96,165,250,0.160)", 820 + Math.cos(a * 1.6) * 140, 1380 + Math.sin(a * 2.3) * 160, 1000)} />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.line}55 1px, transparent 1px), linear-gradient(90deg, ${C.line}55 1px, transparent 1px)`,
          backgroundSize: "90px 90px", maskImage: "radial-gradient(ellipse at 50% 45%, black 10%, transparent 72%)", opacity: 0.5,
        }}
      />
    </AbsoluteFill>
  );
};

/** Subtitle line, placed above the area Instagram covers at the bottom. */
export const Caption = ({ text, length }: { text: string; length: number }) => {
  const frame = useCurrentFrame();
  const o = sceneOpacity(frame, length, 8);
  return (
    <div style={{ position: "absolute", left: SAFE.side, right: SAFE.side, bottom: SAFE.bottom + 10, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          fontFamily: FONT, fontSize: 40, lineHeight: 1.28, fontWeight: 600, color: C.fg, textAlign: "center", padding: "18px 30px", borderRadius: 22,
          background: "rgba(7,10,17,0.780)", border: `1px solid ${C.line}`, maxWidth: 900, transform: `translateY(${(1 - ramp(frame, 0, 14)) * 24}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Small label and a large headline, used above footage. */
export const Headline = ({ kicker, children, top = SAFE.top + 20 }: { kicker?: string; children: ReactNode; top?: number }) => {
  const frame = useCurrentFrame();
  const k = ramp(frame, 0, 16);
  const h = ramp(frame, 5, 20);
  return (
    <div style={{ position: "absolute", left: SAFE.side, right: SAFE.side, top, fontFamily: FONT }}>
      {kicker && (
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 5, color: C.green, opacity: k, transform: `translateY(${(1 - k) * 16}px)` }}>{kicker}</div>
      )}
      <div style={{ marginTop: 12, fontSize: 78, lineHeight: 1.06, fontWeight: 800, letterSpacing: -2, color: C.fg, whiteSpace: "pre-line", opacity: h, transform: `translateY(${(1 - h) * 30}px)` }}>
        {children}
      </div>
    </div>
  );
};

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Shows a part of a recorded interface image inside a rounded card. `from`
 * and `to` are rectangles in the CSS pixels of the recording, so the camera
 * can push in on a detail. Recordings are stored at twice that size, which
 * keeps the picture sharp.
 */
export const Footage = ({
  src, sourceWidth, width, from, to, progress, top, children,
}: {
  src: string; sourceWidth: number; width: number; from: Rect; to?: Rect; progress?: number; top: number; children?: (scale: number, view: Rect) => ReactNode;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = progress ?? 0;
  const t = to ?? from;
  const view: Rect = { x: from.x + (t.x - from.x) * p, y: from.y + (t.y - from.y) * p, w: from.w + (t.w - from.w) * p, h: from.h + (t.h - from.h) * p };
  const scale = width / view.w;
  const height = (from.h * width) / from.w;
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.9 } });
  return (
    <div
      style={{
        position: "absolute", left: (1080 - width) / 2, top, width, height, borderRadius: 34, overflow: "hidden", background: C.bg,
        border: `2px solid ${C.line}`, boxShadow: `0 40px 120px rgba(0,0,0,0.650), 0 0 90px rgba(52,211,153,0.140)`,
        opacity: enter, transform: `translateY(${(1 - enter) * 70}px) scale(${0.94 + enter * 0.06})`,
      }}
    >
      <Img src={staticFile(src)} style={{ position: "absolute", left: -view.x * scale, top: -view.y * scale, width: sourceWidth * scale, maxWidth: "none" }} />
      {children?.(scale, view)}
    </div>
  );
};

/** The recorded frame that belongs to the current moment (recorded at 6 per second). */
export const footageFrame = (name: string, localFrame: number, count: number, startAt = 0) => {
  const index = Math.min(count - 1, Math.max(0, startAt + Math.floor((localFrame / 30) * 6)));
  return `footage/${name}/${String(index).padStart(3, "0")}.jpg`;
};

/** A glowing outline that draws attention to one spot of the footage. */
export const Spotlight = ({ rect, scale, view, at, color = C.green }: { rect: Rect; scale: number; view: Rect; at: number; color?: string }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 10], [0, 1], clamp);
  const pulse = 1 + Math.sin((frame - at) / 5) * 0.012;
  return (
    <div
      style={{
        position: "absolute", left: (rect.x - view.x) * scale, top: (rect.y - view.y) * scale, width: rect.w * scale, height: rect.h * scale, borderRadius: 14,
        border: `4px solid ${color}`, boxShadow: `0 0 34px ${color}, inset 0 0 22px ${color}55`, opacity: o, transform: `scale(${pulse})`,
      }}
    />
  );
};

/** A small rounded label. */
export const Chip = ({ children, color = C.fg, delay = 0 }: { children: ReactNode; color?: string; delay?: number }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, delay, 16);
  return (
    <div
      style={{
        fontFamily: FONT, fontSize: 34, fontWeight: 650, color, padding: "12px 26px", borderRadius: 999, border: `2px solid ${C.line}`,
        background: "rgba(17,24,39,0.850)", opacity: p, transform: `translateY(${(1 - p) * 22}px)`,
      }}
    >
      {children}
    </div>
  );
};
