import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background, Caption, Chip, clamp, Footage, footageFrame, Headline, ramp, sceneOpacity, Spotlight } from "./parts";
import { C, FONT, MONO, SAFE, T } from "./theme";

export const TOTAL_FRAMES = T.end;

// Recording sizes in CSS pixels (see capture.mjs).
const PORTRAIT = 720;

/** Scene 1: hook. */
const Hook = () => {
  const frame = useCurrentFrame();
  const words = ["Same", "update.", "Every", "machine."];
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 90, 8), fontFamily: FONT }}>
      <div style={{ position: "absolute", left: SAFE.side, right: SAFE.side, top: 560, display: "flex", flexWrap: "wrap", gap: "0 26px" }}>
        {words.map((w, i) => {
          const p = ramp(frame, 4 + i * 7, 16);
          return (
            <span key={w + i} style={{ fontSize: 132, lineHeight: 1.04, fontWeight: 850, letterSpacing: -4, color: i % 2 ? C.fg : C.green, opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
              {w}
            </span>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: SAFE.side, top: 1120, fontSize: 52, fontWeight: 600, color: C.muted, opacity: ramp(frame, 40, 18) }}>
        Downloaded again. And again.
      </div>
    </AbsoluteFill>
  );
};

/** Scene 2: the problem. Every machine pulls the same package from the Internet. */
const Problem = () => {
  const frame = useCurrentFrame();
  const machines = ["Arch desktop", "CachyOS laptop", "Debian server", "Ubuntu box", "Proxmox host"];
  const cloudY = 520;
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 135, 8), fontFamily: FONT }}>
      <Headline kicker="THE PROBLEM">5 machines.{"\n"}5 downloads.</Headline>
      <div style={{ position: "absolute", left: 0, right: 0, top: cloudY, display: "flex", justifyContent: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: C.fg, padding: "22px 44px", borderRadius: 999, border: `2px solid ${C.line}`, background: C.panel, opacity: ramp(frame, 8, 14) }}>
          The Internet
        </div>
      </div>
      {machines.map((m, i) => {
        const y = 690 + i * 112;
        const appear = ramp(frame, 14 + i * 6, 14);
        const dot = ((frame - 20 - i * 6) % 34) / 34;
        return (
          <div key={m} style={{ position: "absolute", left: 0, right: 0, top: y, opacity: appear }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26, marginLeft: 150 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: C.red, boxShadow: `0 0 24px ${C.red}` }} />
              <div style={{ fontSize: 44, fontWeight: 600, color: C.fg, width: 430 }}>{m}</div>
              <div style={{ fontFamily: MONO, fontSize: 34, color: C.red }}>↓ 204 MiB</div>
            </div>
            <div style={{ position: "absolute", left: 160, top: -70 * (1 - dot) - 10, width: 4, height: 30, borderRadius: 2, background: C.red, opacity: frame > 20 + i * 6 ? 0.8 : 0 }} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute", left: SAFE.side, right: SAFE.side, top: 1290, textAlign: "center", fontSize: 52, fontWeight: 750, color: C.red,
          opacity: ramp(frame, 62, 14), transform: `scale(${0.9 + ramp(frame, 62, 14) * 0.1})`,
        }}
      >
        1 GiB of the same bytes
      </div>
    </AbsoluteFill>
  );
};

/** Scene 3: the brand appears. */
const Reveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
  const glow = interpolate(frame, [0, 20, 75], [0, 1, 0.6], clamp);
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 75, 8), fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", width: 760, height: 760, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.350), transparent 65%)", opacity: glow, filter: "blur(30px)" }} />
      <Img src={staticFile("mark.svg")} style={{ width: 300, height: 300, transform: `scale(${s}) rotate(${(1 - s) * -12}deg)` }} />
      <div style={{ marginTop: 30, fontSize: 110, fontWeight: 850, letterSpacing: -3, color: C.fg, opacity: ramp(frame, 10, 16) }}>
        Cache <span style={{ color: C.green }}>&</span> Carry
      </div>
      <div style={{ marginTop: 18, fontSize: 44, fontWeight: 600, color: C.muted, opacity: ramp(frame, 22, 16) }}>Download once. Carry out forever.</div>
    </AbsoluteFill>
  );
};

/** Scene 4: the live dashboard, pushing in on hit ratio, saved bandwidth and clients. */
const Dashboard = () => {
  const frame = useCurrentFrame();
  const push = ramp(frame, 30, 100);
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 150, 10) }}>
      <Headline kicker="THE FIX">One cache for{"\n"}your whole LAN.</Headline>
      <Footage
        src={footageFrame("dash-live", frame, 48, 6)} sourceWidth={PORTRAIT} width={820} top={600}
        from={{ x: 0, y: 100, w: 720, h: 720 }} to={{ x: 10, y: 135, w: 690, h: 690 }} progress={push}
      >
        {(scale, view) => (
          <>
            <Spotlight rect={{ x: 20, y: 148, w: 334, h: 256 }} scale={scale} view={view} at={28} />
            <Spotlight rect={{ x: 366, y: 416, w: 334, h: 122 }} scale={scale} view={view} at={62} color={C.blue} />
            <Spotlight rect={{ x: 20, y: 550, w: 334, h: 122 }} scale={scale} view={view} at={92} />
          </>
        )}
      </Footage>
    </AbsoluteFill>
  );
};

/** Scene 5: the star. Three machines, one download. */
const Downloads = () => {
  const frame = useCurrentFrame();
  const push = ramp(frame, 20, 90);
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 165, 10) }}>
      <Headline kicker="LIVE">3 machines.{"\n"}1 download.</Headline>
      <Footage
        src={footageFrame("downloads", frame, 54, 4)} sourceWidth={PORTRAIT} width={980} top={680}
        from={{ x: 0, y: 150, w: 720, h: 420 }} to={{ x: 20, y: 205, w: 520, h: 303 }} progress={push}
      >
        {(scale, view) => (
          <>
            <Spotlight rect={{ x: 176, y: 226, w: 98, h: 24 }} scale={scale} view={view} at={55} />
            <Spotlight rect={{ x: 30, y: 288, w: 500, h: 18 }} scale={scale} view={view} at={85} color={C.blue} />
          </>
        )}
      </Footage>
      <FanIn />
    </AbsoluteFill>
  );
};

/** Three client badges fly into one download. */
const FanIn = () => {
  const frame = useCurrentFrame();
  const clients = ["10.0.10.11", "10.0.10.12", "10.0.10.14"];
  const merge = ramp(frame, 100, 22);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 1300, height: 120, fontFamily: FONT }}>
      {clients.map((c, i) => {
        const p = ramp(frame, 40 + i * 8, 16);
        const x = (i - 1) * 320 * (1 - merge);
        return (
          <div
            key={c}
            style={{
              position: "absolute", left: 540 - 150 + x, top: 0, width: 300, textAlign: "center", fontFamily: MONO, fontSize: 32, fontWeight: 700, color: C.blue,
              padding: "14px 0", borderRadius: 18, border: `2px solid ${C.blue}66`, background: "rgba(17,24,39,0.900)", opacity: p * (1 - merge * 0.85),
              transform: `translateY(${(1 - p) * 30}px)`,
            }}
          >
            {c}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute", left: 540 - 230, top: -8, width: 460, textAlign: "center", fontSize: 40, fontWeight: 800, color: "#062c1f", padding: "18px 0",
          borderRadius: 22, background: C.green, boxShadow: `0 0 60px ${C.green}88`, opacity: merge, transform: `scale(${0.8 + merge * 0.2})`,
        }}
      >
        1 download for all 3
      </div>
    </div>
  );
};

/** Scene 6: active clients. */
const Clients = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 105, 10) }}>
      <Headline kicker="EVERY CLIENT">Who saved{"\n"}how much.</Headline>
      <Footage
        src="footage/clients.png" sourceWidth={PORTRAIT} width={980} top={680}
        from={{ x: 10, y: 150, w: 700, h: 312 }} to={{ x: 10, y: 150, w: 470, h: 210 }} progress={ramp(frame, 15, 80)}
      >
        {(scale, view) => (
          <>
            <Spotlight rect={{ x: 30, y: 154, w: 200, h: 32 }} scale={scale} view={view} at={24} />
            <Spotlight rect={{ x: 122, y: 222, w: 78, h: 230 }} scale={scale} view={view} at={50} />
          </>
        )}
      </Footage>
    </AbsoluteFill>
  );
};

/** Scene 7: the traffic log shows HIT after HIT. */
const Traffic = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 105, 10) }}>
      <Headline kicker="EVERY REQUEST">MISS once.{"\n"}HIT forever.</Headline>
      <Footage
        src={footageFrame("traffic", frame, 54, 28)} sourceWidth={1120} width={980} top={680}
        from={{ x: 380, y: 190, w: 740, h: 520 }} to={{ x: 560, y: 190, w: 560, h: 394 }} progress={ramp(frame, 10, 80)}
      >
        {(scale, view) => <Spotlight rect={{ x: 1028, y: 262, w: 90, h: 320 }} scale={scale} view={view} at={50} />}
      </Footage>
    </AbsoluteFill>
  );
};

/** Scene 8: speed and the Linux family. */
const Speed = () => {
  const frame = useCurrentFrame();
  const count = Math.round(interpolate(frame, [8, 40], [959, 9], { ...clamp }));
  const distros = ["Arch", "CachyOS", "Debian", "Ubuntu", "Proxmox"];
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, 75, 8), fontFamily: FONT }}>
      <div style={{ position: "absolute", left: SAFE.side, right: SAFE.side, top: 470, textAlign: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 5, color: C.green, opacity: ramp(frame, 0, 12) }}>8.6 MiB PACKAGE LIST</div>
        <div style={{ marginTop: 10, fontSize: 230, fontWeight: 850, letterSpacing: -8, color: C.fg, fontVariantNumeric: "tabular-nums" }}>
          {count}
          <span style={{ fontSize: 110, color: C.muted }}> ms</span>
        </div>
        <div style={{ fontSize: 40, color: C.muted, opacity: ramp(frame, 40, 12) }}>Internet: 959 ms. Your LAN: 9 ms.</div>
      </div>
      <div style={{ position: "absolute", left: SAFE.side, right: SAFE.side, top: 1050, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18 }}>
        {distros.map((d, i) => (
          <Chip key={d} delay={20 + i * 5}>{d}</Chip>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Scene 9: call to action. */
const CallToAction = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 15 } });
  const shimmer = (frame % 60) / 60;
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, 10], [0, 1], clamp), fontFamily: FONT, alignItems: "center" }}>
      <Img src={staticFile("mark.svg")} style={{ marginTop: 360, width: 190, height: 190, transform: `scale(${s})` }} />
      <div style={{ marginTop: 18, fontSize: 96, fontWeight: 850, letterSpacing: -3, color: C.fg }}>
        Cache <span style={{ color: C.green }}>&</span> Carry
      </div>
      <div style={{ marginTop: 34, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 940 }}>
        <Chip delay={10} color={C.green}>Free for everyone</Chip>
        <Chip delay={16}>Open source</Chip>
        <Chip delay={22}>Made for Linux homelabs</Chip>
      </div>
      <div
        style={{
          marginTop: 70, padding: "34px 46px", borderRadius: 30, textAlign: "center", opacity: ramp(frame, 32, 16), transform: `translateY(${(1 - ramp(frame, 32, 16)) * 30}px)`,
          background: `linear-gradient(110deg, ${C.green} ${shimmer * 100 - 30}%, #6ee7b7 ${shimmer * 100}%, ${C.green} ${shimmer * 100 + 30}%)`,
          boxShadow: `0 0 80px rgba(52,211,153,0.450)`,
        }}
      >
        <div style={{ fontSize: 46, fontWeight: 800, color: "#062c1f" }}>★ Star it on GitHub</div>
        <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 38, fontWeight: 700, color: "#062c1f" }}>github.com/Anarki-LNX/cachencarry</div>
      </div>
      <div style={{ marginTop: 40, fontSize: 38, color: C.muted, opacity: ramp(frame, 48, 16) }}>Install it. Share it. Make it better.</div>
      <div
        style={{
          marginTop: 46, display: "flex", alignItems: "center", gap: 14, padding: "14px 28px", borderRadius: 999, border: `2px solid ${C.line}`,
          background: "rgba(17,24,39,0.850)", fontSize: 32, color: C.fg, opacity: ramp(frame, 62, 16),
        }}
      >
        <span style={{ color: C.amber }}>✦</span> Built with <b>Claude Code</b> <span style={{ color: C.muted }}>·</span> Claude Fable 5.2
      </div>
    </AbsoluteFill>
  );
};

const scenes: { from: number; to: number; el: ReactElement; caption?: string }[] = [
  { from: T.hook, to: T.problem, el: <Hook /> },
  { from: T.problem, to: T.logo, el: <Problem />, caption: "Every Linux box pulls the same packages from the Internet." },
  { from: T.logo, to: T.dashboard, el: <Reveal /> },
  { from: T.dashboard, to: T.downloads, el: <Dashboard />, caption: "Cache & Carry keeps every package on your own network." },
  { from: T.downloads, to: T.clients, el: <Downloads />, caption: "Three machines want the same file. Only one download runs." },
  { from: T.clients, to: T.traffic, el: <Clients />, caption: "See every active client and what it saved." },
  { from: T.traffic, to: T.speed, el: <Traffic />, caption: "The first fetch comes from the Internet. The rest come from your LAN." },
  { from: T.speed, to: T.cta, el: <Speed />, caption: "Pacman and APT under one roof." },
  { from: T.cta, to: T.end, el: <CallToAction /> },
];

export const Reel = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Background />
    {scenes.map((s) => (
      <Sequence key={s.from} from={s.from} durationInFrames={s.to - s.from}>
        {s.el}
        {s.caption && <Caption text={s.caption} length={s.to - s.from} />}
      </Sequence>
    ))}
    <Audio src={staticFile("audio/bed.m4a")} volume={(f) => interpolate(f, [0, 20, T.end - 40, T.end], [0, 1, 1, 0], clamp)} />
  </AbsoluteFill>
);
