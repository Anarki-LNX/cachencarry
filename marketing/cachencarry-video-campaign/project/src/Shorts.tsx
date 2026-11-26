// Videos 3 to 7: five Shorts, 1080 x 1920. Each one has its own hook,
// story and ending. Text stays inside the area that YouTube Shorts and
// Instagram Reels do not cover (top 200 px, bottom 420 px, right 130 px).
import type { ReactElement, ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import t1 from "./timelines/short01.json";
import t2 from "./timelines/short02.json";
import t3 from "./timelines/short03.json";
import t4 from "./timelines/short04.json";
import t5 from "./timelines/short05.json";
import p1 from "./casts/problem-pc1.json";
import p2 from "./casts/problem-pc2.json";
import p3 from "./casts/problem-pc3.json";
import h1 from "./casts/hitmiss-pc1.json";
import h2 from "./casts/hitmiss-pc2.json";
import {
  Backdrop, type Cast, clamp, fade, Flow, KeySounds, Kicker, lineAt, Logo, Mark, Mark3, Music, Node, Pill, ramp, sceneOf, Sfx, Shot, seqFrame,
  Subtitles, Terminal, type Timeline, Title, Voice, Win,
} from "./kit";
import { EndCard } from "./blocks";
import { C, FONT, FPS, MONO } from "./theme";

const cast = (c: unknown) => c as Cast;
type Scenes = Record<string, () => ReactElement>;

const ShortFrame = ({ tl, scenes, music, children }: { tl: Timeline; scenes: Scenes; music: string; children?: ReactNode }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Backdrop />
    {tl.scenes.map((s) => {
      const Comp = scenes[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
          <Comp />
        </Sequence>
      );
    })}
    {tl.scenes.slice(1).map((s) => <Sfx key={s.id} at={s.start - 6} src="fx_whoosh" volume={0.35} />)}
    <Sfx at={tl.scenes[tl.scenes.length - 1].start + 4} src="fx_logo" volume={0.5} />
    {children}
    <Voice tl={tl} />
    <Music tl={tl} src={`audio/music_${music}.wav`} base={0.6} duck={0.24} />
    <Subtitles tl={tl} portrait />
  </AbsoluteFill>
);

const Hook = ({ text, accent, sub, children, len }: { text: string; accent: string[]; sub?: string; children?: ReactElement; len: number }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, interpolate(frame, [len - 10, len], [1, 0], clamp)) }}>
      {children}
      <div style={{ position: "absolute", left: 70, right: 110, top: 520 }}>
        <Title text={text} size={112} delay={0} accent={accent} />
        {sub && <div style={{ marginTop: 40, fontFamily: FONT, fontSize: 44, fontWeight: 650, color: C.soft, opacity: ramp(frame, 22, 14) }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};
// Title accents are coloured cyan by <Title>; amber and green accents use spans below where needed.

const Ending = ({ tl, lines, badge }: { tl: Timeline; lines: string[]; badge?: string }) => {
  const frame = useCurrentFrame();
  void tl;
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, 10], [0, 1], clamp) }}>
      <EndCard lines={lines} badge={badge} top={440} />
    </AbsoluteFill>
  );
};

// ================================================================ Short 1: the repeated download problem
const S1 = t1 as Timeline;
const s1 = {
  hook: () => {
    const frame = useCurrentFrame();
    return (
      <Hook text="DEIN NETZWERK LÄDT DAS ALLES MEHRFACH?" accent={["MEHRFACH?"]} len={sceneOf(S1, "hook").frames}>
        <AbsoluteFill style={{ opacity: 0.22, filter: "blur(2px)" }}>
          <Win x={60} y={1150} w={960} h={420} title="Rechner 1"><Terminal cast={cast(p1)} t={6 + frame / FPS} fontSize={18.6} /></Win>
        </AbsoluteFill>
      </Hook>
    );
  },
  problem: () => {
    const frame = useCurrentFrame();
    const s = sceneOf(S1, "problem");
    const casts = [cast(p1), cast(p2), cast(p3)];
    const starts = [0, 24, 48];
    return (
      <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
        <Kicker color={C.amber} size={30} style={{ position: "absolute", left: 70, top: 200 }}>DREI RECHNER. DREIMAL DASSELBE.</Kicker>
        {casts.map((c, i) => (
          <div key={i}>
            <Win x={50 + i * 60} y={270 + i * 370} w={850} h={430} title={`Rechner ${i + 1}  ·  Arch Linux`} delay={starts[i]} accent={C.amber} glow={0.2}>
              <Terminal cast={c} t={Math.max(0, ((frame - starts[i]) / FPS) * 1.7 + 0.5)} fontSize={16.8} />
            </Win>
            <div style={{ position: "absolute", left: 50 + i * 60 + 600, top: 270 + i * 370 + 6, fontFamily: MONO, fontSize: 26, color: C.amber, opacity: ramp(frame, starts[i] + 50, 10) }}>↓ 29,9 MiB</div>
            <Sequence from={starts[i]} layout="none"><KeySounds cast={c} offset={-0.5} rate={1.7} volume={0.22} /></Sequence>
          </div>
        ))}
      </AbsoluteFill>
    );
  },
  solution: () => {
    const frame = useCurrentFrame();
    const s = sceneOf(S1, "solution");
    const cloud = { x: 540, y: 470 }, server = { x: 540, y: 860 };
    const pcs = [{ x: 230, y: 1210 }, { x: 540, y: 1210 }, { x: 850, y: 1210 }];
    const srvAt = 20;
    const direct = 1 - ramp(frame, srvAt, 24);
    const srv = ramp(frame, srvAt, 24);
    const local = ramp(frame, lineAt(s, 1), 18);
    return (
      <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
        <div style={{ position: "absolute", left: 70, right: 110, top: 190 }}>
          <Title text="EINMAL LADEN. | LOKAL NUTZEN." size={86} accent={["NUTZEN."]} delay={lineAt(s, 1)} />
        </div>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          {pcs.map((p, i) => <Flow key={"d" + i} a={cloud} b={p} color={C.amber} on={direct} dashed />)}
          <Flow a={cloud} b={server} color={C.amber} on={ramp(frame, srvAt + 24, 16)} count={3} width={6} size={14} speed={0.7} />
          {pcs.map((p, i) => <Flow key={"l" + i} a={server} b={p} color={C.green} on={local} speed={1.4} count={5} width={4} size={11} />)}
          <Node x={cloud.x} y={cloud.y} label="Internet" kind="cloud" color={C.amber} glow={0.6} />
          <Node x={server.x} y={server.y} label="Cache & Carry" sub="in deinem Netzwerk" kind="server" color={C.cyan} glow={srv} appear={srv} size={150} />
          {pcs.map((p, i) => <Node key={i} x={p.x} y={p.y} label={`Rechner ${i + 1}`} glow={local * 0.7} color={local > 0.5 ? C.green : C.fg} />)}
        </svg>
        <Sfx at={srvAt} src="fx_impact" volume={0.35} />
        <Sfx at={lineAt(s, 1)} src="fx_hit" volume={0.4} />
      </AbsoluteFill>
    );
  },
  end: () => <Ending tl={S1} lines={["DEIN EIGENER LAN-CACHE", "OPEN SOURCE • KOSTENLOS AUF GITHUB"]} badge="LINK IN DER BESCHREIBUNG" />,
};
export const Short01 = () => <ShortFrame tl={S1} scenes={s1} music="short01" />;

// ================================================================ Short 2: HIT or MISS
const S2 = t2 as Timeline;
const HM = { missAt: 5.35, hitAt: 11.3, pc1: 1.501, pc2: 8.676 };
const HMOFF = 3.6; // footage second shown at the start of the "miss" scene
/** Real pacman and the real Live-Traffic page, running across the "miss" and "hit" scenes without a cut. */
const HitMissView = () => {
  const frame = useCurrentFrame(); // 0 = start of the "miss" scene
  const T = HMOFF + frame / FPS;
  const second = T >= HM.pc2;
  const c = second ? cast(h2) : cast(h1);
  const row = (i: number) => 270 + 37 * i;
  const missRows = T >= HM.hitAt ? 6 : 0;
  const missF = Math.round((HM.missAt - HMOFF) * FPS);
  const hitF = Math.round((HM.hitAt - HMOFF) * FPS);
  return (
    <AbsoluteFill>
      <Win x={60} y={200} w={960} h={380} title={second ? "Rechner 2  ·  pacman -S vim" : "Rechner 1  ·  pacman -S vim"} accent={second ? C.green : C.amber}>
        <Terminal cast={c} t={Math.max(0, second ? T - HM.pc2 : T - HM.pc1)} fontSize={13} />
      </Win>
      <Win x={60} y={700} w={960} h={600 + 38} title="Live-Traffic im Dashboard" accent={C.cyan}>
        <Shot src={seqFrame("hitmiss", T, 180)} srcW={1600} w={960} h={600} view={{ x: 690, y: 250, w: 700, h: 438 }}>
          {(map) => (
            <>
              {T >= HM.missAt && <Mark style={map({ x: 1058, y: row(missRows) - 2, w: 200, h: 37 * 6 })} color={C.amber} at={missF} />}
              {T >= HM.hitAt && <Mark style={map({ x: 1058, y: row(0) - 2, w: 200, h: 37 * 6 })} color={C.green} at={hitF} />}
            </>
          )}
        </Shot>
      </Win>
      <div style={{ position: "absolute", left: 60, right: 60, top: 604, display: "flex", justifyContent: "center" }}>
        {T >= HM.missAt && T < HM.hitAt && <Pill key="m" color="#0a0e17" border={C.amber} size={38} style={{ background: C.amber, fontWeight: 850 }}>MISS = AUS DEM INTERNET</Pill>}
        {T >= HM.hitAt && <Pill key="h" color="#0a0e17" border={C.green} size={38} style={{ background: C.green, fontWeight: 850 }}>HIT = AUS DEINEM CACHE</Pill>}
      </div>
      <Sfx at={missF} src="fx_miss" volume={0.5} />
      <Sfx at={hitF} src="fx_hit" volume={0.55} />
      <KeySounds cast={cast(h1)} offset={HMOFF - HM.pc1} until={Math.round((HM.pc2 - HMOFF) * FPS)} volume={0.22} />
      <Sequence from={Math.round((HM.pc2 - HMOFF) * FPS)} layout="none"><KeySounds cast={cast(h2)} offset={0} volume={0.22} /></Sequence>
    </AbsoluteFill>
  );
};
const Empty = () => <></>;
const s2: Scenes = {
  hook: () => (
    <Hook text="ZWEI WÖRTER. EIN GANZES NETZWERK SCHNELLER." accent={["SCHNELLER."]} len={sceneOf(S2, "hook").frames}>
      <div style={{ position: "absolute", left: 70, top: 280, display: "flex", gap: 24 }}>
        <Pill color="#0a0e17" border={C.amber} size={60} delay={6} style={{ background: C.amber, fontWeight: 900 }}>MISS</Pill>
        <Pill color="#0a0e17" border={C.green} size={60} delay={14} style={{ background: C.green, fontWeight: 900 }}>HIT</Pill>
      </div>
    </Hook>
  ),
  miss: Empty,
  hit: Empty,
  end: () => <Ending tl={S2} lines={["PROBIER ES SELBST.", "OPEN SOURCE AUF GITHUB"]} badge="MISS → HIT" />,
};
export const Short02 = () => {
  const frame = useCurrentFrame();
  const miss = sceneOf(S2, "miss");
  const hit = sceneOf(S2, "hit");
  const len = hit.start + hit.frames - miss.start;
  return (
    <ShortFrame tl={S2} scenes={s2} music="short02">
      <Sequence from={miss.start} durationInFrames={len}>
        <AbsoluteFill style={{ opacity: fade(frame - miss.start, len, 8) }}>
          <HitMissView />
        </AbsoluteFill>
      </Sequence>
    </ShortFrame>
  );
};

// ================================================================ Short 3: 959 ms vs 9 ms
const S3 = t3 as Timeline;
const Race = ({ slow = 3, start = 0 }: { slow?: number; start?: number }) => {
  const frame = useCurrentFrame();
  const ms = Math.max(0, ((frame - start) / FPS) * 1000 / slow);
  const net = Math.min(959, ms), cache = Math.min(9, ms);
  const lane = (y: number, label: string, v: number, max: number, color: string, src: string) => (
    <div style={{ position: "absolute", left: 60, right: 60, top: y, height: 440, borderRadius: 30, background: "rgba(13,20,36,0.9)", border: `2px solid ${color}66`, padding: 40, fontFamily: FONT }}>
      <Kicker color={color} size={28}>{label}</Kicker>
      <div style={{ marginTop: 10, fontSize: 34, color: C.muted, fontWeight: 600 }}>{src}</div>
      <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 150, fontWeight: 800, color, lineHeight: 1 }}>{Math.round(v)}<span style={{ fontSize: 70 }}> ms</span></div>
      <div style={{ marginTop: 40, height: 28, borderRadius: 14, background: "#1a2234", overflow: "hidden" }}>
        <div style={{ width: `${(v / max) * 100}%`, minWidth: v > 0 ? 14 : 0, height: "100%", borderRadius: 14, background: color, boxShadow: `0 0 30px ${color}` }} />
      </div>
      {v >= max && <div style={{ position: "absolute", right: 40, top: 40, fontSize: 60, color }}>✓</div>}
    </div>
  );
  return (
    <>
      {lane(300, "AUS DEM INTERNET", net, 959, C.amber, "Mirror im Internet")}
      {lane(770, "AUS DEM CACHE", cache, 9, C.green, "Cache & Carry im LAN")}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1222, textAlign: "center", fontFamily: FONT, fontSize: 28, color: C.muted }}>Animation in {slow}facher Zeitlupe</div>
    </>
  );
};
const s3 = {
  hook: () => {
    const frame = useCurrentFrame();
    return (
      <AbsoluteFill style={{ opacity: interpolate(frame, [sceneOf(S3, "hook").frames - 10, sceneOf(S3, "hook").frames], [1, 0], clamp), fontFamily: MONO, alignItems: "center" }}>
        <div style={{ marginTop: 420, fontSize: 230, fontWeight: 800, color: C.amber, opacity: ramp(frame, 0, 10), transform: `scale(${0.9 + ramp(frame, 0, 12) * 0.1})` }}>959 ms</div>
        <div style={{ fontSize: 80, color: C.muted, opacity: ramp(frame, 14, 10) }}>vs.</div>
        <div style={{ fontSize: 230, fontWeight: 800, color: C.green, opacity: ramp(frame, 36, 10), transform: `scale(${0.9 + ramp(frame, 36, 12) * 0.1})` }}>9 ms</div>
        <div style={{ marginTop: 40, fontFamily: FONT, fontSize: 64, fontWeight: 850, color: C.fg, opacity: ramp(frame, 70, 12) }}>WAS IST PASSIERT?</div>
      </AbsoluteFill>
    );
  },
  compare: () => {
    const frame = useCurrentFrame();
    const s = sceneOf(S3, "compare");
    return (
      <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
        <div style={{ position: "absolute", left: 70, right: 110, top: 200, fontFamily: FONT }}>
          <div style={{ fontSize: 50, fontWeight: 850, color: C.fg }}>
            Paketindex <span style={{ fontFamily: MONO, color: C.cyan }}>extra.db</span>
          </div>
        </div>
        <Race start={lineAt(s, 0) + 30} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 1272, display: "flex", justifyContent: "center" }}>
          <Pill color={C.amber} border={`${C.amber}aa`} size={32} delay={20}>8,6 MiB • TESTNETZWERK • KEIN GARANTIEWERT</Pill>
        </div>
        <Sfx at={lineAt(s, 0) + 30 + 3} src="fx_hit" volume={0.45} />
        <Sfx at={lineAt(s, 0) + 30 + 86} src="fx_miss" volume={0.4} />
      </AbsoluteFill>
    );
  },
  end: () => <Ending tl={S3} lines={["SCHNELL AUS DEM EIGENEN LAN", "MEHR IM GITHUB-REPOSITORY"]} badge="8,6 MiB • TESTNETZWERK" />,
};
export const Short03 = () => <ShortFrame tl={S3} scenes={s3} music="short03" />;

// ================================================================ Short 4: one download, many clients
const S4 = t4 as Timeline;
const TEN = [...Array(10)].map((_, i) => ({ x: 150 + (i % 5) * 195, y: 1080 + Math.floor(i / 5) * 170 }));
const s4 = {
  hook: () => {
    const frame = useCurrentFrame();
    return (
      <Hook text="ZEHN RECHNER. DIESELBE DATEI. NUR EIN UPSTREAM-DOWNLOAD." accent={["EIN", "UPSTREAM-DOWNLOAD."]} len={sceneOf(S4, "hook").frames}>
        <svg width={1080} height={1920} style={{ position: "absolute", opacity: 0.5 }}>
          {TEN.map((p, i) => <Node key={i} x={p.x} y={p.y + 120} label="" size={70} appear={ramp(frame, i * 3, 10)} />)}
        </svg>
      </Hook>
    );
  },
  demo: () => {
    const frame = useCurrentFrame();
    const s = sceneOf(S4, "demo");
    const T = 1.6 + frame / FPS;
    const server = { x: 540, y: 900 }, cloud = { x: 540, y: 700 };
    const fan = ramp(frame, 50, 16);
    const pills = ["ONE DOWNLOAD", "MULTIPLE CLIENTS", "LOCAL DELIVERY"];
    return (
      <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
        <Win x={40} y={200} w={1000} h={400 + 38} title="Downloads im Dashboard" accent={C.amber} glow={0.2}>
          <Shot src={seqFrame("ten", T, 96)} srcW={1600} w={1000} h={400} view={{ x: 240, y: 168, w: 700, h: 280 }}>
            {(map) => <Mark style={map({ x: 296, y: 224, w: 260, h: 28 })} color={C.cyan} at={30} label="10 WARTENDE CLIENTS" labelSide="bottom" />}
          </Shot>
        </Win>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          <Flow a={cloud} b={server} color={C.amber} on={ramp(frame, 30, 12)} count={2} width={7} size={16} speed={0.6} />
          {TEN.map((p, i) => <Flow key={i} a={server} b={p} color={C.green} on={fan * ramp(frame, 50 + i * 3, 8)} count={3} speed={1.5} width={3} size={9} />)}
          <Node x={cloud.x} y={cloud.y} label="" kind="cloud" color={C.amber} size={80} appear={ramp(frame, 24, 10)} />
          <Node x={server.x} y={server.y} label="" kind="server" color={C.cyan} glow={1} size={100} appear={ramp(frame, 28, 10)} />
          {TEN.map((p, i) => <Node key={i} x={p.x} y={p.y} label="" size={64} glow={fan * 0.6} color={fan > 0.5 ? C.green : C.fg} appear={ramp(frame, 40 + i * 2, 10)} />)}
        </svg>
        <div style={{ position: "absolute", left: 620, top: 760, fontFamily: FONT, fontSize: 30, fontWeight: 800, color: C.amber, opacity: ramp(frame, 34, 10) }}>1 × Internet</div>
        <div style={{ position: "absolute", left: 60, right: 60, top: 1310, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          {pills.map((p, i) => <Pill key={p} delay={lineAt(s, i) + 10} color={[C.amber, C.cyan, C.green][i]} border={[C.amber, C.cyan, C.green][i] + "aa"} size={30}>{p}</Pill>)}
        </div>
      </AbsoluteFill>
    );
  },
  end: () => <Ending tl={S4} lines={["FÜR DEIN HOMELAB", "OPEN SOURCE AUF GITHUB"]} badge="EIN DOWNLOAD FÜR ALLE" />,
};
export const Short04 = () => <ShortFrame tl={S4} scenes={s4} music="short04" />;

// ================================================================ Short 5: free and open source
const S5 = t5 as Timeline;
const s5 = {
  hook: () => {
    const frame = useCurrentFrame();
    return (
      <AbsoluteFill style={{ alignItems: "center", opacity: interpolate(frame, [sceneOf(S5, "hook").frames - 10, sceneOf(S5, "hook").frames], [1, 0], clamp) }}>
        <div style={{ marginTop: 640, width: 900 }}>
          <Title text="UND WAS KOSTET DAS?" size={120} align="center" accent={["KOSTET"]} />
        </div>
        <div style={{ marginTop: 80 }}><Mark3 size={180} delay={40} /></div>
      </AbsoluteFill>
    );
  },
  free: () => {
    const frame = useCurrentFrame();
    const s = sceneOf(S5, "free");
    const lic = frame >= lineAt(s, 1) - 6;
    return (
      <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
        <div style={{ position: "absolute", left: 70, right: 110, top: 200 }}>
          <Title text="FREE & OPEN SOURCE" size={92} accent={["FREE"]} />
        </div>
        <Win x={40} y={400} w={1000} h={820 + 38} title={lic ? "github.com  ·  LICENSE" : "github.com/Anarki-LNX/cachencarry"} accent={C.cyan}>
          {!lic ? (
            <Shot src="footage/github.png" srcW={1600} w={1000} h={820} view={{ x: 840, y: 170, w: 640, h: 525 }}>
              {(map) => <Mark style={map({ x: 1128, y: 646, w: 170, h: 28 })} color={C.green} at={24} label="APACHE 2.0" labelSide="top" />}
            </Shot>
          ) : (
            <Shot src="footage/github-license.png" srcW={1600} w={1000} h={820} view={{ x: 310, y: 200, w: 800, h: 656 }}>
              {(map) => <Mark style={map({ x: 378, y: 232, w: 290, h: 54 })} color={C.cyan} at={lineAt(s, 1)} label="APACHE LICENSE 2.0" labelSide="bottom" />}
            </Shot>
          )}
        </Win>
        <div style={{ position: "absolute", left: 0, right: 0, top: 1290, display: "flex", justifyContent: "center", gap: 16 }}>
          <Pill delay={10} color={C.green} border={`${C.green}aa`} size={34}>KOSTENLOS</Pill>
          <Pill delay={lineAt(s, 1)} color={C.cyan} border={`${C.cyan}aa`} size={34}>APACHE 2.0</Pill>
        </div>
      </AbsoluteFill>
    );
  },
  control: () => {
    const frame = useCurrentFrame();
    const s = sceneOf(S5, "control");
    const note = lineAt(s, 1) - 6;
    return (
      <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
        <div style={{ position: "absolute", left: 70, right: 110, top: 200 }}>
          <Title text="SELF-HOSTED" size={92} accent={["SELF-HOSTED"]} />
        </div>
        <Win x={40} y={400} w={1000} h={600 + 38} title="Dein Dashboard  ·  http://cachencarry.lan:8080" accent={C.green}>
          <Shot src="footage/dash-portrait.png" srcW={720} w={1000} h={600} view={{ x: 0, y: 60 + ramp(frame, 0, s.frames) * 500, w: 720, h: 432 }} />
        </Win>
        <Win x={140} y={1040} w={880} h={220} title="Rechner 2  ·  Linux Client" delay={20} accent={C.cyan}>
          <Terminal cast={cast(h2)} t={20} fontSize={12} firstRow={8} cursor={false} />
        </Win>
        <div style={{ position: "absolute", left: 60, right: 60, top: 1282, display: "flex", justifyContent: "center", opacity: ramp(frame, note, 12) }}>
          <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 650, color: C.soft, background: "rgba(13,20,36,0.92)", border: `2px solid ${C.line}`, borderRadius: 18, padding: "14px 26px", textAlign: "center" }}>
            Software kostenlos. Hardware und Strom für den Server zahlst du selbst.
          </div>
        </div>
      </AbsoluteFill>
    );
  },
  end: () => <Ending tl={S5} lines={["YOUR NETWORK. YOUR CACHE.", "STAR DAS REPOSITORY UND PROBIER ES AUS."]} badge="APACHE 2.0" />,
};
export const Short05 = () => <ShortFrame tl={S5} scenes={s5} music="short05" />;

export const SHORTS = [
  { id: "Short01", comp: Short01, frames: S1.frames },
  { id: "Short02", comp: Short02, frames: S2.frames },
  { id: "Short03", comp: Short03, frames: S3.frames },
  { id: "Short04", comp: Short04, frames: S4.frames },
  { id: "Short05", comp: Short05, frames: S5.frames },
];
