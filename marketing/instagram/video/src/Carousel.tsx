import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { Rect } from "./parts";
import { C, FONT, MONO } from "./theme";

export const SLIDES = 8;
const W = 1080;
const H = 1350;
const PAD = 84;

/** Static brand background for a 4:5 slide. */
const Backdrop = ({ glow = "top" }: { glow?: "top" | "bottom" }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, #0d1422 0%, ${C.bg} 50%, #070a11 100%)` }}>
    <div
      style={{
        position: "absolute", left: glow === "top" ? -200 : 300, top: glow === "top" ? -300 : 700, width: 1100, height: 1100, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(52,211,153,0.200) 0%, transparent 65%)", filter: "blur(40px)",
      }}
    />
    <div
      style={{
        position: "absolute", left: glow === "top" ? 500 : -300, top: glow === "top" ? 700 : -200, width: 1000, height: 1000, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(96,165,250,0.140) 0%, transparent 65%)", filter: "blur(40px)",
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${C.line}55 1px, transparent 1px), linear-gradient(90deg, ${C.line}55 1px, transparent 1px)`,
        backgroundSize: "90px 90px", maskImage: "radial-gradient(ellipse at 50% 40%, black 10%, transparent 72%)", opacity: 0.45,
      }}
    />
  </AbsoluteFill>
);

/** Logo and page number on every slide. */
const Frame = ({ n, children, glow }: { n: number; children: ReactNode; glow?: "top" | "bottom" }) => (
  <AbsoluteFill style={{ fontFamily: FONT, color: C.fg }}>
    <Backdrop glow={glow} />
    <div style={{ position: "absolute", left: PAD, top: 62, display: "flex", alignItems: "center", gap: 14 }}>
      <Img src={staticFile("mark.svg")} style={{ width: 52, height: 52 }} />
      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>
        Cache <span style={{ color: C.green }}>&</span> Carry
      </span>
    </div>
    <div style={{ position: "absolute", right: PAD, top: 74, fontSize: 26, fontWeight: 600, color: C.muted }}>
      {n} / {SLIDES}
    </div>
    {children}
    {n < SLIDES && (
      <div style={{ position: "absolute", right: PAD, bottom: 60, fontSize: 28, fontWeight: 700, color: C.green }}>Swipe →</div>
    )}
  </AbsoluteFill>
);

const Kicker = ({ children, top }: { children: ReactNode; top: number }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top, fontSize: 28, fontWeight: 700, letterSpacing: 5, color: C.green }}>{children}</div>
);

const Title = ({ children, top, size = 86 }: { children: ReactNode; top: number; size?: number }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top, fontSize: size, lineHeight: 1.05, fontWeight: 850, letterSpacing: -2.5, whiteSpace: "pre-line" }}>
    {children}
  </div>
);

const Body = ({ children, top }: { children: ReactNode; top: number }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top, fontSize: 36, lineHeight: 1.4, color: C.muted }}>{children}</div>
);

/** A cut-out of a recorded screen in a rounded card, with optional highlights. */
const Shot = ({ src, sourceWidth, view, top, width = W - PAD * 2, marks = [] }: { src: string; sourceWidth: number; view: Rect; top: number; width?: number; marks?: { r: Rect; color?: string }[] }) => {
  const scale = width / view.w;
  return (
    <div
      style={{
        position: "absolute", left: (W - width) / 2, top, width, height: view.h * scale, borderRadius: 28, overflow: "hidden", background: C.bg,
        border: `2px solid ${C.line}`, boxShadow: "0 40px 110px rgba(0,0,0,0.600), 0 0 80px rgba(52,211,153,0.120)",
      }}
    >
      <Img src={staticFile(src)} style={{ position: "absolute", left: -view.x * scale, top: -view.y * scale, width: sourceWidth * scale, maxWidth: "none" }} />
      {marks.map(({ r, color = C.green }, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: (r.x - view.x) * scale, top: (r.y - view.y) * scale, width: r.w * scale, height: r.h * scale, borderRadius: 12,
            border: `4px solid ${color}`, boxShadow: `0 0 30px ${color}, inset 0 0 20px ${color}44`,
          }}
        />
      ))}
    </div>
  );
};

const Code = ({ lines, top, label }: { lines: string[]; top: number; label?: string }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top }}>
    {label && <div style={{ fontSize: 26, fontWeight: 700, color: C.muted, marginBottom: 12 }}>{label}</div>}
    <div style={{ borderRadius: 22, border: `2px solid ${C.line}`, background: "rgba(7,10,17,0.900)", padding: "26px 30px" }}>
      {lines.map((l, i) => (
        <div key={i} style={{ fontFamily: MONO, fontSize: 27, lineHeight: 1.6, color: l.startsWith("#") ? C.muted : C.fg, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {l}
        </div>
      ))}
    </div>
  </div>
);

const Pill = ({ children, color = C.fg, style }: { children: ReactNode; color?: string; style?: CSSProperties }) => (
  <div style={{ fontSize: 32, fontWeight: 650, color, padding: "14px 28px", borderRadius: 999, border: `2px solid ${C.line}`, background: "rgba(17,24,39,0.880)", ...style }}>
    {children}
  </div>
);

const Row = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
  <div style={{ display: "flex", gap: 26, alignItems: "flex-start" }}>
    <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 34, background: "rgba(52,211,153,0.120)", border: `2px solid ${C.green}55` }}>{icon}</div>
    <div>
      <div style={{ fontSize: 38, fontWeight: 750 }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 30, lineHeight: 1.35, color: C.muted }}>{text}</div>
    </div>
  </div>
);

const slides: Record<number, ReactNode> = {
  // 1. Cover
  1: (
    <Frame n={1}>
      <Kicker top={330}>FOR LINUX HOMELABS</Kicker>
      <Title top={380} size={96}>
        {"Stop downloading\nthe same update\n"}
        <span style={{ color: C.green }}>five times.</span>
      </Title>
      <Body top={740}>One small cache on your network. The first machine downloads, every other machine carries it home at LAN speed.</Body>
      <div style={{ position: "absolute", left: PAD, top: 960, display: "flex", gap: 16 }}>
        <Pill color={C.green}>Free</Pill>
        <Pill>Open source</Pill>
        <Pill>Self hosted</Pill>
      </div>
    </Frame>
  ),
  // 2. How it works
  2: (
    <Frame n={2} glow="bottom">
      <Kicker top={190}>HOW IT WORKS</Kicker>
      <Title top={250}>{"Download once.\nCarry out forever."}</Title>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 560, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <Pill style={{ fontSize: 36 }}>🌐 The Internet</Pill>
        <div style={{ height: 70, width: 4, background: C.blue, margin: "6px 0" }} />
        <div style={{ fontSize: 28, color: C.blue, marginTop: -60, marginLeft: 260, marginBottom: 34 }}>1 download</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 38px", borderRadius: 26, background: "rgba(52,211,153,0.120)", border: `3px solid ${C.green}`, boxShadow: `0 0 70px ${C.green}55` }}>
          <Img src={staticFile("mark.svg")} style={{ width: 70, height: 70 }} />
          <span style={{ fontSize: 44, fontWeight: 850 }}>Cache <span style={{ color: C.green }}>&</span> Carry</span>
        </div>
        <svg width="912" height="120" style={{ marginTop: 6 }}>
          {[76, 266, 456, 646, 836].map((x) => (
            <path key={x} d={`M456 0 C456 60, ${x} 50, ${x} 120`} stroke={C.green} strokeWidth="4" fill="none" />
          ))}
        </svg>
        <div style={{ display: "flex", gap: 12, width: 912, justifyContent: "space-between" }}>
          {["Arch", "CachyOS", "Debian", "Ubuntu", "Proxmox"].map((d) => (
            <div key={d} style={{ width: 168, textAlign: "center", fontSize: 26, fontWeight: 700, padding: "16px 0", borderRadius: 18, border: `2px solid ${C.line}`, background: C.panel }}>{d}</div>
          ))}
        </div>
        <div style={{ marginTop: 26, fontSize: 30, color: C.green, fontWeight: 650 }}>every other machine: LAN speed</div>
      </div>
    </Frame>
  ),
  // 3. Shared downloads
  3: (
    <Frame n={3}>
      <Kicker top={190}>SHARED DOWNLOADS</Kicker>
      <Title top={250}>{"3 machines ask.\n1 download runs."}</Title>
      <Shot
        src="footage/downloads/030.jpg" sourceWidth={720} top={500} view={{ x: 14, y: 200, w: 500, h: 250 }}
        marks={[{ r: { x: 176, y: 226, w: 98, h: 24 } }, { r: { x: 30, y: 288, w: 480, h: 18 }, color: C.blue }]}
      />
      <Body top={1010}>Machines asking for the same file at the same time share one download and are fed while it is still arriving.</Body>
    </Frame>
  ),
  // 4. Live dashboard
  4: (
    <Frame n={4} glow="bottom">
      <Kicker top={190}>LIVE DASHBOARD</Kicker>
      <Title top={250}>{"See what your\ncache saves."}</Title>
      <Shot
        src="footage/dash-live/040.jpg" sourceWidth={720} top={500} width={760} view={{ x: 10, y: 135, w: 700, h: 548 }}
        marks={[{ r: { x: 366, y: 416, w: 334, h: 122 } }, { r: { x: 20, y: 550, w: 334, h: 122 }, color: C.blue }]}
      />
      <Body top={1120}>Hit ratio, saved bandwidth, active clients and running downloads, updated every second.</Body>
    </Frame>
  ),
  // 5. Clients and traffic
  5: (
    <Frame n={5}>
      <Kicker top={190}>EVERY CLIENT, EVERY REQUEST</Kicker>
      <Title top={250}>{"MISS once.\nHIT forever."}</Title>
      <Shot src="footage/clients.png" sourceWidth={720} top={500} view={{ x: 10, y: 150, w: 700, h: 260 }} marks={[{ r: { x: 122, y: 222, w: 78, h: 188 } }]} />
      <Shot src="footage/traffic/050.jpg" sourceWidth={1120} top={860} view={{ x: 560, y: 190, w: 560, h: 205 }} marks={[{ r: { x: 1028, y: 210, w: 90, h: 180 } }]} />
    </Frame>
  ),
  // 6. Why trust it
  6: (
    <Frame n={6} glow="bottom">
      <Kicker top={190}>BUILT FOR YOUR LAN</Kicker>
      <Title top={250}>{"Small, safe,\nand honest."}</Title>
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 520, display: "flex", flexDirection: "column", gap: 46 }}>
        <Row icon="🔏" title="Signatures stay intact" text="Packages pass through byte for byte. apt and pacman keep verifying them. No TLS interception." />
        <Row icon="📦" title="Stored once" text="Every file is kept by its SHA-256 hash, with limits, pinning and integrity checks." />
        <Row icon="⚡" title="959 ms → 9 ms" text="An 8.6 MiB package list, from the Internet and from the cache in our test." />
        <Row icon="🪶" title="One small binary" text="About 13 MB of memory when idle. Runs in an unprivileged Proxmox LXC." />
      </div>
    </Frame>
  ),
  // 7. Setup
  7: (
    <Frame n={7}>
      <Kicker top={190}>SET UP IN MINUTES</Kicker>
      <Title top={250} size={80}>{"Install it.\nPoint your machines."}</Title>
      <Code
        top={500} label="On a Debian or Ubuntu box, or in a Proxmox LXC"
        lines={["tar xzf cachencarry-*-linux-amd64.tar.gz", "cd cachencarry-*-linux-amd64", "sudo ./scripts/install.sh"]}
      />
      <Code top={790} label="Arch and CachyOS: first line of the mirrorlist" lines={["Server = http://<cache>:8080/pacman/", "         archlinux/$repo/os/$arch"]} />
      <Code top={1010} label="Debian and Ubuntu: in your sources" lines={["URIs: http://<cache>:8080/apt/debian"]} />
    </Frame>
  ),
  // 8. Call to action
  8: (
    <Frame n={8} glow="bottom">
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Img src={staticFile("mark.svg")} style={{ width: 170, height: 170 }} />
        <div style={{ marginTop: 18, fontSize: 92, fontWeight: 850, letterSpacing: -3 }}>
          Cache <span style={{ color: C.green }}>&</span> Carry
        </div>
        <div style={{ marginTop: 12, fontSize: 36, color: C.muted }}>Your network's package warehouse.</div>
        <div style={{ marginTop: 40, display: "flex", gap: 16 }}>
          <Pill color={C.green}>Free for everyone</Pill>
          <Pill>Apache 2.0</Pill>
        </div>
        <div style={{ marginTop: 56, padding: "32px 50px", borderRadius: 30, background: C.green, boxShadow: `0 0 80px ${C.green}77` }}>
          <div style={{ fontSize: 46, fontWeight: 850, color: "#062c1f" }}>★ Star it on GitHub</div>
          <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 36, fontWeight: 700, color: "#062c1f" }}>github.com/Anarki-LNX/cachencarry</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 34, color: C.fg, fontWeight: 650 }}>💾 Save this post for your next homelab weekend</div>
        <div style={{ marginTop: 50, display: "flex", alignItems: "center", gap: 12, padding: "14px 28px", borderRadius: 999, border: `2px solid ${C.line}`, background: "rgba(17,24,39,0.850)", fontSize: 30 }}>
          <span style={{ color: C.amber }}>✦</span> Built with <b>Claude Code</b> <span style={{ color: C.muted }}>·</span> Claude Fable 5.2
        </div>
      </div>
    </Frame>
  ),
};

export const Carousel = ({ slide }: { slide: number }) => <AbsoluteFill style={{ background: C.bg }}>{slides[slide]}</AbsoluteFill>;
