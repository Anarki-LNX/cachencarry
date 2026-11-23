// Records real interface footage from the demo instance as image sequences.
// Screenshots at 2x keep zooms sharp, and the interface only changes about
// once per second, so 6 frames per second lose nothing.
//   node capture.mjs [shot ...]      (default: all shots)
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const BASE = "http://127.0.0.1:18086";
const OUT = new URL("./public/footage/", import.meta.url).pathname;
const FPS = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchAs = (client, path) => spawn("curl", ["-s", "-o", "/dev/null", "-H", `X-Forwarded-For: ${client}`, `${BASE}/${path}`], { stdio: "ignore" });
const pkg = (name) => new Promise((resolve) => {
  let out = "";
  const p = spawn("./demo.sh", ["pkg", name]);
  p.stdout.on("data", (d) => (out += d));
  p.on("close", () => resolve("pacman/archlinux/" + out.trim()));
});

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });

async function open(width, height, path) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: "dark" });
  await context.addInitScript(() => {
    localStorage.setItem("cachencarry.lang", "en");
    localStorage.setItem("cachencarry.theme", "dark");
  });
  const res = await context.request.post(`${BASE}/api/v1/login`, { data: { username: "admin", password: "demo-instance-pw" } });
  if (!res.ok()) throw new Error("login failed: " + res.status());
  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => page.goto(BASE + path));
  await sleep(1500);
  return { context, page };
}

async function still(name, width, height, path) {
  const { context, page } = await open(width, height, path);
  await page.screenshot({ path: `${OUT}${name}.png` });
  await context.close();
  console.log("still", name);
}

async function sequence(name, width, height, path, seconds, during) {
  const { context, page } = await open(width, height, path);
  const dir = `${OUT}${name}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = seconds * FPS;
  const started = Date.now();
  const side = during ? during() : Promise.resolve();
  for (let i = 0; i < frames; i++) {
    const due = started + (i * 1000) / FPS;
    if (due > Date.now()) await sleep(due - Date.now());
    await page.screenshot({ path: `${dir}${String(i).padStart(3, "0")}.jpg`, type: "jpeg", quality: 92 });
  }
  await side;
  await context.close();
  console.log("sequence", name, frames, "frames");
}

const shots = {
  "dash-wide": () => still("dash-wide", 1440, 900, "/"),
  "storage": () => still("storage", 720, 1280, "/storage"),
  "modules": () => still("modules", 720, 1280, "/modules"),
  "clients": () => still("clients", 720, 900, "/clients"),
  // Three machines ask for the same big packages at once: one download each.
  "downloads": async () => {
    const [big, mid] = [await pkg("blender"), await pkg("firefox")];
    await sequence("downloads", 720, 1280, "/downloads", 9, async () => {
      await sleep(700);
      fetchAs("10.0.10.11", big); fetchAs("10.0.10.12", big); fetchAs("10.0.10.14", big);
      await sleep(900);
      fetchAs("10.0.10.12", mid); fetchAs("10.0.10.21", mid);
    });
  },
  // Requests trickle in: first misses from the Internet, then hits from disk.
  // Wider than the other shots so the result column is in the picture.
  "traffic": async () => {
    const fresh = [await pkg("cmake"), await pkg("imagemagick"), await pkg("nodejs")];
    const cached = [await pkg("git"), await pkg("vim"), await pkg("mesa"), await pkg("python"), await pkg("docker"), await pkg("firefox")];
    await sequence("traffic", 1120, 1280, "/traffic", 9, async () => {
      const clients = ["10.0.10.11", "10.0.10.12", "10.0.10.14", "10.0.10.21"];
      for (let i = 0; i < 16; i++) {
        await sleep(480);
        const list = i < 3 ? fresh : i % 4 === 3 ? fresh : cached;
        fetchAs(clients[i % clients.length], list[i % list.length]);
      }
    });
  },
  // The dashboard while cached packages are being handed out.
  "dash-live": async () => {
    const list = [await pkg("blender"), await pkg("firefox"), await pkg("docker"), await pkg("mesa")];
    await sequence("dash-live", 720, 1280, "/", 8, async () => {
      for (let i = 0; i < 14; i++) {
        await sleep(500);
        fetchAs(["10.0.10.11", "10.0.10.12", "10.0.10.14"][i % 3], list[i % list.length]);
      }
    });
  },
};

mkdirSync(OUT, { recursive: true });
const wanted = process.argv.slice(2);
for (const [name, run] of Object.entries(shots)) if (wanted.length === 0 || wanted.includes(name)) await run();
await browser.close();
