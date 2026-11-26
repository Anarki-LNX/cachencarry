// Video 1: the main presentation, 1920 x 1080.
import type { ReactElement } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import tlJson from "./timelines/presentation.json";
import p1 from "./casts/problem-pc1.json";
import p2 from "./casts/problem-pc2.json";
import p3 from "./casts/problem-pc3.json";
import h1 from "./casts/hitmiss-pc1.json";
import h2 from "./casts/hitmiss-pc2.json";
import s1 from "./casts/shared-pc1.json";
import s2 from "./casts/shared-pc2.json";
import s3 from "./casts/shared-pc3.json";
import st from "./casts/tut-04-status.json";
import {
  Backdrop, type Cast, clamp, fade, Flow, KeySounds, Kicker, lerpRect, lineAt, Logo, Mark, Music, Node, Pill, ramp, sceneOf, sec, Sfx, Shot,
  seqFrame, Subtitles, Terminal, type Timeline, Title, Voice, Win,
} from "./kit";
import { BenchmarkCard, EndCard, FlowStrip } from "./blocks";
import { C, FONT, FPS, MONO } from "./theme";

export const tl = tlJson as Timeline;
const cast = (c: unknown) => c as Cast;

// ------------------------------------------------------------------ 1 problem
const Problem = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "problem");
  const casts = [cast(p1), cast(p2), cast(p3)];
  const starts = [10, 62, 114];
  const rate = 1.45;
  const head = lineAt(s, 2) - 10;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10), transform: `scale(${1 + frame / s.frames * 0.04})` }}>
      <Kicker style={{ position: "absolute", left: 0, right: 0, top: 96, textAlign: "center" }} color={C.amber} delay={head - 6}>DAS PROBLEM</Kicker>
      <Title text="IMMER WIEDER DIESELBEN DOWNLOADS?" size={74} align="center" delay={head} style={{ position: "absolute", left: 80, right: 80, top: 136 }} />
      {casts.map((c, i) => {
        const t = Math.max(0, ((frame - starts[i]) / FPS) * rate);
        return (
          <div key={i}>
            <Win x={90 + i * 440} y={250 + i * 86} w={880} h={490} title={`Rechner ${i + 1}  ·  Arch Linux  ·  lädt aus dem Internet`} delay={starts[i] - 8} accent={C.amber} glow={0.2}>
              <Terminal cast={c} t={t} fontSize={17.6} />
            </Win>
            <Sequence from={starts[i]} layout="none"><KeySounds cast={c} offset={0} rate={rate} volume={0.25} /></Sequence>
          </div>
        );
      })}
      <div style={{ position: "absolute", right: 90, top: 250, textAlign: "right", fontFamily: FONT, opacity: ramp(frame, 40, 14) }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ fontFamily: MONO, fontSize: 28, color: C.amber, opacity: ramp(frame, starts[i] + 60, 10), lineHeight: 1.5 }}>↓ 29,9 MiB</div>
        ))}
        <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: C.soft, opacity: ramp(frame, starts[2] + 80, 12) }}>dasselbe Paket, dreimal</div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 2 idea
const Idea = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "idea");
  const serverAt = lineAt(s, 0) + 70;
  const cloud = { x: 1400, y: 190 }, server = { x: 1400, y: 520 };
  const pcs = [{ x: 1080, y: 800 }, { x: 1400, y: 800 }, { x: 1720, y: 800 }];
  const direct = 1 - ramp(frame, serverAt, 30);
  const srv = ramp(frame, serverAt, 26);
  const one = ramp(frame, serverAt + 30, 20);
  const local = ramp(frame, serverAt + 60, 20);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {pcs.map((p, i) => <Flow key={"d" + i} a={cloud} b={p} color={C.amber} on={direct * ramp(frame, 4 + i * 6, 14)} dashed speed={0.8} />)}
        <Flow a={cloud} b={server} color={C.amber} on={one} speed={0.7} count={3} width={5} size={13} />
        {pcs.map((p, i) => <Flow key={"l" + i} a={server} b={p} color={C.green} on={local} speed={1.3} count={5} />)}
        <Node x={cloud.x} y={cloud.y} label="Internet" sub="Paketmirror" kind="cloud" color={C.amber} glow={0.6} />
        <Node x={server.x} y={server.y} label="Cache & Carry" sub="dein Paketlager im LAN" kind="server" color={C.cyan} glow={srv} appear={srv} size={140} />
        {pcs.map((p, i) => <Node key={i} x={p.x} y={p.y} label={`Rechner ${i + 1}`} color={C.fg} glow={local * 0.6} appear={ramp(frame, i * 5, 14)} />)}
      </svg>
      <div style={{ position: "absolute", left: 1400 + 110, top: 330, fontFamily: MONO, fontSize: 24, color: C.amber, opacity: one }}>1 × 29,9 MiB</div>
      <div style={{ position: "absolute", left: 110, top: 290, width: 860 }}>
        <Kicker color={C.cyan} delay={lineAt(s, 0)}>DIE IDEE</Kicker>
        <Title text="EINMAL LADEN. | ÜBERALL NUTZEN." size={86} delay={lineAt(s, 1)} accent={["ÜBERALL"]} style={{ marginTop: 24 }} />
        <div style={{ marginTop: 34, fontFamily: FONT, fontSize: 32, fontWeight: 600, color: C.soft, lineHeight: 1.4, opacity: ramp(frame, lineAt(s, 1) + 30, 16) }}>
          Einmal laden. Lokal speichern.<br />Immer wieder verwenden.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 3 meet
const MONTAGE = [
  { src: "dash", label: "Dashboard", from: { x: 0, y: 0, w: 1600, h: 900 }, to: { x: 230, y: 130, w: 1360, h: 765 } },
  { src: "traffic", label: "Live-Traffic mit HIT und MISS", from: { x: 230, y: 60, w: 1370, h: 771 }, to: { x: 560, y: 220, w: 1040, h: 585 } },
  { src: "storage", label: "Gespeicherte Pakete", from: { x: 230, y: 60, w: 1370, h: 771 }, to: { x: 230, y: 100, w: 1200, h: 675 } },
  { src: "settings", label: "Einstellungen und Limits", from: { x: 230, y: 60, w: 1370, h: 771 }, to: { x: 230, y: 130, w: 1200, h: 675 } },
];
const Meet = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "meet");
  const logoOut = lineAt(s, 1) + 6;
  const logo = 1 - ramp(frame, logoOut, 14);
  const dashIn = logoOut + 6;
  const live = frame - dashIn;
  const liveLen = lineAt(s, 2) - dashIn + 20;
  const per = Math.max(40, Math.floor((s.frames - dashIn - liveLen) / 3));
  let content = null;
  if (live >= 0) {
    if (live < liveLen) {
      const p = ramp(live, 0, liveLen);
      content = (
        <Shot src={seqFrame("dash-live", 1 + live / FPS, 72)} srcW={1600} w={1360} h={765} view={lerpRect({ x: 0, y: 0, w: 1600, h: 900 }, { x: 230, y: 130, w: 1360, h: 765 }, p)}>
          {(map) => <Mark style={map({ x: 246, y: 150, w: 324, h: 252 })} at={50} color={C.green} label="TREFFERQUOTE LIVE" labelSide="bottom" />}
        </Shot>
      );
    } else {
      const k = Math.min(3, 1 + Math.floor((live - liveLen) / per));
      const m = MONTAGE[k];
      const p = ramp(live - liveLen - (k - 1) * per, 0, per);
      content = <Shot src={`footage/${m.src}.png`} srcW={1600} w={1360} h={765} view={lerpRect(m.from, m.to, p)} />;
    }
  }
  const k = live < liveLen ? 0 : Math.min(3, 1 + Math.floor((live - liveLen) / per));
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: logo, transform: `scale(${1 + ramp(frame, logoOut, 14) * 0.3})` }}>
        <Logo width={980} delay={12} />
        <div style={{ marginTop: 36, fontFamily: FONT, fontSize: 34, fontWeight: 600, color: C.soft, letterSpacing: 1, opacity: ramp(frame, 40, 20) }}>
          Das Paketlager für dein Netzwerk
        </div>
      </AbsoluteFill>
      {live >= 0 && (
        <Win x={280} y={58} w={1360} h={765 + 38} title="http://cachencarry.lan:8080" delay={dashIn} accent={C.green} glow={0.18}>
          {content}
        </Win>
      )}
      {live >= 0 && (
        <div style={{ position: "absolute", left: 280, top: 840 - 18, display: "flex", gap: 14 }}>
          <Pill key={k} color={C.green} border={`${C.green}88`} size={24}>{MONTAGE[k].label}</Pill>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 4 hit and miss
const HM = { missAt: 5.35, hitAt: 11.3, pc2: 8.676, pc1: 1.501, offset: 4.0 };
const HitMiss = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "hitmiss");
  const T = HM.offset + frame / FPS;
  const second = T >= HM.pc2;
  const c = second ? cast(h2) : cast(h1);
  const t = second ? T - HM.pc2 : T - HM.pc1;
  const missF = Math.round((HM.missAt - HM.offset) * FPS);
  const hitF = Math.round((HM.hitAt - HM.offset) * FPS);
  const row = (i: number) => 270 + 37 * i;
  const missRows = T >= HM.hitAt ? 6 : 0;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <Win x={60} y={70} w={780} h={470} title={second ? "Rechner 2  ·  pacman über Cache & Carry" : "Rechner 1  ·  pacman über Cache & Carry"} accent={second ? C.green : C.amber}>
        <Terminal cast={c} t={Math.max(0, t)} fontSize={15.4} />
      </Win>
      <Win x={880} y={70} w={980} h={566 + 38} title="Live-Traffic" delay={4} accent={C.cyan}>
        <Shot src={seqFrame("hitmiss", T, 180)} srcW={1600} w={980} h={566} view={{ x: 244, y: 228, w: 1336, h: 772 }}>
          {(map) => (
            <>
              {T >= HM.missAt && <Mark style={map({ x: 1058, y: row(missRows) - 2, w: 240, h: 37 * 6 })} color={C.amber} at={missF} />}
              {T >= HM.hitAt && <Mark style={map({ x: 1058, y: row(0) - 2, w: 240, h: 37 * 6 })} color={C.green} at={hitF} />}
            </>
          )}
        </Shot>
      </Win>
      <div style={{ position: "absolute", left: 0, right: 0, top: 690, display: "flex", justifyContent: "center", gap: 30 }}>
        {frame >= missF && <Pill color="#0a0e17" border={C.amber} size={30} style={{ background: C.amber, fontWeight: 800, letterSpacing: 1 }}>MISS = DOWNLOAD AUS DEM INTERNET</Pill>}
        {frame >= hitF && <Pill color="#0a0e17" border={C.green} size={30} style={{ background: C.green, fontWeight: 800, letterSpacing: 1 }}>HIT = AUS DEM LOKALEN CACHE</Pill>}
      </div>
      <FlowStrip y={790} frame={frame} missAt={missF - 20} hitAt={hitF - 10} />
      <Sfx at={missF} src="fx_miss" volume={0.5} />
      <Sfx at={hitF} src="fx_hit" volume={0.55} />
      <KeySounds cast={cast(h1)} offset={HM.offset - HM.pc1} volume={0.25} />
      <Sequence from={Math.round((HM.pc2 - HM.offset) * FPS)} layout="none"><KeySounds cast={cast(h2)} offset={0} volume={0.25} /></Sequence>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 5 shared downloads
const Shared = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "shared");
  const benchAt = lineAt(s, 1) - 12;
  const T = 2.0 + frame / FPS;
  const casts = [cast(s1), cast(s2), cast(s3)];
  const partA = 1 - ramp(frame, benchAt, 14);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <AbsoluteFill style={{ opacity: partA }}>
        <Win x={60} y={50} w={1800} h={340 + 38} title="Downloads  ·  Cache & Carry" delay={4} accent={C.amber} glow={0.2}>
          <Shot src={seqFrame("shared", T, 132)} srcW={1600} w={1800} h={340} view={{ x: 236, y: 120, w: 1360, h: 257 }}>
            {(map) => <Mark style={map({ x: 296, y: 224, w: 250, h: 28 })} color={C.cyan} at={66} label="EIN DOWNLOAD FÜR DREI RECHNER" labelSide="bottom" />}
          </Shot>
        </Win>
        {casts.map((c, i) => (
          <Win key={i} x={60 + i * 610} y={470} w={590} h={346} title={`Rechner ${i + 1}  ·  pacman -S go`} delay={10 + i * 4} accent={C.cyan}>
            <Terminal cast={c} t={Math.max(0, T - 1.2)} fontSize={11.4} />
          </Win>
        ))}
      </AbsoluteFill>
      {frame >= benchAt - 2 && (
        <Sequence from={benchAt} layout="none">
          <BenchmarkCard landscape />
        </Sequence>
      )}
      <Sfx at={benchAt} src="fx_whoosh" volume={0.4} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 6 homelab
const Homelab = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "homelab");
  const names = ["Proxmox", "Debian", "Ubuntu", "Arch Linux", "CachyOS"];
  const center = { x: 960, y: 420 };
  const pos = [{ x: 420, y: 230 }, { x: 1500, y: 230 }, { x: 330, y: 560 }, { x: 1590, y: 560 }, { x: 960, y: 760 }];
  const windowsAt = lineAt(s, 1) + 10;
  const ring = 1 - ramp(frame, windowsAt + 40, 16);
  const win = ramp(frame, windowsAt + 40, 16);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <AbsoluteFill style={{ opacity: ring }}>
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          {pos.map((p, i) => <Flow key={i} a={center} b={p} color={C.cyan} on={ramp(frame, lineAt(s, 0) + i * 12, 10)} speed={1.1} count={3} />)}
          <Node x={center.x} y={center.y} label="Cache & Carry" sub="ein gemeinsames Dach" kind="server" color={C.green} glow={1} size={150} />
        </svg>
        {names.map((n, i) => (
          <div key={n} style={{ position: "absolute", left: pos[i].x - 160, width: 320, top: pos[i].y - 34, display: "flex", justifyContent: "center" }}>
            <Pill delay={lineAt(s, 0) + i * 12} border={`${C.cyan}99`} size={30}>{n}</Pill>
          </div>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: win }}>
        <Win x={70} y={70} w={880} h={720 + 38} title="Cache-Module  ·  APT und Pacman stabil" delay={windowsAt + 40} accent={C.green}>
          <Shot src="footage/modules.png" srcW={1600} w={880} h={720} view={{ x: 236, y: 160, w: 680, h: 556 }} />
        </Win>
        <Win x={990} y={70} w={860} h={24 * 13.4 * 1.32 + 70} title="Proxmox Container  ·  systemd" delay={windowsAt + 48} accent={C.cyan}>
          <Terminal cast={cast(st)} t={Math.max(0, (frame - windowsAt - 48) / FPS + 2)} fontSize={13.4} highlight />
        </Win>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 7 call to action
const Cta = () => {
  const frame = useCurrentFrame();
  const s = sceneOf(tl, "cta");
  const endAt = lineAt(s, 1) - 6;
  const gh = 1 - ramp(frame, endAt, 14);
  const p = ramp(frame, 0, endAt);
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, interpolate(frame, [0, 10], [0, 1], clamp)) }}>
      <AbsoluteFill style={{ opacity: gh }}>
        <Win x={260} y={60} w={1400} h={760 + 38} title="github.com/Anarki-LNX/cachencarry" accent={C.cyan}>
          <Shot src="footage/github.png" srcW={1600} w={1400} h={760} view={lerpRect({ x: 0, y: 0, w: 1600, h: 869 }, { x: 160, y: 150, w: 1300, h: 706 }, p)}>
            {(map) => (
              <>
                <Mark style={map({ x: 186, y: 184, w: 222, h: 34 })} color={C.cyan} at={40} label="OPEN SOURCE" labelSide="bottom" />
                <Mark style={map({ x: 1128, y: 646, w: 170, h: 28 })} color={C.green} at={90} label="APACHE 2.0" labelSide="bottom" />
              </>
            )}
          </Shot>
        </Win>
      </AbsoluteFill>
      {frame >= endAt - 2 && (
        <Sequence from={endAt} layout="none">
          <EndCard landscape lines={["DEIN NETZWERK. DEIN PAKETLAGER.", "JETZT AUF GITHUB ENTDECKEN"]} badge="STERN GEBEN • AUSPROBIEREN" />
        </Sequence>
      )}
      <Sfx at={endAt} src="fx_logo" volume={0.55} />
    </AbsoluteFill>
  );
};

const SCENES: Record<string, () => ReactElement> = { problem: Problem, idea: Idea, meet: Meet, hitmiss: HitMiss, shared: Shared, homelab: Homelab, cta: Cta };

export const Presentation = ({ subtitles = true }: { subtitles?: boolean }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Backdrop />
    {tl.scenes.map((s) => {
      const Comp = SCENES[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
          <Comp />
        </Sequence>
      );
    })}
    {tl.scenes.slice(1).map((s) => <Sfx key={s.id} at={s.start - 8} src="fx_whoosh" volume={0.35} />)}
    <Sfx at={sceneOf(tl, "meet").start + 12} src="fx_impact" volume={0.5} />
    <Voice tl={tl} />
    <Music tl={tl} src="audio/music_presentation.wav" base={0.55} duck={0.2} />
    {subtitles && <Subtitles tl={tl} />}
  </AbsoluteFill>
);

export const PRESENTATION_FRAMES = tl.frames;
export { sec };
