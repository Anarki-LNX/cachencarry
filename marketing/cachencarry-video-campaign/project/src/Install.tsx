// Install video, 1920 x 1080: the problem, what Cache & Carry does, then the
// three ways to install (same facts as Short 6), setup and a call to action.
// Footage: the real pacman recordings and dashboard recordings of the campaign,
// the real setup recording of the tutorial (token blurred) and the real output
// of scripts/proxmox-lxc.sh (token hidden).
import { createContext, type ReactNode, useContext } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import tlDe from "./timelines/install.json";
import tlEn from "./timelines/install_en.json";
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
import { FlowStrip } from "./blocks";
import { Console, type Out, PROXMOX_CMD } from "./Short06";
import { C, FONT, FPS, MONO } from "./theme";

const cast = (c: unknown) => c as Cast;

// On-screen text per language. German version: German only, English version: English only.
const DE = {
  problemKicker: "DAS PROBLEM", problemTitle: "DREI RECHNER. DREIMAL DERSELBE DOWNLOAD.", problemAccent: ["DREIMAL"],
  pc: (i: number) => `Rechner ${i}`, pcProblem: (i: number) => `Rechner ${i}  ·  Arch Linux  ·  lädt aus dem Internet`, threeTimes: "dasselbe Paket, dreimal",
  solutionKicker: "DIE LÖSUNG", solutionTitle: "EINMAL LADEN. | LOKAL VERTEILEN.", solutionAccent: ["LOKAL", "VERTEILEN."],
  solutionText: ["Der erste Rechner lädt aus dem Internet.", "Alle weiteren holen es aus deinem LAN."],
  mirror: "Paketmirror", inYourNet: "in deinem Netzwerk", once: "1 × aus dem Internet",
  hmPc: (i: number) => `Rechner ${i}  ·  pacman über Cache & Carry`, liveTraffic: "Live-Traffic im Dashboard",
  missPill: "MISS = AUS DEM INTERNET", hitPill: "HIT = AUS DEINEM CACHE", strip: ["LOKALER CACHE", "RECHNER"] as [string, string],
  claim: "Der schlanke, selbst gehostete Paketcache für dein Netzwerk.",
  features: ["APT", "PACMAN", "DASHBOARD", "STATISTIKEN", "SPEICHERLIMITS", "SELBST GEHOSTET"], free: "KOSTENLOS • OPEN SOURCE",
  install: "INSTALLATION", waysTitle: "DREI WEGE. EINE VERSION.", waysAccent: ["EINE", "VERSION."],
  tiles: ["ein Befehl auf dem Host", "amd64 und arm64", "Paket und Installationsskript"],
  way: (n: number) => `WEG ${n} VON 3`,
  winProxmox: "Proxmox-Host  ·  Shell", winDocker: "Docker-Host  ·  Terminal", winServer: "Server oder VM  ·  Terminal",
  ptsProxmox: ["Unprivilegierter Debian-13-LXC", "ohne Nesting, Prüfsumme geprüft", "Adresse und Token am Ende", "Update: -- update <ID>"],
  ptsDocker: ["Image für amd64 und arm64", "kleiner als 16 MB, ohne Shell", "läuft auf jedem Docker-Host"],
  ptsDebian: ["Paket aus dem Release laden", "systemd-Dienst, auch in VMs", "Raspberry Pi mit arm64", "Update: Skript erneut starten"],
  browser: "Browser  ·  http://<adresse>:8080", steps: ["PORT 8080 ÖFFNEN", "TOKEN EINGEBEN", "PASSWORT WÄHLEN"],
  star: "★ STERN AUF GITHUB", ask: ["ABONNIEREN", "LIKE", "KOMMENTAR"], tts: "Sprecherstimme synthetisch (Piper TTS)",
};
const EN: typeof DE = {
  problemKicker: "THE PROBLEM", problemTitle: "THE SAME DOWNLOAD, THREE TIMES.", problemAccent: ["THREE", "TIMES."],
  pc: (i: number) => `Machine ${i}`, pcProblem: (i: number) => `Machine ${i}  ·  Arch Linux  ·  downloading from the internet`, threeTimes: "the same package, three times",
  solutionKicker: "THE SOLUTION", solutionTitle: "DOWNLOAD ONCE. | SHARE LOCALLY.", solutionAccent: ["SHARE", "LOCALLY."],
  solutionText: ["The first machine downloads from the internet.", "All others get it from your LAN."],
  mirror: "package mirror", inYourNet: "in your network", once: "1 × from the internet",
  hmPc: (i: number) => `Machine ${i}  ·  pacman via Cache & Carry`, liveTraffic: "Live traffic in the dashboard",
  missPill: "MISS = FROM THE INTERNET", hitPill: "HIT = FROM YOUR CACHE", strip: ["LOCAL CACHE", "MACHINE"],
  claim: "The lean, self-hosted package cache for your network.",
  features: ["APT", "PACMAN", "DASHBOARD", "STATISTICS", "STORAGE LIMITS", "SELF-HOSTED"], free: "FREE • OPEN SOURCE",
  install: "INSTALLATION", waysTitle: "THREE WAYS. ONE VERSION.", waysAccent: ["ONE", "VERSION."],
  tiles: ["one command on the host", "amd64 and arm64", "package and install script"],
  way: (n: number) => `OPTION ${n} OF 3`,
  winProxmox: "Proxmox host  ·  shell", winDocker: "Docker host  ·  terminal", winServer: "Server or VM  ·  terminal",
  ptsProxmox: ["Unprivileged Debian 13 LXC", "no nesting, checksum verified", "address and token at the end", "update: -- update <ID>"],
  ptsDocker: ["image for amd64 and arm64", "smaller than 16 MB, no shell", "runs on any Docker host"],
  ptsDebian: ["download the release package", "systemd service, also in VMs", "Raspberry Pi with arm64", "update: run the script again"],
  browser: "Browser  ·  http://<address>:8080", steps: ["OPEN PORT 8080", "ENTER THE TOKEN", "CHOOSE A PASSWORD"],
  star: "★ STAR ON GITHUB", ask: ["SUBSCRIBE", "LIKE", "COMMENT"], tts: "Synthetic voice (Kokoro TTS)",
};
type Lang = { tl: Timeline; L: typeof DE; en: boolean };
const Ctx = createContext<Lang>({ tl: tlDe as Timeline, L: DE, en: false });
const useLang = () => useContext(Ctx);
const useS = () => { const { tl } = useLang(); return (id: string) => sceneOf(tl, id); };

// ------------------------------------------------------------------ the problem
const Problem = () => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L, en } = useLang();
  const s = S("problem");
  const casts = [cast(p1), cast(p2), cast(p3)];
  const starts = [0, 34, 68];
  const rate = 1.7;
  const head = -20; // title visible from the first frame
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <Kicker style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center" }} color={C.amber} delay={-20}>{L.problemKicker}</Kicker>
      <Title text={L.problemTitle} size={66} align="center" delay={head} accent={L.problemAccent} style={{ position: "absolute", left: 80, right: 80, top: 110 }} />
      {casts.map((c, i) => (
        <div key={i}>
          <Win x={90 + i * 440} y={240 + i * 86} w={880} h={490} title={L.pcProblem(i + 1)} delay={starts[i] - 20} accent={C.amber} glow={0.2}>
            <Terminal cast={c} t={Math.max(0, ((frame - starts[i]) / FPS) * rate)} fontSize={17.6} />
          </Win>
          <Sequence from={starts[i]} layout="none"><KeySounds cast={c} offset={0} rate={rate} volume={0.22} /></Sequence>
        </div>
      ))}
      <div style={{ position: "absolute", right: 90, top: 250, textAlign: "right", fontFamily: FONT }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ fontFamily: MONO, fontSize: 28, color: C.amber, opacity: ramp(frame, starts[i] + 50, 10), lineHeight: 1.5 }}>↓ 29,9 MiB</div>
        ))}
        <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: C.soft, opacity: ramp(frame, starts[2] + 70, 12) }}>{L.threeTimes}</div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ the solution
const Solution = () => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L, en } = useLang();
  const s = S("solution");
  const cloud = { x: 1400, y: 190 }, server = { x: 1400, y: 520 };
  const pcs = [{ x: 1080, y: 820 }, { x: 1400, y: 820 }, { x: 1720, y: 820 }];
  const srvAt = 10;
  const direct = 1 - ramp(frame, srvAt, 24);
  const srv = ramp(frame, srvAt, 22);
  const one = ramp(frame, lineAt(s, 1), 18);
  const local = ramp(frame, lineAt(s, 2), 18);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {pcs.map((p, i) => <Flow key={"d" + i} a={cloud} b={p} color={C.amber} on={direct} dashed speed={0.8} />)}
        <Flow a={cloud} b={server} color={C.amber} on={one} speed={0.7} count={3} width={5} size={13} />
        {pcs.map((p, i) => <Flow key={"l" + i} a={server} b={p} color={C.green} on={local} speed={1.3} count={5} />)}
        <Node x={cloud.x} y={cloud.y} label="Internet" sub={L.mirror} kind="cloud" color={C.amber} glow={0.6} />
        <Node x={server.x} y={server.y} label="Cache & Carry" sub={L.inYourNet} kind="server" color={C.cyan} glow={srv} appear={srv} size={140} />
        {pcs.map((p, i) => <Node key={i} x={p.x} y={p.y} label={L.pc(i + 1)} color={local > 0.5 ? C.green : C.fg} glow={local * 0.6} />)}
      </svg>
      <div style={{ position: "absolute", left: 1400 + 110, top: 330, fontFamily: MONO, fontSize: 24, color: C.amber, opacity: one }}>{L.once}</div>
      <div style={{ position: "absolute", left: 110, top: 300, width: 860 }}>
        <Kicker color={C.green}>{L.solutionKicker}</Kicker>
        <Title text={L.solutionTitle} size={86} delay={lineAt(s, 1) - 4} accent={L.solutionAccent} style={{ marginTop: 24 }} />
        <div style={{ marginTop: 34, fontFamily: FONT, fontSize: 32, fontWeight: 600, color: C.soft, lineHeight: 1.4, opacity: ramp(frame, lineAt(s, 2), 16) }}>
          {L.solutionText[0]}<br />{L.solutionText[1]}
        </div>
      </div>
      <Sfx at={srvAt} src="fx_impact" volume={0.35} />
      <Sfx at={lineAt(s, 2)} src="fx_hit" volume={0.4} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ hit and miss (real recording)
const HM_DE = { name: "hitmiss", frames: 180, missAt: 5.35, hitAt: 11.3, pc2: 8.676, pc1: 1.501, offset: 3.4 };
// English recording: the same real pacman run, filmed with the English interface.
// missAt and hitAt: first footage second with the new rows, read from the frames.
const HM_EN = { name: "hitmiss-en", frames: hmEn.frames, missAt: hmEn.marks.missAt ?? 0, hitAt: hmEn.marks.hitAt ?? 0, pc2: hmEn.marks.pc2, pc1: hmEn.marks.pc1, offset: hmEn.marks.pc1 + 1.9 };
const HitMiss = () => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L, en } = useLang();
  const s = S("hitmiss");
  const HM = en ? HM_EN : HM_DE;
  const [c1, c2] = en ? [cast(e1), cast(e2)] : [cast(h1), cast(h2)];
  const T = HM.offset + frame / FPS;
  const second = T >= HM.pc2;
  const c = second ? c2 : c1;
  const t = second ? T - HM.pc2 : T - HM.pc1;
  const missF = Math.round((HM.missAt - HM.offset) * FPS);
  const hitF = Math.round((HM.hitAt - HM.offset) * FPS);
  const row = (i: number) => 270 + 37 * i;
  const missRows = T >= HM.hitAt ? 6 : 0;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <Win x={60} y={70} w={780} h={470} title={L.hmPc(second ? 2 : 1)} accent={second ? C.green : C.amber}>
        <Terminal cast={c} t={Math.max(0, t)} fontSize={15.4} />
      </Win>
      <Win x={880} y={70} w={980} h={566 + 38} title={L.liveTraffic} delay={4} accent={C.cyan}>
        <Shot src={seqFrame(HM.name, T, HM.frames)} srcW={1600} w={980} h={566} view={{ x: 244, y: 228, w: 1336, h: 772 }}>
          {(map) => (
            <>
              {T >= HM.missAt && <Mark style={map({ x: 1058, y: row(missRows) - 2, w: 240, h: 37 * 6 })} color={C.amber} at={missF} />}
              {T >= HM.hitAt && <Mark style={map({ x: 1058, y: row(0) - 2, w: 240, h: 37 * 6 })} color={C.green} at={hitF} />}
            </>
          )}
        </Shot>
      </Win>
      <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", gap: 30 }}>
        {frame >= missF && <Pill color="#0a0e17" border={C.amber} size={30} style={{ background: C.amber, fontWeight: 800 }}>{L.missPill}</Pill>}
        {frame >= hitF && <Pill color="#0a0e17" border={C.green} size={30} style={{ background: C.green, fontWeight: 800 }}>{L.hitPill}</Pill>}
      </div>
      <FlowStrip y={800} frame={frame} missAt={missF - 20} hitAt={hitF - 10} labels={L.strip} />
      <Sfx at={missF} src="fx_miss" volume={0.5} />
      <Sfx at={hitF} src="fx_hit" volume={0.55} />
      <KeySounds cast={c1} offset={HM.offset - HM.pc1} until={Math.round((HM.pc2 - HM.offset) * FPS)} volume={0.22} />
      <Sequence from={Math.round((HM.pc2 - HM.offset) * FPS)} layout="none"><KeySounds cast={c2} offset={0} volume={0.22} /></Sequence>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ what it is
const Pitch = () => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L, en } = useLang();
  const s = S("pitch");
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <div style={{ position: "absolute", left: 90, top: 120, width: 640 }}>
        <Logo width={600} delay={0} />
        <div style={{ marginTop: 40, fontFamily: FONT, fontSize: 40, fontWeight: 800, color: C.fg, lineHeight: 1.25, opacity: ramp(frame, 10, 14) }}>
          {L.claim}
        </div>
        <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 14 }}>
          {L.features.map((f, i) => <Pill key={f} delay={lineAt(s, 1) + i * 5} color={C.soft} border={`${C.cyan}88`} size={26}>{f}</Pill>)}
        </div>
        <div style={{ marginTop: 34, opacity: ramp(frame, lineAt(s, 2), 12) }}>
          <Pill color="#0a0e17" border={C.green} size={34} style={{ background: C.green, fontWeight: 850 }}>{L.free}</Pill>
        </div>
      </div>
      <Win x={790} y={110} w={1060} h={596 + 38} title="http://cachencarry.lan:8080" delay={6} accent={C.green} glow={0.18}>
        <Shot src={seqFrame(en ? "dash-live-en" : "dash-live", 1 + frame / FPS, 72)} srcW={1600} w={1060} h={596} view={{ x: 230, y: 60 + ramp(frame, 0, s.frames) * 60, w: 1370, h: 770 }} />
      </Win>
      <Sfx at={lineAt(s, 2)} src="fx_hit" volume={0.35} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ three ways overview
const Tile = ({ n, label, sub, color, at }: { n: number; label: string; sub: string; color: string; at: number }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, 14);
  return (
    <div style={{ width: 460, padding: "40px 20px", borderRadius: 30, background: "rgba(13,20,36,0.92)", border: `2px solid ${color}`, boxShadow: `0 0 50px ${color}44`, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 50}px)` }}>
      <div style={{ fontFamily: FONT, fontSize: 120, fontWeight: 900, color, lineHeight: 1 }}>{n}</div>
      <div style={{ marginTop: 18, fontFamily: FONT, fontSize: 46, fontWeight: 850, color: C.fg }}>{label}</div>
      <div style={{ marginTop: 10, fontFamily: FONT, fontSize: 26, fontWeight: 600, color: C.muted }}>{sub}</div>
    </div>
  );
};
const Ways = () => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L, en } = useLang();
  const s = S("ways");
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 130 }}>
        <Kicker color={C.green} style={{ textAlign: "center" }}>{L.install}</Kicker>
        <Title text={L.waysTitle} size={92} align="center" accent={L.waysAccent} delay={4} style={{ marginTop: 20 }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, display: "flex", justifyContent: "center", gap: 50 }}>
        <Tile n={1} label="Proxmox VE" sub={L.tiles[0]} color={C.green} at={16} />
        <Tile n={2} label="Docker" sub={L.tiles[1]} color={C.cyan} at={24} />
        <Tile n={3} label="Debian / Ubuntu" sub={L.tiles[2]} color={C.amber} at={32} />
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ one way, landscape
const Way = ({ id, n, name, color, win, ps, cmd, out, size, h, points }: {
  id: string; n: number; name: string; color: string; win: string; ps: string; cmd: string[]; out?: Out[]; size: number; h: number; points: string[];
}) => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L } = useLang();
  const s = S(id);
  const typeAt = lineAt(s, 1) - 4;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <div style={{ position: "absolute", left: 90, top: 110, width: 620 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div style={{ width: 110, height: 110, borderRadius: 28, background: color, color: "#0a0e17", fontFamily: FONT, fontSize: 78, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 50px ${color}88`, opacity: ramp(frame, 0, 8) }}>{n}</div>
          <Kicker color={color} size={26}>{L.way(n)}</Kicker>
        </div>
        <Title text={name} size={76} delay={4} style={{ marginTop: 30 }} />
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20 }}>
          {points.map((p, i) => {
            const at = lineAt(s, Math.min(i + 1, s.lines.length - 1)) + (i + 1 >= s.lines.length ? (i - s.lines.length + 2) * 12 : 0);
            const v = ramp(frame, at, 12);
            return (
              <div key={p} style={{ display: "flex", gap: 16, alignItems: "baseline", fontFamily: FONT, fontSize: 32, fontWeight: 650, color: C.soft, opacity: v, transform: `translateX(${(1 - v) * -20}px)` }}>
                <span style={{ color, fontWeight: 900 }}>✓</span><span>{p}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Win x={790} y={140 + (760 - h) / 2} w={1060} h={h} title={win} accent={color} glow={0.22} delay={typeAt - 10}>
        <Console ps={ps} cmd={cmd} out={out} typeAt={typeAt} outAt={typeAt + 34} size={size} />
      </Win>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ setup in the browser (tutorial recording)
const Setup = () => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L, en } = useLang();
  const s = S("setup");
  const T = 1.2 + frame / FPS;
  const view = { x: 360, y: 150, w: 880, h: 495 };
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 10) }}>
      <Win x={268} y={64} w={1384} h={778 + 38} title={L.browser} accent={C.green}>
        {en ? (
          // English interface, empty form of a fresh instance (no token typed, nothing to hide).
          <Shot src="footage/setup-en.png" srcW={1600} w={1384} h={778} view={{ x: 360, y: 40 + ramp(frame, 20, s.frames - 40) * 260, w: 880, h: 495 }} />
        ) : (
          <Shot src={seqFrame("tut-setup", T, 79)} srcW={1600} w={1384} h={778} view={view}>
            {(map) => T > 5.2 && <div style={{ ...map({ x: 579, y: 611, w: 442, h: 32 }), backdropFilter: "blur(9px)", background: "rgba(148,163,184,0.25)", borderRadius: 6 }} />}
          </Shot>
        )}
      </Win>
      <div style={{ position: "absolute", left: 0, right: 0, top: 920, display: "flex", justifyContent: "center", gap: 18 }}>
        {L.steps.map((p, i) => <Pill key={p} delay={8 + i * 40} color={C.green} border={`${C.green}88`} size={28}>{`${i + 1}. ${p}`}</Pill>)}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ call to action
const Cta = () => {
  const frame = useCurrentFrame();
  const S = useS();
  const { L, en } = useLang();
  const s = S("cta");
  const glow = 0.5 + 0.5 * Math.sin(frame / 18);
  const ask = lineAt(s, 2);
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, 10], [0, 1], clamp), alignItems: "center", fontFamily: FONT }}>
      <div style={{ position: "absolute", left: "50%", top: 120, width: 1100, height: 300, marginLeft: -550, background: `radial-gradient(ellipse, rgba(52,211,153,${0.16 + glow * 0.06}) 0%, transparent 70%)`, filter: "blur(30px)" }} />
      <div style={{ marginTop: 110 }}><Logo width={820} delay={0} /></div>
      <div style={{ marginTop: 50, display: "flex", gap: 30 }}>
        {[["WEBSITE", "cachencarry.loopout.tech", C.green], ["GITHUB", "github.com/Anarki-LNX/cachencarry", C.cyan]].map(([k, u, c], i) => (
          <div key={k} style={{ padding: "22px 34px", borderRadius: 22, background: "rgba(13,20,36,0.92)", border: `2px solid ${c}`, opacity: ramp(frame, 10 + i * 8, 12) }}>
            <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: 5, color: c }}>{k}</div>
            <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 34, color: C.fg }}>{u}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 34, display: "flex", gap: 16, opacity: ramp(frame, lineAt(s, 1), 12) }}>
        <Pill color="#0a0e17" border={C.green} size={30} style={{ background: C.green, fontWeight: 850 }}>OPEN SOURCE • APACHE 2.0</Pill>
        <Pill color={C.soft} border={`${C.amber}aa`} size={30}>{L.star}</Pill>
      </div>
      <div style={{ marginTop: 34, display: "flex", gap: 22 }}>
        {[[L.ask[0], C.red], [L.ask[1], C.cyan], [L.ask[2], C.amber]].map(([t, c], i) => (
          <Pill key={t} delay={ask + i * 10} color="#0a0e17" border={c} size={36} style={{ background: c, fontWeight: 900 }}>{t}</Pill>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 40, fontSize: 22, color: C.soft, opacity: 0.7 * ramp(frame, 40, 14) }}>{L.tts}</div>
    </AbsoluteFill>
  );
};

const PROXMOX_OUT: Out[] = [
  { t: "ok checksum verified", c: C.green },
  { t: ":: creating container 130" },
  { t: ":: installing Cache & Carry 0.2.3 in the container" },
  { t: "ok Cache & Carry 0.2.3 installed", c: C.green },
  { t: "" },
  { t: "Cache & Carry is running in container 130.", c: C.green },
  { t: "  Web interface   http://192.168.1.115:8080/" },
  { t: "  Setup token     ••••••••••••••••", c: C.muted },
  { t: "  Update later    run this script again with: update 130" },
];

const Proxmox = () => {
  const { L } = useLang();
  return <Way id="proxmox" n={1} name="PROXMOX VE" color={C.green} win={L.winProxmox} ps="root@pve:~#" size={24} h={560} cmd={[PROXMOX_CMD]} out={PROXMOX_OUT} points={L.ptsProxmox} />;
};
const Docker = () => {
  const { L } = useLang();
  return (
    <Way id="docker" n={2} name="DOCKER" color={C.cyan} win={L.winDocker} ps="$" size={27} h={300}
      cmd={["docker run -d --name cachencarry \\", "  --restart unless-stopped -p 8080:8080 \\", "  -v cachencarry-data:/var/lib/cachencarry \\", "  ghcr.io/anarki-lnx/cachencarry:latest"]}
      points={L.ptsDocker} />
  );
};
const Debian = () => {
  const { L } = useLang();
  return (
    <Way id="debian" n={3} name="DEBIAN / UBUNTU" color={C.amber} win={L.winServer} ps="$" size={28} h={300}
      cmd={["tar xzf cachencarry-*-linux-amd64.tar.gz", "cd cachencarry-*-linux-amd64", "sudo ./scripts/install.sh"]}
      out={[{ t: "Cache & Carry installed:   cachencarry 0.2.3", c: C.green }]}
      points={L.ptsDebian} />
  );
};

const scenes: Record<string, () => ReactNode> = {
  problem: Problem, solution: Solution, hitmiss: HitMiss, pitch: Pitch, ways: Ways,
  proxmox: Proxmox, docker: Docker, debian: Debian, setup: Setup, cta: Cta,
};

const Video = ({ lang }: { lang: Lang }) => {
  const { tl } = lang;
  return (
    <Ctx.Provider value={lang}>
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
        {tl.scenes.slice(1).map((s) => <Sfx key={s.id} at={s.start - 6} src="fx_whoosh" volume={0.3} />)}
        <Sfx at={sceneOf(tl, "cta").start + 4} src="fx_logo" volume={0.5} />
        <Voice tl={tl} />
        <Music tl={tl} src={lang.en ? "audio/music_install_en.wav" : "audio/music_install.wav"} base={0.5} duck={0.2} />
        {/* No burned-in subtitles in either version (SRT files ship separately) */}
      </AbsoluteFill>
    </Ctx.Provider>
  );
};
const LANG_DE: Lang = { tl: tlDe as Timeline, L: DE, en: false };
const LANG_EN: Lang = { tl: tlEn as Timeline, L: EN, en: true };
export const Install = () => <Video lang={LANG_DE} />;
export const InstallEn = () => <Video lang={LANG_EN} />;
export const INSTALL_FRAMES = LANG_DE.tl.frames;
export const INSTALL_EN_FRAMES = LANG_EN.tl.frames;
