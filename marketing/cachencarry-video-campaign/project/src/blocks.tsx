// Larger motion graphics used by several videos.
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, Kicker, Logo, Pill, ramp, Title } from "./kit";
import { C, FONT, MONO } from "./theme";

/** MISS → INTERNET → LOCAL CACHE → HIT → CLIENT, lighting up step by step. */
export const FlowStrip = ({ y, frame, missAt, hitAt, portrait = false, labels = ["LOKALER CACHE", "RECHNER"] }: { y: number; frame: number; missAt: number; hitAt: number; portrait?: boolean; labels?: [string, string] }) => {
  const steps = [
    { t: "MISS", c: C.amber, at: missAt },
    { t: "INTERNET", c: C.amber, at: missAt + 10 },
    { t: labels[0], c: C.cyan, at: missAt + 22 },
    { t: "HIT", c: C.green, at: hitAt },
    { t: labels[1], c: C.green, at: hitAt + 10 },
  ];
  const size = portrait ? 30 : 30;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", alignItems: "center", gap: portrait ? 10 : 18, flexWrap: "wrap", padding: portrait ? "0 40px" : 0 }}>
      {steps.map((s, i) => {
        const p = ramp(frame, s.at, 12);
        return (
          <div key={s.t} style={{ display: "flex", alignItems: "center", gap: portrait ? 10 : 18 }}>
            <div
              style={{
                fontFamily: FONT, fontSize: size, fontWeight: 800, letterSpacing: 2, padding: "10px 22px", borderRadius: 12,
                color: p > 0.5 ? "#0a0e17" : C.muted, background: p > 0.5 ? s.c : "rgba(13,20,36,0.9)", border: `2px solid ${p > 0.05 ? s.c : C.line}`,
                boxShadow: p > 0.5 ? `0 0 30px ${s.c}88` : "none", transform: `scale(${0.94 + p * 0.06})`,
              }}
            >
              {s.t}
            </div>
            {i < steps.length - 1 && <div style={{ fontFamily: FONT, fontSize: size, color: ramp(frame, steps[i + 1].at, 8) > 0.5 ? C.fg : C.line }}>→</div>}
          </div>
        );
      })}
    </div>
  );
};

/** The documented measurement from the first real client test. */
export const BenchmarkCard = ({ landscape = false, compact = false }: { landscape?: boolean; compact?: boolean }) => {
  const frame = useCurrentFrame();
  const W = landscape ? 1300 : 920;
  const barW = W - 80;
  const net = interpolate(frame, [20, 20 + 60], [0, 959], { ...clamp });
  const cache = interpolate(frame, [86, 92], [0, 9], { ...clamp });
  const fs = landscape ? 1 : 1.05;
  const row = (label: string, ms: number, max: number, color: string, show: number) => (
    <div style={{ marginTop: 34 * fs, opacity: show }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: FONT }}>
        <div style={{ fontSize: 34 * fs, fontWeight: 700, color: C.soft }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 64 * fs, fontWeight: 700, color }}>{Math.round(ms)} ms</div>
      </div>
      <div style={{ marginTop: 12, height: 22, borderRadius: 11, background: "#1a2234", overflow: "hidden" }}>
        <div style={{ width: Math.max(8, (ms / max) * barW), height: "100%", borderRadius: 11, background: color, boxShadow: `0 0 24px ${color}` }} />
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: landscape ? "flex-start" : "center", paddingTop: landscape ? 90 : 0 }}>
      <div style={{ width: W, padding: 40, borderRadius: 28, background: "rgba(13,20,36,0.92)", border: `2px solid ${C.line}`, boxShadow: "0 40px 120px rgba(0,0,0,0.6)", opacity: ramp(frame, 0, 12), transform: `translateY(${(1 - ramp(frame, 0, 16)) * 40}px)` }}>
        <Kicker color={C.amber} size={landscape ? 24 : 26}>BEISPIEL AUS DEM TESTNETZWERK</Kicker>
        <div style={{ marginTop: 14, fontFamily: FONT, fontSize: 40 * fs, fontWeight: 800, color: C.fg }}>
          Paketindex <span style={{ fontFamily: MONO, color: C.cyan }}>extra.db</span>, 8,6 MiB
        </div>
        {row("Aus dem Internet", net, 959, C.amber, ramp(frame, 12, 10))}
        {row("Aus dem Cache", cache, 959, C.green, ramp(frame, 80, 10))}
        {!compact && (
          <div style={{ marginTop: 34, fontFamily: FONT, fontSize: 22 * fs, lineHeight: 1.45, color: C.muted, opacity: ramp(frame, 100, 14) }}>
            Gemessen beim ersten echten Clienttest: CachyOS gegen Cache & Carry im Proxmox-Container.
            <br />
            Kein Garantiewert. Andere Pakete und Netzwerke liefern andere Zahlen.
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Logo, message and GitHub address. */
export const EndCard = ({ landscape = false, lines, badge, top, url = "github.com/Anarki-LNX/cachencarry" }: { landscape?: boolean; lines: string[]; badge?: string; top?: number; url?: string }) => {
  const frame = useCurrentFrame();
  const glow = 0.5 + 0.5 * Math.sin(frame / 18);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: top ?? (landscape ? 120 : 470), fontFamily: FONT }}>
      <div style={{ position: "absolute", left: "50%", top: (top ?? (landscape ? 120 : 470)) + 40, width: 900, height: 300, marginLeft: -450, background: `radial-gradient(ellipse, rgba(52,211,153,${0.16 + glow * 0.06}) 0%, transparent 70%)`, filter: "blur(30px)" }} />
      <Logo width={landscape ? 820 : 900} delay={0} />
      <div style={{ marginTop: landscape ? 36 : 60, display: "flex", flexDirection: "column", alignItems: "center", gap: landscape ? 10 : 18 }}>
        {lines.map((l, i) => (
          <Title key={l} text={l} size={landscape ? (i === 0 ? 58 : 34) : i === 0 ? 64 : 42} align="center" delay={14 + i * 14} color={i === 0 ? C.fg : C.cyan} />
        ))}
      </div>
      <div style={{ marginTop: landscape ? 30 : 50, fontFamily: MONO, fontSize: landscape ? 30 : 36, color: C.soft, opacity: ramp(frame, 40, 14) }}>{url}</div>
      <div style={{ marginTop: landscape ? 28 : 46, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {badge && <Pill delay={52} color={C.green} border={`${C.green}aa`} size={landscape ? 28 : 34}>{badge}</Pill>}
        <Pill delay={60} color={C.soft} size={landscape ? 28 : 34}>Open Source • Apache 2.0</Pill>
      </div>
      <div style={{ marginTop: landscape ? 22 : 36, fontSize: landscape ? 22 : 28, color: C.soft, opacity: 0.75 * ramp(frame, 70, 14) }}>Sprecherstimme synthetisch (Piper TTS)</div>
    </AbsoluteFill>
  );
};
