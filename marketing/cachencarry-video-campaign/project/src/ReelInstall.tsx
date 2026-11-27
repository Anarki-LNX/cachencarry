// Instagram Reels from the install video, German and English, 1080 x 1920.
// Same safe areas as the Shorts: text between y 200 and 1500, right margin 130 px.
// Problem, real MISS then HIT footage, the three ways to install, website.
// German: German text and Piper voice. English: English text, the English UI
// recording and the Kokoro voice. No burned-in subtitles (SRT files ship separately).
import { createContext, type ReactNode, useContext } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import tlDe from "./timelines/reel_install.json";
import tlEn from "./timelines/reel_install_en.json";
import p1 from "./casts/problem-pc1.json";
import p2 from "./casts/problem-pc2.json";
import p3 from "./casts/problem-pc3.json";
import h1 from "./casts/hitmiss-pc1.json";
import h2 from "./casts/hitmiss-pc2.json";
import e1 from "./casts/hitmiss-en-pc1.json";
import e2 from "./casts/hitmiss-en-pc2.json";
import hmEn from "../public/footage/hitmiss-en.json";
import {
  Backdrop, type Cast, clamp, fade, Flow, KeySounds, Kicker, lineAt, Logo, Mark, Music, Node, Pill, ramp, sceneOf, Sfx, Shot, seqFrame,
  Terminal, type Timeline, Title, Voice, Win,
} from "./kit";
import { PROXMOX_CMD } from "./Short06";
import { C, FONT, FPS, MONO } from "./theme";

const cast = (c: unknown) => c as Cast;

const DE = {
  hookKicker: "DEIN HOMELAB",
  hook: "DREI RECHNER. | DREIMAL DASSELBE UPDATE?",
  hookAccent: ["DREIMAL"],
  pc: (n: number) => `Rechner ${n}`,
  size: "↓ 29,9 MiB",
  solution: "EINMAL LADEN. | LOKAL NUTZEN.",
  solutionAccent: ["NUTZEN."],
  internet: "Internet",
  inLan: "in deinem Netzwerk",
  liveTraffic: "Live-Traffic im Dashboard",
  missPill: "MISS = AUS DEM INTERNET",
  hitPill: "HIT = AUS DEINEM CACHE",
  waysKicker: "INSTALLIEREN",
  ways: "DREI WEGE. | EINE VERSION.",
  w1: "EIN BEFEHL", w2: "AMD64 UND ARM64", w3: "RELEASE-PAKET",
  version: "ÜBERALL VERSION 0.2.3",
  end1: "DEIN EIGENER LAN-CACHE",
  end2: "KOSTENLOS · OPEN SOURCE",
  bio: "LINK IN DER BIO",
  follow: "FOLGEN FÜR MEHR HOMELAB",
  tts: "Sprecherstimme synthetisch (Piper TTS)",
};
const EN: typeof DE = {
  hookKicker: "YOUR HOMELAB",
  hook: "THREE MACHINES. | THE SAME UPDATE, THREE TIMES?",
  hookAccent: ["THREE", "TIMES"],
  pc: (n: number) => `Machine ${n}`,
  size: "↓ 29.9 MiB",
  solution: "DOWNLOAD ONCE. | USE IT LOCALLY.",
  solutionAccent: ["LOCALLY."],
  internet: "Internet",
  inLan: "in your network",
  liveTraffic: "Live traffic in the dashboard",
  missPill: "MISS = FROM THE INTERNET",
  hitPill: "HIT = FROM YOUR CACHE",
  waysKicker: "INSTALL",
  ways: "THREE WAYS. | ONE VERSION.",
  w1: "ONE COMMAND", w2: "AMD64 AND ARM64", w3: "RELEASE PACKAGE",
  version: "VERSION 0.2.3 EVERYWHERE",
  end1: "YOUR OWN LAN CACHE",
  end2: "FREE · OPEN SOURCE",
  bio: "LINK IN BIO",
  follow: "FOLLOW FOR MORE HOMELAB",
  tts: "Synthetic voice (Kokoro TTS)",
};

type Lang = { tl: Timeline; L: typeof DE; en: boolean };
const LANG_DE: Lang = { tl: tlDe as Timeline, L: DE, en: false };
const LANG_EN: Lang = { tl: tlEn as Timeline, L: EN, en: true };
const Ctx = createContext<Lang>(LANG_DE);
const useLang = () => useContext(Ctx);
const useScene = (id: string) => sceneOf(useLang().tl, id);

// ------------------------------------------------------------------ hook: three machines, three downloads
const Hook = () => {
  const frame = useCurrentFrame();
  const { L } = useLang();
  const s = useScene("hook");
  const casts = [cast(p1), cast(p2), cast(p3)];
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [s.frames - 8, s.frames], [1, 0], clamp) }}>
      <div style={{ position: "absolute", left: 70, right: 130, top: 220 }}>
        <Kicker color={C.amber} size={30}>{L.hookKicker}</Kicker>
        <div style={{ height: 20 }} />
        <Title text={L.hook} size={96} accent={L.hookAccent} delay={0} />
      </div>
      {casts.map((c, i) => (
        <div key={i}>
          <Win x={50 + i * 40} y={720 + i * 250} w={880} h={300} title={`${L.pc(i + 1)}  ·  Arch Linux`} delay={2 + i * 4} accent={C.amber} glow={0.2}>
            <Terminal cast={c} t={3 + (frame / FPS) * 1.8} fontSize={17.2} />
          </Win>
          <div style={{ position: "absolute", left: 50 + i * 40 + 640, top: 720 + i * 250 + 4, fontFamily: MONO, fontSize: 26, color: C.amber, opacity: ramp(frame, 10 + i * 6, 8) }}>{L.size}</div>
        </div>
      ))}
      <KeySounds cast={casts[0]} offset={3} rate={1.8} volume={0.18} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ solution: one download, the LAN serves the rest
const Solution = () => {
  const frame = useCurrentFrame();
  const { L } = useLang();
  const s = useScene("solution");
  const cloud = { x: 540, y: 520 }, server = { x: 540, y: 900 };
  const pcs = [{ x: 230, y: 1250 }, { x: 540, y: 1250 }, { x: 850, y: 1250 }];
  const srvAt = lineAt(s, 0) + 6;
  const direct = 1 - ramp(frame, srvAt, 24);
  const srv = ramp(frame, srvAt, 24);
  const local = ramp(frame, lineAt(s, 1), 18);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
      <div style={{ position: "absolute", left: 70, right: 130, top: 210 }}>
        <Title text={L.solution} size={88} accent={L.solutionAccent} delay={4} />
      </div>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {pcs.map((p, i) => <Flow key={"d" + i} a={cloud} b={p} color={C.amber} on={direct} dashed />)}
        <Flow a={cloud} b={server} color={C.amber} on={ramp(frame, srvAt + 24, 16)} count={3} width={6} size={14} speed={0.7} />
        {pcs.map((p, i) => <Flow key={"l" + i} a={server} b={p} color={C.green} on={local} speed={1.4} count={5} width={4} size={11} />)}
        <Node x={cloud.x} y={cloud.y} label={L.internet} kind="cloud" color={C.amber} glow={0.6} />
        <Node x={server.x} y={server.y} label="Cache & Carry" sub={L.inLan} kind="server" color={C.cyan} glow={srv} appear={srv} size={150} />
        {pcs.map((p, i) => <Node key={i} x={p.x} y={p.y} label={L.pc(i + 1)} glow={local * 0.7} color={local > 0.5 ? C.green : C.fg} />)}
      </svg>
      <Sfx at={srvAt} src="fx_impact" volume={0.35} />
      <Sfx at={lineAt(s, 1)} src="fx_hit" volume={0.4} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ real MISS, then real HIT
// German: the German UI recording. English: the same run filmed with the English UI.
const HM_DE = { name: "hitmiss", frames: 180, missAt: 5.35, hitAt: 11.3, pc2: 8.676, pc1: 1.501 };
const HM_EN = { name: "hitmiss-en", frames: hmEn.frames, missAt: hmEn.marks.missAt ?? 0, hitAt: hmEn.marks.hitAt ?? 0, pc2: hmEn.marks.pc2, pc1: hmEn.marks.pc1 };
const HitMiss = () => {
  const frame = useCurrentFrame();
  const { L, en } = useLang();
  const s = useScene("hitmiss");
  const HM = en ? HM_EN : HM_DE;
  const [c1, c2] = en ? [cast(e1), cast(e2)] : [cast(h1), cast(h2)];
  // The recording runs a little faster than real time so that the HIT lands
  // on the second sentence ("machine two ..."). The speed-up is at most 2x.
  const offset = HM.missAt - 0.5;
  const hitTarget = lineAt(s, 1) + 10;
  const k = Math.min(2, Math.max(1, (HM.hitAt - offset) / (hitTarget / FPS)));
  const T = offset + (frame / FPS) * k;
  const second = T >= HM.pc2;
  const c = second ? c2 : c1;
  const missF = Math.round(((HM.missAt - offset) / k) * FPS);
  const hitF = Math.round(((HM.hitAt - offset) / k) * FPS);
  const pc2F = Math.round(((HM.pc2 - offset) / k) * FPS);
  const row = (i: number) => 270 + 37 * i;
  const missRows = T >= HM.hitAt ? 6 : 0;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
      <Win x={60} y={210} w={960} h={400} title={`${L.pc(second ? 2 : 1)}  ·  pacman -S vim`} accent={second ? C.green : C.amber}>
        <Terminal cast={c} t={Math.max(0, second ? T - HM.pc2 : T - HM.pc1)} fontSize={13.6} />
      </Win>
      <div style={{ position: "absolute", left: 60, right: 60, top: 650, height: 70, display: "flex", justifyContent: "center" }}>
        {frame >= missF && frame < hitF && <Pill key="m" color="#0a0e17" border={C.amber} size={40} style={{ background: C.amber, fontWeight: 850 }}>{L.missPill}</Pill>}
        {frame >= hitF && <Pill key="h" color="#0a0e17" border={C.green} size={40} style={{ background: C.green, fontWeight: 850 }}>{L.hitPill}</Pill>}
      </div>
      <Win x={60} y={760} w={960} h={600 + 38} title={L.liveTraffic} accent={C.cyan}>
        <Shot src={seqFrame(HM.name, T, HM.frames)} srcW={1600} w={960} h={600} view={{ x: 690, y: 250, w: 700, h: 438 }}>
          {(map) => (
            <>
              {T >= HM.missAt && <Mark style={map({ x: 1058, y: row(missRows) - 2, w: 200, h: 37 * 6 })} color={C.amber} at={missF} />}
              {T >= HM.hitAt && <Mark style={map({ x: 1058, y: row(0) - 2, w: 200, h: 37 * 6 })} color={C.green} at={hitF} />}
            </>
          )}
        </Shot>
      </Win>
      <Sfx at={missF} src="fx_miss" volume={0.5} />
      <Sfx at={hitF} src="fx_hit" volume={0.55} />
      <KeySounds cast={c1} offset={offset - HM.pc1} rate={k} until={pc2F} volume={0.2} />
      <Sequence from={pc2F} layout="none"><KeySounds cast={c2} offset={0} rate={k} volume={0.2} /></Sequence>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ the three ways to install
const Typed = ({ lines, at, color = C.fg }: { lines: string[]; at: number; color?: string }) => {
  const frame = useCurrentFrame();
  const all = lines.join("\n");
  const shown = Math.floor(interpolate(frame, [at, at + 22], [0, all.length], clamp));
  return (
    <div style={{ fontFamily: MONO, fontSize: 23, lineHeight: 1.45, color, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {all.slice(0, shown).split("\n").map((l, i) => <div key={i}>{l || " "}</div>)}
    </div>
  );
};

const WayCard = ({ n, name, tag, color, ps, code, at, y }: { n: number; name: string; tag: string; color: string; ps: string; code: string[]; at: number; y: number }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: 50, width: 900, top: y, opacity: p, transform: `translateX(${(1 - p) * 60}px)`, borderRadius: 28, background: "rgba(13,20,36,0.94)", border: `2px solid ${color}`, boxShadow: `0 0 ${36 * p}px ${color}44`, padding: "24px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ width: 76, height: 76, borderRadius: 20, background: color, color: "#0a0e17", fontFamily: FONT, fontSize: 54, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
        <div style={{ fontFamily: FONT, fontSize: 50, fontWeight: 850, color: C.fg, letterSpacing: -1 }}>{name}</div>
        <div style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 24, fontWeight: 800, color, border: `2px solid ${color}88`, borderRadius: 999, padding: "6px 16px" }}>{tag}</div>
      </div>
      <div style={{ marginTop: 18, borderRadius: 14, background: "#070b12", padding: "14px 18px", border: `1px solid ${C.line}` }}>
        <Typed lines={code.map((l, i) => (i === 0 && ps ? `${ps} ${l}` : l))} at={at + 6} />
      </div>
    </div>
  );
};

const Ways = () => {
  const frame = useCurrentFrame();
  const { L } = useLang();
  const s = useScene("ways");
  const at = [1, 2, 3].map((i) => lineAt(s, i) - 4);
  const last = s.lines[3];
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
      <div style={{ position: "absolute", left: 70, right: 130, top: 210 }}>
        <Kicker color={C.green} size={28}>{L.waysKicker}</Kicker>
        <div style={{ height: 14 }} />
        <Title text={L.ways} size={80} accent={["EINE", "VERSION.", "ONE"]} delay={2} />
      </div>
      <WayCard n={1} name="Proxmox VE" tag={L.w1} color={C.green} ps="#" code={[PROXMOX_CMD]} at={at[0]} y={480} />
      <WayCard n={2} name="Docker" tag={L.w2} color={C.cyan} ps="" code={["ghcr.io/anarki-lnx/cachencarry"]} at={at[1]} y={800} />
      <WayCard n={3} name="Debian / Ubuntu" tag={L.w3} color={C.amber} ps="$" code={["sudo ./scripts/install.sh"]} at={at[2]} y={1060} />
      <div style={{ position: "absolute", left: 50, right: 130, top: 1330, display: "flex" }}>
        <Pill delay={last.start + last.frames - 6} color={C.green} border={`${C.green}aa`} size={32}>{L.version}</Pill>
      </div>
      {at.map((a, i) => <Sfx key={i} at={a} src="fx_impact" volume={0.25} />)}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ ending: website, open source
const End = () => {
  const frame = useCurrentFrame();
  const { L } = useLang();
  const s = useScene("end");
  const glow = 0.5 + 0.5 * Math.sin(frame / 18);
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, 10], [0, 1], clamp), alignItems: "center", paddingTop: 400, fontFamily: FONT }}>
      <div style={{ position: "absolute", left: "50%", top: 440, width: 900, height: 300, marginLeft: -450, background: `radial-gradient(ellipse, rgba(52,211,153,${0.16 + glow * 0.06}) 0%, transparent 70%)`, filter: "blur(30px)" }} />
      <Logo width={860} delay={0} />
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Title text={L.end1} size={64} align="center" delay={10} />
        <Title text={L.end2} size={46} align="center" delay={22} color={C.cyan} />
      </div>
      <div style={{ marginTop: 56, fontFamily: MONO, fontSize: 46, fontWeight: 700, color: C.green, opacity: ramp(frame, 30, 12), textShadow: `0 0 ${20 + glow * 10}px rgba(52,211,153,0.35)` }}>cachencarry.loopout.tech</div>
      <div style={{ marginTop: 44, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 880 }}>
        <Pill delay={40} color="#0a0e17" border={C.green} size={36} style={{ background: C.green, fontWeight: 850 }}>{L.bio}</Pill>
        <Pill delay={48} color={C.soft} size={34}>Apache 2.0</Pill>
      </div>
      <div style={{ marginTop: 26, opacity: ramp(frame, lineAt(s, 1), 12) }}>
        <Pill color={C.fg} border={`${C.cyan}aa`} size={34}>{L.follow}</Pill>
      </div>
      <div style={{ marginTop: 34, fontSize: 26, color: C.soft, opacity: 0.75 * ramp(frame, 60, 14) }}>{L.tts}</div>
    </AbsoluteFill>
  );
};

const SCENES: Record<string, () => ReactNode> = { hook: Hook, solution: Solution, hitmiss: HitMiss, ways: Ways, end: End };

const Reel = ({ lang }: { lang: Lang }) => {
  const { tl, en } = lang;
  return (
    <Ctx.Provider value={lang}>
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
        {tl.scenes.slice(1).map((s) => <Sfx key={s.id} at={s.start - 6} src="fx_whoosh" volume={0.35} />)}
        <Sfx at={tl.scenes[tl.scenes.length - 1].start + 4} src="fx_logo" volume={0.5} />
        <Voice tl={tl} />
        <Music tl={tl} src={en ? "audio/music_reel_install_en.wav" : "audio/music_reel_install.wav"} base={0.6} duck={0.24} />
      </AbsoluteFill>
    </Ctx.Provider>
  );
};

export const ReelInstall = () => <Reel lang={LANG_DE} />;
export const ReelInstallEn = () => <Reel lang={LANG_EN} />;
export const REEL_INSTALL_FRAMES = LANG_DE.tl.frames;
export const REEL_INSTALL_EN_FRAMES = LANG_EN.tl.frames;

// ------------------------------------------------------------------ covers (1080 x 1920, text inside the Reels grid crop)
// A still shows frame 0, so the content is shifted to a frame where every element is fully faded in.
const Cover = ({ en }: { en: boolean }) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
    <Backdrop />
    <Sequence from={-90} layout="none">
    <div style={{ position: "absolute", left: 90, right: 90, top: 330 }}>
      <Kicker color={C.green} size={34}>CACHE & CARRY</Kicker>
      <div style={{ height: 26 }} />
      <Title text={en ? "DOWNLOAD ONCE. | THE WHOLE LAN | USES IT." : "EINMAL LADEN. | DAS GANZE LAN | NUTZT ES."} size={108} accent={["LAN"]} />
    </div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 980, display: "flex", gap: 22 }}>
      <Pill color="#0a0e17" border={C.amber} size={52} style={{ background: C.amber, fontWeight: 900 }}>MISS</Pill>
      <div style={{ fontSize: 60, color: C.soft, fontWeight: 800, alignSelf: "center" }}>→</div>
      <Pill color="#0a0e17" border={C.green} size={52} style={{ background: C.green, fontWeight: 900 }}>HIT</Pill>
    </div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 1150, display: "flex", flexWrap: "wrap", gap: 16 }}>
      {["Proxmox VE", "Docker", "Debian / Ubuntu"].map((p, i) => <Pill key={p} color={[C.green, C.cyan, C.amber][i]} border={`${[C.green, C.cyan, C.amber][i]}aa`} size={38}>{p}</Pill>)}
    </div>
    <div style={{ position: "absolute", left: 90, right: 90, top: 1330, fontFamily: MONO, fontSize: 40, color: C.soft }}>{en ? "Free · open source" : "Kostenlos · Open Source"}</div>
    </Sequence>
  </AbsoluteFill>
);
export const ReelCover = () => <Cover en={false} />;
export const ReelCoverEn = () => <Cover en={true} />;
