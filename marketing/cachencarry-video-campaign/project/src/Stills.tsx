// Thumbnails (1280 x 720) and Shorts covers (1080 x 1920). Rendered with
// `remotion still`; every picture uses real recordings of the interface.
import type { ReactNode } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import p1 from "./casts/problem-pc1.json";
import c03 from "./casts/tut-03-install.json";
import { Backdrop, type Cast, Flow, Node, Shot, Terminal, Win } from "./kit";
import { C, FONT, MONO } from "./theme";

const Big = ({ children, size, color = C.fg, style }: { children: ReactNode; size: number; color?: string; style?: React.CSSProperties }) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 0.98, letterSpacing: -size * 0.03, color, textShadow: "0 6px 30px rgba(0,0,0,0.7)", ...style }}>{children}</div>
);
const LogoImg = ({ width, style }: { width: number; style?: React.CSSProperties }) => <Img src={staticFile("brand/logo-on-dark.svg")} style={{ width, ...style }} />;

export const ThumbMain = () => {
  const server = { x: 960, y: 380 };
  const pcs = [{ x: 720, y: 170 }, { x: 1180, y: 160 }, { x: 700, y: 600 }, { x: 1200, y: 610 }];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop glow={1.4} />
      <svg width={1280} height={720} style={{ position: "absolute" }}>
        {pcs.map((p, i) => <Flow key={i} a={server} b={p} color={C.cyan} on={1} count={4} width={5} size={14} />)}
        {pcs.map((p, i) => <Node key={i} x={p.x} y={p.y} label="" size={96} glow={0.8} color={C.cyan} />)}
        <Node x={server.x} y={server.y} label="" kind="server" size={170} glow={1} color={C.green} />
      </svg>
      <div style={{ position: "absolute", left: 50, top: 60, width: 620 }}>
        <Big size={92}>DEIN<br />NETZWERK<br />BRAUCHT<br /><span style={{ color: C.cyan }}>EINEN</span><br /><span style={{ color: C.green }}>CACHE!</span></Big>
      </div>
      <LogoImg width={430} style={{ position: "absolute", left: 50, bottom: 40 }} />
    </AbsoluteFill>
  );
};

export const ThumbTutorial = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Backdrop glow={1.3} />
    <div style={{ position: "absolute", left: 640, top: 60, transform: "perspective(1600px) rotateY(-10deg)", transformOrigin: "left" }}>
      <Win delay={-60} x={0} y={0} w={600} h={380} title="http://192.168.1.41:8080" accent={C.green} glow={0.3}>
        <Shot src="footage/tut-dash.png" srcW={1600} w={600} h={342} view={{ x: 230, y: 60, w: 1370, h: 781 }} />
      </Win>
    </div>
    <div style={{ position: "absolute", left: 560, top: 350 }}>
      <Win delay={-60} x={0} y={0} w={560} h={330} title="root@cc-tutorial" accent={C.cyan} glow={0.3}>
        {/* The real end of the install run, recorded in the tutorial container. */}
        <Terminal cast={cast(c03)} t={40} fontSize={13.4} firstRow={13} cursor={false} />
      </Win>
    </div>
    <svg width={1280} height={720} style={{ position: "absolute" }}>
      <Node x={1180} y={610} label="" kind="server" size={120} glow={1} color={C.cyan} />
    </svg>
    <div style={{ position: "absolute", left: 50, top: 70, width: 560 }}>
      <Big size={58} color={C.cyan}>CACHE & CARRY</Big>
      <Big size={96} style={{ marginTop: 10 }}>INSTAL<br />LIEREN</Big>
      <div style={{ marginTop: 26, fontFamily: FONT, fontSize: 32, fontWeight: 750, color: C.soft }}>Vom leeren Server<br />zum eigenen LAN-Cache</div>
    </div>
    <LogoImg width={340} style={{ position: "absolute", left: 50, bottom: 40 }} />
  </AbsoluteFill>
);

const Cover = ({ kicker, title, children, color = C.cyan }: { kicker: string; title: ReactNode; children: ReactNode; color?: string }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Backdrop glow={1.3} />
    {children}
    <div style={{ position: "absolute", left: 70, right: 110, top: 230 }}>
      <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 850, letterSpacing: 7, color }}>{kicker}</div>
      <Big size={124} style={{ marginTop: 20 }}>{title}</Big>
    </div>
    <LogoImg width={560} style={{ position: "absolute", left: 260, bottom: 400 }} />
  </AbsoluteFill>
);

const cast = (c: unknown) => c as Cast;

export const Cover1 = () => (
  <Cover kicker="SHORT 1  ·  DAS PROBLEM" title={<>DASSELBE<br />UPDATE.<br /><span style={{ color: C.amber }}>DREIMAL?</span></>} color={C.amber}>
    {[0, 1, 2].map((i) => (
      <Win key={i} delay={-60} x={80 + i * 50} y={760 + i * 150} w={860} h={330} title={`Rechner ${i + 1}`} accent={C.amber} glow={0.25}>
        <Terminal cast={cast(p1)} t={9} fontSize={14} cursor={false} />
      </Win>
    ))}
  </Cover>
);
export const Cover2 = () => (
  <Cover kicker="SHORT 2  ·  CACHE ERKLÄRT" title={<><span style={{ color: C.amber }}>MISS</span><br />ODER<br /><span style={{ color: C.green }}>HIT?</span></>}>
    <Win delay={-60} x={60} y={900} w={960} h={420} title="Live-Traffic" accent={C.green} glow={0.3}>
      <Shot src="footage/hitmiss/170.jpg" srcW={1600} w={960} h={382} view={{ x: 690, y: 250, w: 700, h: 279 }} />
    </Win>
  </Cover>
);
export const Cover3 = () => (
  <Cover kicker="SHORT 3  ·  TESTNETZWERK" title={<><span style={{ color: C.amber }}>959 ms</span><br />VS.<br /><span style={{ color: C.green }}>9 ms</span></>}>
    <div style={{ position: "absolute", left: 70, top: 980, fontFamily: FONT, fontSize: 40, fontWeight: 700, color: C.soft }}>
      Paketindex <span style={{ fontFamily: MONO, color: C.cyan }}>extra.db</span>, 8,6 MiB
      <div style={{ marginTop: 14, fontSize: 30, color: C.muted }}>Beispiel aus dem Testnetzwerk</div>
    </div>
  </Cover>
);
export const Cover4 = () => {
  const server = { x: 540, y: 900 };
  const pcs = [...Array(10)].map((_, i) => ({ x: 150 + (i % 5) * 195, y: 1080 + Math.floor(i / 5) * 150 }));
  return (
    <Cover kicker="SHORT 4  ·  GETEILTE DOWNLOADS" title={<>1 DOWNLOAD.<br /><span style={{ color: C.green }}>10 RECHNER.</span></>}>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <Flow a={{ x: 540, y: 720 }} b={server} color={C.amber} on={1} count={2} width={7} size={16} />
        {pcs.map((p, i) => <Flow key={i} a={server} b={p} color={C.green} on={1} count={2} width={3} size={9} />)}
        <Node x={540} y={710} label="" kind="cloud" color={C.amber} size={90} glow={0.7} />
        <Node x={server.x} y={server.y} label="" kind="server" color={C.cyan} size={120} glow={1} />
        {pcs.map((p, i) => <Node key={i} x={p.x} y={p.y} label="" size={70} glow={0.6} color={C.green} />)}
      </svg>
    </Cover>
  );
};
export const Cover5 = () => (
  <Cover kicker="SHORT 5  ·  OPEN SOURCE" title={<>WAS<br />KOSTET<br /><span style={{ color: C.green }}>DAS?</span></>} color={C.green}>
    <Win delay={-60} x={60} y={930} w={960} h={420} title="github.com/Anarki-LNX/cachencarry" accent={C.cyan} glow={0.3}>
      <Shot src="footage/github.png" srcW={1600} w={960} h={382} view={{ x: 140, y: 130, w: 1340, h: 533 }} />
    </Win>
  </Cover>
);
const Way6 = ({ n, label, color, y }: { n: number; label: string; color: string; y: number }) => (
  <div style={{ position: "absolute", left: 70, right: 130, top: y, height: 110, display: "flex", alignItems: "center", gap: 28, padding: "0 30px", borderRadius: 26, background: "rgba(13,20,36,0.92)", border: `2px solid ${color}`, boxShadow: `0 0 40px ${color}44` }}>
    <div style={{ width: 74, height: 74, borderRadius: 20, background: color, color: "#0a0e17", fontFamily: FONT, fontSize: 54, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
    <div style={{ fontFamily: FONT, fontSize: 52, fontWeight: 850, color: C.fg }}>{label}</div>
  </div>
);
export const Cover6 = () => (
  <Cover kicker="INSTALLATION" title={<>DREI WEGE.<br /><span style={{ color: C.green }}>EINE</span><br /><span style={{ color: C.green }}>VERSION.</span></>} color={C.green}>
    <Way6 n={1} label="Proxmox VE" color={C.green} y={800} />
    <Way6 n={2} label="Docker" color={C.cyan} y={940} />
    <Way6 n={3} label="Debian / Ubuntu" color={C.amber} y={1080} />
  </Cover>
);
