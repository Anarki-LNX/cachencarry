// Short 6: the three ways to install. 1080 x 1920, same frame and safe areas
// as the other Shorts (text between y 200 and 1500, right margin 130 px).
// Commands are the real ones from README.md, the Proxmox output is the real
// summary of scripts/proxmox-lxc.sh with the token hidden.
import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import t6 from "./timelines/short06.json";
import { Backdrop, clamp, fade, Kicker, lineAt, Music, Pill, ramp, sceneOf, Sfx, type Timeline, Title, Voice, Win } from "./kit";
import { EndCard } from "./blocks";
import { C, FONT, MONO } from "./theme";

const S6 = t6 as Timeline;
type Out = { t: string; c?: string };

/** A command that types itself, then its output line by line. */
const Console = ({ ps, cmd, out = [], typeAt, outAt, size = 25 }: { ps: string; cmd: string[]; out?: Out[]; typeAt: number; outAt: number; size?: number }) => {
  const frame = useCurrentFrame();
  const all = cmd.join("\n");
  const shown = Math.floor(interpolate(frame, [typeAt, typeAt + 26], [0, all.length], clamp));
  const typed = all.slice(0, shown).split("\n");
  const done = shown >= all.length;
  return (
    <div style={{ padding: "22px 26px", fontFamily: MONO, fontSize: size, lineHeight: 1.45, color: C.fg, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {typed.map((l, i) => (
        <div key={i}>
          {i === 0 || !cmd[i - 1].endsWith("\\") ? <span style={{ color: C.green }}>{ps} </span> : null}
          {l}
          {i === typed.length - 1 && !done && <span style={{ background: C.soft, opacity: frame % 16 < 8 ? 1 : 0 }}>{"\u00a0"}</span>}
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        {out.map((o, i) => (
          <div key={i} style={{ color: o.c ?? C.soft, opacity: ramp(frame, outAt + i * 4, 6) }}>{o.t || " "}</div>
        ))}
      </div>
    </div>
  );
};

/** One way to install: number, name, the real command and its advantages. */
const Way = ({ id, n, name, color, win, ps, cmd, out, size, h, pills, best }: {
  id: string; n: number; name: string; color: string; win: string; ps: string; cmd: string[]; out?: Out[]; size?: number; h: number; pills: string[]; best: string;
}) => {
  const frame = useCurrentFrame();
  const s = sceneOf(S6, id);
  const typeAt = lineAt(s, 1) - 4;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, s.frames, 8) }}>
      <div style={{ position: "absolute", left: 70, right: 130, top: 200, display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ width: 120, height: 120, borderRadius: 30, background: color, color: "#0a0e17", fontFamily: FONT, fontSize: 84, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 50px ${color}88`, transform: `scale(${0.8 + ramp(frame, 0, 12) * 0.2})`, opacity: ramp(frame, 0, 8) }}>{n}</div>
        <div>
          <Kicker color={color} size={26}>{`WEG ${n} VON 3`}</Kicker>
          <Title text={name} size={78} delay={4} />
        </div>
      </div>
      <Win x={50} y={400} w={980} h={h} title={win} accent={color} glow={0.22} delay={typeAt - 10}>
        <Console ps={ps} cmd={cmd} out={out} typeAt={typeAt} outAt={typeAt + 34} size={size} />
      </Win>
      <div style={{ position: "absolute", left: 50, right: 130, top: 400 + h + 50, display: "flex", flexWrap: "wrap", gap: 14 }}>
        {pills.map((p, i) => <Pill key={p} delay={typeAt + 40 + i * 6} color={C.soft} border={`${color}88`} size={30}>{p}</Pill>)}
      </div>
      <div style={{ position: "absolute", left: 50, right: 130, top: 400 + h + 220, opacity: ramp(frame, lineAt(s, 2) - 4, 10), transform: `translateY(${(1 - ramp(frame, lineAt(s, 2) - 4, 12)) * 20}px)` }}>
        <div style={{ display: "inline-block", fontFamily: FONT, fontSize: 46, fontWeight: 850, color: "#0a0e17", background: color, borderRadius: 18, padding: "16px 30px", boxShadow: `0 0 40px ${color}66` }}>{best}</div>
      </div>
      <Sfx at={lineAt(s, 2) - 4} src="fx_hit" volume={0.35} />
    </AbsoluteFill>
  );
};

const PROXMOX_CMD = 'bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/main/scripts/proxmox-lxc.sh)"';

const Tile = ({ n, label, color, at }: { n: number; label: string; color: string; at: number }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, 14);
  return (
    <div style={{ width: 280, padding: "30px 10px", borderRadius: 26, background: "rgba(13,20,36,0.92)", border: `2px solid ${color}`, boxShadow: `0 0 40px ${color}44`, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
      <div style={{ fontFamily: FONT, fontSize: 90, fontWeight: 900, color, lineHeight: 1 }}>{n}</div>
      <div style={{ marginTop: 14, fontFamily: FONT, fontSize: 32, fontWeight: 800, color: C.fg }}>{label}</div>
    </div>
  );
};

const scenes: Record<string, () => ReactNode> = {
  hook: () => {
    const frame = useCurrentFrame();
    const s = sceneOf(S6, "hook");
    return (
      <AbsoluteFill style={{ opacity: interpolate(frame, [s.frames - 10, s.frames], [1, 0], clamp) }}>
        <div style={{ position: "absolute", left: 70, right: 130, top: 330 }}>
          <Kicker color={C.green} size={30}>CACHE & CARRY INSTALLIEREN</Kicker>
          <div style={{ height: 24 }} />
          <Title text="DREI WEGE. | EINE VERSION." size={118} accent={["EINE", "VERSION."]} delay={-30} />
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 900, display: "flex", justifyContent: "center", gap: 30 }}>
          <Tile n={1} label="Proxmox" color={C.green} at={lineAt(s, 1)} />
          <Tile n={2} label="Docker" color={C.cyan} at={lineAt(s, 1) + 6} />
          <Tile n={3} label="Debian / Ubuntu" color={C.amber} at={lineAt(s, 1) + 12} />
        </div>
      </AbsoluteFill>
    );
  },
  proxmox: () => (
    <Way id="proxmox" n={1} name="PROXMOX VE" color={C.green} win="Proxmox-Host  ·  Shell" ps="root@pve:~#" size={26} h={560}
      cmd={[PROXMOX_CMD]}
      out={[
        { t: "ok checksum verified", c: C.green },
        { t: ":: creating container 130" },
        { t: ":: installing Cache & Carry 0.2.3 in the container" },
        { t: "ok Cache & Carry 0.2.3 installed", c: C.green },
        { t: "" },
        { t: "Cache & Carry is running in container 130.", c: C.green },
        { t: "  Web interface   http://192.168.1.115:8080/" },
        { t: "  Setup token     ••••••••••••••••", c: C.muted },
      ]}
      pills={["LXC OHNE NESTING", "PRÜFSUMME GEPRÜFT", "UPDATE: -- update <ID>"]}
      best="AM SCHNELLSTEN"
    />
  ),
  docker: () => (
    <Way id="docker" n={2} name="DOCKER" color={C.cyan} win="Docker-Host  ·  Terminal" ps="$" size={29} h={330}
      cmd={[
        "docker run -d --name cachencarry \\",
        "  --restart unless-stopped -p 8080:8080 \\",
        "  -v cachencarry-data:/var/lib/cachencarry \\",
        "  ghcr.io/anarki-lnx/cachencarry:latest",
      ]}
      pills={["AMD64 UND ARM64", "UNTER 16 MB", "OHNE SHELL IM IMAGE"]}
      best="LÄUFT AUF JEDEM DOCKER-HOST"
    />
  ),
  debian: () => (
    <Way id="debian" n={3} name="DEBIAN / UBUNTU" color={C.amber} win="Server oder VM  ·  Terminal" ps="$" size={29} h={320}
      cmd={[
        "tar xzf cachencarry-*-linux-amd64.tar.gz",
        "cd cachencarry-*-linux-amd64",
        "sudo ./scripts/install.sh",
      ]}
      out={[{ t: "Cache & Carry installed:   cachencarry 0.2.3", c: C.green }]}
      pills={["SYSTEMD-DIENST", "UPDATE AN ORT UND STELLE", "RASPBERRY PI (ARM64)"]}
      best="KLASSISCH UND NATIV"
    />
  ),
  end: () => {
    const frame = useCurrentFrame();
    return (
      <AbsoluteFill style={{ opacity: interpolate(frame, [0, 10], [0, 1], clamp) }}>
        <EndCard lines={["EINE VERSION. DREI WEGE.", "KOSTENLOS • OPEN SOURCE"]} badge="LINK IN DER BESCHREIBUNG" url="cachencarry.loopout.tech" top={440} />
      </AbsoluteFill>
    );
  },
};

export const Short06 = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Backdrop />
    {S6.scenes.map((s) => {
      const Comp = scenes[s.id];
      return (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
          <Comp />
        </Sequence>
      );
    })}
    {S6.scenes.slice(1).map((s) => <Sfx key={s.id} at={s.start - 6} src="fx_whoosh" volume={0.35} />)}
    <Sfx at={S6.scenes[S6.scenes.length - 1].start + 4} src="fx_logo" volume={0.5} />
    <Voice tl={S6} />
    <Music tl={S6} src="audio/music_short06.wav" base={0.6} duck={0.24} />
    {/* German version: no burned-in subtitles (SRT files ship separately) */}
  </AbsoluteFill>
);
export const SHORT06_FRAMES = S6.frames;
