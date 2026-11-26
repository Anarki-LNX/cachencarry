// Records the real interface of the demo instance (German, dark) and, where a
// scene needs it, real pacman clients at the same moment.
//   node capture.mjs [shot ...]          (default: all shots)
// Requirements: ./demo.sh start, node relay.mjs, docker (archlinux:latest).
// Footage goes to public/footage/<shot>/ (jpg sequences at 6 fps, 2x pixels)
// and public/footage/<shot>.png (stills). Terminal casts go to
// ../assets/recordings/casts and their start offset (seconds after the first
// footage frame) to public/footage/<shot>.json.
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const SITE = "http://cachencarry.lan:8080";
const OUT = new URL("./public/footage/", import.meta.url).pathname;
const CASTS = new URL("../assets/recordings/casts/", import.meta.url).pathname;
const FPS = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execFileSync("bash", ["-c", cmd], { stdio: "inherit" });

function cast(scene, name, size = "80x18") {
  return new Promise((resolve) => {
    const p = spawn("asciinema", ["rec", "-q", "--headless", "--window-size", size, "--overwrite", "-c", `term/drive.sh term/scenes/${scene}.scene`, `${CASTS}${name}.cast`], { stdio: "ignore" });
    p.on("close", resolve);
  });
}
const fetchAs = (n, path) => new Promise((resolve) => {
  const p = spawn("curl", ["-s", "-o", "/dev/null", `http://127.0.0.1:${18100 + n}/${path}`], { stdio: "ignore" });
  p.on("close", resolve);
});

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", proxy: { server: "http://127.0.0.1:18099", bypass: "<-loopback>" } });

let session = null; // one login for all shots (the login endpoint is rate limited)
async function open(width, height, path, scale = 2) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "dark", ...(session ? { storageState: session } : {}) });
  await context.addInitScript(() => {
    localStorage.setItem("cachencarry.lang", "de");
    localStorage.setItem("cachencarry.theme", "dark");
  });
  const page = await context.newPage();
  // Log in from inside the page (the API client of Playwright cannot use a plain HTTP proxy).
  if (!session) {
  await page.goto(SITE + "/login", { waitUntil: "domcontentloaded" });
  const status = await page.evaluate(async () => (await fetch("/api/v1/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "demo-instance-pw" }) })).status);
  if (status >= 300) throw new Error("login failed: " + status);
  session = await context.storageState();
  }
  await page.goto(SITE + path, { waitUntil: "networkidle" }).catch(() => {});
  await sleep(1500);
  return { context, page };
}

async function still(name, width, height, path, { full = false, before } = {}) {
  const { context, page } = await open(width, height, path);
  if (before) await before(page);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: full });
  await context.close();
  console.log("still", name);
}

async function sequence(name, width, height, path, seconds, during) {
  const { context, page } = await open(width, height, path);
  const dir = `${OUT}${name}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = Math.round(seconds * FPS);
  const started = Date.now();
  const marks = {};
  const mark = (k) => (marks[k] = (Date.now() - started) / 1000);
  const side = during ? during(mark) : Promise.resolve();
  for (let i = 0; i < frames; i++) {
    const due = started + (i * 1000) / FPS;
    if (due > Date.now()) await sleep(due - Date.now());
    await page.screenshot({ path: `${dir}${String(i).padStart(3, "0")}.jpg`, type: "jpeg", quality: 90 });
  }
  await side;
  writeFileSync(`${OUT}${name}.json`, JSON.stringify({ frames, fps: FPS, marks }, null, 1));
  await context.close();
  console.log("sequence", name, frames, "frames", JSON.stringify(marks));
}

const shots = {
  // A request for vim from machine 1 (MISS, fetched from the mirror) and then
  // the same from machine 2 (HIT, from the cache), with Live-Traffic open.
  hitmiss: async () => {
    sh("term/reset-arch.sh 3 relay && for i in 1 2 3; do docker exec ccdemo-pc$i pacman -Sy >/dev/null; done");
    await sequence("hitmiss", 1600, 1000, "/traffic", 30, async (mark) => {
      await sleep(1500);
      mark("pc1");
      await cast("hitmiss-pc1", "hitmiss-pc1");
      mark("pc1done");
      await sleep(800);
      mark("pc2");
      await cast("hitmiss-pc2", "hitmiss-pc2");
      mark("pc2done");
    });
  },
  // Three machines want the same uncached 42 MiB package at the same moment.
  shared: async () => {
    await sequence("shared", 1600, 1000, "/downloads", 22, async (mark) => {
      await sleep(1200);
      mark("start");
      await Promise.all([1, 2, 3].map((i) => cast(`shared-pc${i}`, `shared-pc${i}`)));
      mark("done");
    });
  },
  // Ten machines, one file: the linux kernel package, requested by ten
  // addresses at once with plain HTTP clients.
  ten: async () => {
    const path = execFileSync("./demo.sh", ["pkg", "linux"]).toString().trim();
    await sequence("ten", 1600, 1000, "/downloads", 16, async (mark) => {
      await sleep(1200);
      mark("start");
      await Promise.all([...Array(10)].map((_, k) => sleep(k * 120).then(() => fetchAs(11 + k, "pacman/archlinux/" + path))));
      mark("done");
    });
  },
  // The dashboard while packages are handed out to several machines.
  "dash-live": async () => {
    const list = ["vim", "go", "linux", "mesa", "python", "docker", "cmake", "nodejs"].map((p) => "pacman/archlinux/" + execFileSync("./demo.sh", ["pkg", p]).toString().trim());
    await sequence("dash-live", 1600, 1000, "/", 12, async () => {
      for (let i = 0; i < 22; i++) {
        await sleep(450);
        fetchAs(11 + (i % 6), list[i % list.length]);
      }
    });
  },
  stills: async () => {
    await still("dash", 1600, 1000, "/");
    await still("dash-full", 1600, 1000, "/", { full: true });
    await still("traffic", 1600, 1000, "/traffic");
    await still("storage", 1600, 1000, "/storage");
    await still("modules", 1600, 1000, "/modules");
    await still("statistics", 1600, 1000, "/statistics", { full: true });
    await still("settings", 1600, 1000, "/settings", { full: true });
    await still("clients", 1600, 1000, "/clients");
    await still("repositories", 1600, 1000, "/repositories");
    await still("health", 1600, 1000, "/health");
    await still("modules-portrait", 720, 1280, "/modules");
    await still("dash-portrait", 720, 1280, "/", { full: true });
    await still("storage-portrait", 720, 1280, "/storage");
  },
};

mkdirSync(OUT, { recursive: true });
mkdirSync(CASTS, { recursive: true });
const wanted = process.argv.slice(2);
for (const [name, run] of Object.entries(shots)) if (wanted.length === 0 || wanted.includes(name)) await run();
await browser.close();
