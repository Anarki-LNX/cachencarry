// Video 2: installation tutorial, 1920 x 1080. Every terminal and browser
// picture is a real recording of the installation in a fresh Proxmox
// container (CT 130, Debian 13.6, release v0.2.1) and two real Debian clients.
import type { ReactElement } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import tlJson from "./timelines/tutorial.json";
import c01 from "./casts/tut-01-proxmox.json";
import c02 from "./casts/tut-02-server.json";
import c03 from "./casts/tut-03-install.json";
import c04 from "./casts/tut-04-status.json";
import c05 from "./casts/tut-05-token.json";
import c06 from "./casts/tut-06-client1.json";
import c07 from "./casts/tut-07-client2.json";
import c08 from "./casts/tut-08-files.json";
import {
  Backdrop, type Cast, clamp, fade, Flow, KeySounds, Kicker, lerpRect, lineAt, Logo, Mark, Music, Node, Pill, ramp, type Rect, type Scene, sceneOf,
  Sfx, Shot, seqFrame, Subtitles, Terminal, type Timeline, Title, Voice, Win,
} from "./kit";
import { EndCard } from "./blocks";
import { C, FONT, FPS, MONO } from "./theme";

export const tl = tlJson as Timeline;
const cast = (c: unknown) => c as Cast;
type S = Scene & { chapter?: number };

const CHAPTERS = ["Was bauen wir?", "Server vorbereiten", "Herunterladen und installieren", "Ersteinrichtung", "Ersten Client einrichten", "Cache testen", "Ergebnis"];
const LEAD = Math.round(2.0 * FPS); // chapter title time at the start of a chapter
const LIVE = { client1: 1.001, client2: 49.722, frames: 605 }; // tut-live.json marks

const isChapterStart = (s: S) => {
  const i = tl.scenes.findIndex((x) => x.id === s.id);
  return i > 0 && (tl.scenes[i - 1] as S).chapter !== s.chapter;
};

/** Big chapter title at the start of a chapter, then a small badge in the corner. */
const ChapterOverlay = ({ s }: { s: S }) => {
  const frame = useCurrentFrame();
  const n = s.chapter ?? 1;
  const start = isChapterStart(s);
  const big = start ? Math.min(ramp(frame, 0, 12), 1 - ramp(frame, LEAD - 14, 12)) : 0;
  return (
    <>
      {big > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: big, background: `rgba(9,13,22,${0.85 * big})` }}>
          <Kicker color={C.cyan} size={30}>{`KAPITEL ${n}`}</Kicker>
          <div style={{ marginTop: 18 }}><Title text={CHAPTERS[n - 1]} size={84} align="center" /></div>
        </AbsoluteFill>
      )}
      {n > 1 && (
        <div style={{ position: "absolute", left: 40, top: 22, display: "flex", alignItems: "center", gap: 12, fontFamily: FONT, opacity: start ? ramp(frame, LEAD - 8, 12) : 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: C.cyan }}>KAPITEL {n}</div>
          <div style={{ fontSize: 20, fontWeight: 650, color: C.soft }}>{CHAPTERS[n - 1]}</div>
        </div>
      )}
    </>
  );
};

/**
 * Plays a part [from, to] (seconds) of a recording during the scene. It
 * starts after the chapter title, runs in real time and holds the last
 * screen; if the scene is too short it runs faster (shown as a label).
 */
const TermPart = ({ s, c, from, to, title, start = 0, x = 268, y = 64, w = 1384, font = 22, minRate = 1 }: {
  s: S; c: Cast; from: number; to: number; title: string; start?: number; x?: number; y?: number; w?: number; font?: number; minRate?: number;
}) => {
  const frame = useCurrentFrame();
  const begin = start || (isChapterStart(s) ? LEAD - 6 : 6);
  const avail = (s.frames - begin - 24) / FPS;
  const rate = Math.max(minRate, (to - from) / avail);
  const t = Math.min(to, from + Math.max(0, ((frame - begin) / FPS) * rate));
  const h = c.rows * font * 1.32 + 32 + 38;
  return (
    <>
      <Win x={x} y={y} w={w} h={h} title={title} delay={isChapterStart(s) ? begin - 8 : -40} accent={C.cyan} glow={0.14}>
        <Terminal cast={c} t={t} fontSize={font} highlight />
      </Win>
      {rate > 1.3 && frame > begin && (
        <div style={{ position: "absolute", left: x + w - 190, top: y + 6, fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.amber }}>{`${rate < 2.75 ? (Math.round(rate * 2) / 2).toString().replace(".", ",") : Math.round(rate)}× schneller`}</div>
      )}
      <Sequence from={begin} layout="none"><KeySounds cast={c} offset={from} rate={rate} until={Math.round(((to - from) / rate) * FPS)} volume={0.22} /></Sequence>
    </>
  );
};

/** A still (or one frame of a sequence) with a slow camera move. */
const ShotPart = ({ s, src, from, to, title, children, x = 268, y = 64, w = 1384, h = 778, srcW = 1600 }: {
  s: S; src: string; from: Rect; to: Rect; title: string; children?: (map: (r: Rect) => React.CSSProperties) => React.ReactNode; x?: number; y?: number; w?: number; h?: number; srcW?: number;
}) => {
  const frame = useCurrentFrame();
  const begin = isChapterStart(s) ? LEAD - 6 : 4;
  const p = ramp(frame, begin, s.frames - begin);
  return (
    <Win x={x} y={y} w={w} h={h + 38} title={title} delay={begin - 6} accent={C.green} glow={0.14}>
      <Shot src={src} srcW={srcW} w={w} h={h} view={lerpRect(from, to, p)}>{children}</Shot>
    </Win>
  );
};

const row = (i: number) => 270 + 37 * i;
const TRAFFIC_VIEW = { x: 244, y: 228, w: 1336, h: 760 };

/** Terminal of a client next to the real Live-Traffic page, both from the same moment. */
const ClientSplit = ({ s, c, from, to, title, liveStart }: { s: S; c: Cast; from: number; to: number; title: string; liveStart: number }) => {
  const frame = useCurrentFrame();
  const begin = 6;
  const avail = (s.frames - begin - 24) / FPS;
  const rate = Math.max(1, (to - from) / avail);
  const t = Math.min(to, from + Math.max(0, ((frame - begin) / FPS) * rate));
  const T = liveStart + t;
  return (
    <>
      <Win x={40} y={64} w={930} h={24 * 14.6 * 1.32 + 70} title={title} accent={C.cyan}>
        <Terminal cast={c} t={t} fontSize={14.6} highlight />
      </Win>
      <Win x={1000} y={64} w={880} h={500 + 38} title="Dashboard  ·  Live-Traffic" delay={4} accent={C.green}>
        <Shot src={seqFrame("tut-live", T, LIVE.frames)} srcW={1600} w={880} h={500} view={{ x: 640, y: 228, w: 940, h: 534 }} />
      </Win>
      <Sequence from={begin} layout="none"><KeySounds cast={c} offset={from} rate={rate} volume={0.22} /></Sequence>
    </>
  );
};

// ------------------------------------------------------------------ scenes
const Title1 = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 130, top: 190, width: 980 }}>
        <Logo width={520} />
        <Kicker color={C.cyan} size={26} delay={10} style={{ marginTop: 50 }}>TUTORIAL</Kicker>
        <Title text="CACHE & CARRY INSTALLIEREN" size={92} delay={14} style={{ marginTop: 16 }} />
        <div style={{ marginTop: 26, fontFamily: FONT, fontSize: 40, fontWeight: 650, color: C.soft, opacity: ramp(frame, 30, 16) }}>Vom leeren Server zum eigenen LAN-Cache.</div>
      </div>
      <div style={{ position: "absolute", left: 1240, top: 200, width: 560, fontFamily: FONT }}>
        {CHAPTERS.map((c, i) => (
          <div key={c} style={{ display: "flex", gap: 18, alignItems: "baseline", marginBottom: 20, opacity: ramp(frame, 30 + i * 5, 12) }}>
            <div style={{ fontFamily: MONO, fontSize: 24, color: C.cyan, width: 34 }}>{i + 1}</div>
            <div style={{ fontSize: 30, fontWeight: 650, color: C.fg }}>{c}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Diagram = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "diagram");
  const cloud = { x: 520, y: 150 }, server = { x: 520, y: 420 };
  const pcs = [{ x: 300, y: 670 }, { x: 740, y: 670 }];
  const req = lineAt(s, 2);
  const rows: [string, string, string][] = [["CPU", "1 Kern", "2 Kerne"], ["RAM", "256 MB", "1 GB"], ["Speicher", "was du cachen willst, plus 10 % frei", ""], ["Netzwerk", "ein TCP Port (8080) im LAN", "1 Gbit/s"]];
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <Flow a={cloud} b={server} color={C.amber} on={ramp(frame, 20, 14)} count={2} width={5} size={12} speed={0.6} />
        {pcs.map((p, i) => <Flow key={i} a={server} b={p} color={C.green} on={ramp(frame, 60 + i * 10, 14)} speed={1.3} />)}
        <Node x={cloud.x} y={cloud.y} label="Internet" sub="Paketserver" kind="cloud" color={C.amber} glow={0.5} appear={ramp(frame, 4, 12)} />
        <Node x={server.x} y={server.y} label="Cache & Carry" sub="192.168.1.41:8080" kind="server" color={C.cyan} glow={1} appear={ramp(frame, 12, 12)} size={140} />
        {pcs.map((p, i) => <Node key={i} x={p.x} y={p.y} label={`Debian Client ${i + 1}`} glow={0.5} color={C.green} appear={ramp(frame, 50 + i * 10, 12)} />)}
      </svg>
      <div style={{ position: "absolute", left: 1000, top: 110, width: 820, fontFamily: FONT }}>
        <Kicker color={C.cyan} delay={lineAt(s, 1)}>UNTERSTÜTZT</Kicker>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
          {[["APT", "Debian, Ubuntu, Proxmox VE"], ["Pacman", "Arch Linux, CachyOS"]].map(([a, b], i) => (
            <Pill key={a} delay={lineAt(s, 1) + 6 + i * 8} border={`${C.green}99`} size={26}><span style={{ color: C.green }}>{a}</span>  {b}</Pill>
          ))}
          <Pill delay={lineAt(s, 1) + 26} border={C.line} size={22} color={C.muted}>HTTP Dateiserver: experimentell</Pill>
        </div>
        <div style={{ marginTop: 50, opacity: ramp(frame, req, 14) }}>
          <Kicker color={C.cyan}>HARDWARE LAUT DEPLOYMENT.MD</Kicker>
          <div style={{ marginTop: 18, borderRadius: 18, border: `2px solid ${C.line}`, background: "rgba(13,20,36,0.9)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 200px", padding: "14px 24px", fontSize: 20, fontWeight: 800, letterSpacing: 2, color: C.muted, borderBottom: `1px solid ${C.line}` }}>
              <div /> <div>MINIMUM</div> <div>KOMFORTABEL</div>
            </div>
            {rows.map(([a, b, c], i) => (
              <div key={a} style={{ display: "grid", gridTemplateColumns: "180px 1fr 200px", padding: "14px 24px", fontSize: 26, color: C.fg, borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none", opacity: ramp(frame, req + 6 + i * 5, 10) }}>
                <div style={{ fontWeight: 750, color: C.soft }}>{a}</div><div>{b}</div><div style={{ color: C.green }}>{c}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sc = (id: string) => sceneOf(tl, id) as S;
const SCENES: Record<string, () => ReactElement> = {
  title: Title1,
  diagram: Diagram,
  proxmox: () => <TermPart s={sc("proxmox")} c={cast(c01)} from={0} to={29.4} title="Proxmox Host  ·  root@pve" />,
  server: () => <TermPart s={sc("server")} c={cast(c02)} from={0} to={17.3} title="Konsole von CT 130  ·  root@cc-tutorial" />,
  download: () => <TermPart s={sc("download")} c={cast(c03)} from={0} to={21.5} title="root@cc-tutorial" />,
  install: () => <TermPart s={sc("install")} c={cast(c03)} from={21.5} to={33.5} title="root@cc-tutorial" />,
  status: () => <TermPart s={sc("status")} c={cast(c04)} from={0} to={9.9} title="root@cc-tutorial" />,
  browser: () => (
    <ShotPart s={sc("browser")} src="footage/tut-setup/000.jpg" from={{ x: 0, y: 0, w: 1600, h: 900 }} to={{ x: 400, y: 120, w: 800, h: 450 }} title="Browser  ·  http://192.168.1.41:8080" />
  ),
  token: () => <TermPart s={sc("token")} c={cast(c05)} from={0} to={7.1} title="root@cc-tutorial" />,
  form: () => {
    const frame = useCurrentFrame();
    const T = 1.2 + frame / FPS;
    const dash = T > 11.6;
    const view = dash ? { x: 0, y: 0, w: 1600, h: 900 } : { x: 360, y: 150, w: 880, h: 495 };
    return (
      <Win x={268} y={64} w={1384} h={778 + 38} title="Browser  ·  http://192.168.1.41:8080" accent={C.green}>
        <Shot src={seqFrame("tut-setup", T, 79)} srcW={1600} w={1384} h={778} view={view}>
          {(map) => !dash && T > 5.2 && (
            // The setup token is blurred: a frosted box over the input field.
            <div style={{ ...map({ x: 579, y: 611, w: 442, h: 32 }), backdropFilter: "blur(9px)", background: "rgba(148,163,184,0.25)", borderRadius: 6 }} />
          )}
        </Shot>
      </Win>
    );
  },
  client: () => <TermPart s={sc("client")} c={cast(c06)} from={0} to={8.1} title="Debian Client 1  ·  root@debian-client1" />,
  sources: () => <TermPart s={sc("sources")} c={cast(c06)} from={8.1} to={31.0} title="Debian Client 1  ·  root@debian-client1" />,
  dialog: () => (
    <ShotPart s={sc("dialog")} src="footage/tut-client-dialog.png" from={{ x: 236, y: 120, w: 1100, h: 619 }} to={{ x: 250, y: 330, w: 680, h: 382 }} title="Dashboard  ·  Cache-Module">
      {(map) => <Mark style={map({ x: 262, y: 418, w: 630, h: 186 })} color={C.cyan} at={70} label="CLIENTKONFIGURATION" labelSide="top" />}
    </ShotPart>
  ),
  apt1: () => <ClientSplit s={sc("apt1")} c={cast(c06)} from={31.0} to={46.7} title="Debian Client 1" liveStart={LIVE.client1} />,
  arch: () => (
    <ShotPart s={sc("arch")} src="footage/tut-modules.png" from={{ x: 236, y: 300, w: 1100, h: 619 }} to={{ x: 236, y: 560, w: 740, h: 416 }} title="Dashboard  ·  Cache-Module" />
  ),
  client2: () => <TermPart s={sc("client2")} c={cast(c07)} from={0} to={29.0} title="Debian Client 2  ·  root@debian-client2" />,
  apt2: () => <ClientSplit s={sc("apt2")} c={cast(c07)} from={29.0} to={41.8} title="Debian Client 2" liveStart={LIVE.client2} />,
  traffic: () => (
    <ShotPart s={sc("traffic")} src="footage/tut-live/500.jpg" from={TRAFFIC_VIEW} to={{ x: 560, y: 228, w: 1020, h: 580 }} title="Dashboard  ·  Live-Traffic">
      {(map) => (
        <>
          <Mark style={map({ x: 1098, y: row(0) - 2, w: 180, h: 37 * 10 })} color={C.green} at={20} label="HIT  ·  CLIENT 2" labelSide="top" />
          <Mark style={map({ x: 1098, y: row(10) - 2, w: 180, h: 37 * 9 })} color={C.amber} at={60} label="MISS  ·  CLIENT 1" labelSide="bottom" />
        </>
      )}
    </ShotPart>
  ),
  curl: () => <TermPart s={sc("curl")} c={cast(c07)} from={41.8} to={48.6} title="Debian Client 2" />,
  stats: () => (
    <ShotPart s={sc("stats")} src="footage/tut-dash.png" from={{ x: 236, y: 60, w: 1364, h: 767 }} to={{ x: 880, y: 120, w: 740, h: 416 }} title="Dashboard">
      {(map) => (
        <>
          <Mark style={map({ x: 920, y: 150, w: 322, h: 122 })} color={C.green} at={30} label="GESPART" labelSide="bottom" />
          <Mark style={map({ x: 1256, y: 150, w: 316, h: 122 })} color={C.amber} at={60} label="AUS DEM INTERNET" labelSide="bottom" />
        </>
      )}
    </ShotPart>
  ),
  files: () => <TermPart s={sc("files")} c={cast(c08)} from={0} to={16.8} title="root@cc-tutorial" />,
  tour: () => {
    const frame = useCurrentFrame();
    const s = sc("tour");
    const second = frame >= lineAt(s, 0) + 90;
    const third = frame >= lineAt(s, 1) - 6;
    const src = third ? "footage/tut-modules.png" : second ? "footage/tut-settings.png" : "footage/tut-storage.png";
    const title = third ? "Cache-Module" : second ? "Einstellungen" : "Speicher";
    return (
      <Win x={268} y={64} w={1384} h={778 + 38} title={`Dashboard  ·  ${title}`} accent={C.green}>
        <Shot key={src} src={src} srcW={1600} w={1384} h={778} view={second && !third ? { x: 236, y: 60, w: 1100, h: 619 } : { x: 0, y: 0, w: 1600, h: 900 }} />
      </Win>
    );
  },
  outro: () => {
    const frame = useCurrentFrame();
    return (
      <AbsoluteFill style={{ opacity: interpolate(frame, [0, 12], [0, 1], clamp) }}>
        <EndCard landscape lines={["DEIN PAKETLAGER IM NETZWERK", "QUELLCODE KOSTENLOS AUF GITHUB"]} badge="LASS EINEN STERN DA" />
      </AbsoluteFill>
    );
  },
};

export const Tutorial = ({ subtitles = true }: { subtitles?: boolean }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Backdrop glow={0.7} />
    {tl.scenes.map((s) => {
      const Comp = SCENES[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
          <Comp />
          <ChapterOverlay s={s as S} />
        </Sequence>
      );
    })}
    {tl.scenes.slice(1).filter((s) => isChapterStart(s as S)).map((s) => <Sfx key={s.id} at={s.start} src="fx_whoosh" volume={0.3} />)}
    <Voice tl={tl} />
    <Music tl={tl} src="audio/music_tutorial.wav" base={0.22} duck={0.08} />
    {subtitles && <Subtitles tl={tl} />}
  </AbsoluteFill>
);

export const TUTORIAL_FRAMES = tl.frames;
