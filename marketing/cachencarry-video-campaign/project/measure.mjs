// Prints the boxes (CSS pixels, page coordinates) of interface elements, so
// highlights in the video sit exactly on them.
import { chromium } from "playwright-core";
const BASE = "http://127.0.0.1:18086";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem("cachencarry.lang", "en"); });
await ctx.request.post(`${BASE}/api/v1/login`, { data: { username: "admin", password: "demo-instance-pw" } });
const page = await ctx.newPage();
const box = async (path, label, finder) => {
  await page.goto(BASE + path); await page.waitForTimeout(1500);
  const b = await finder(page).first().boundingBox().catch(() => null);
  console.log(path, label, b ? `{ x: ${Math.round(b.x)}, y: ${Math.round(b.y)}, w: ${Math.round(b.width)}, h: ${Math.round(b.height)} }` : "not found");
};
const card = (p, title) => p.locator("section, div").filter({ has: p.getByText(title, { exact: true }) }).filter({ hasNot: p.locator("main > *:first-child h1") });
for (const t of ["Hit ratio", "Bandwidth saved", "Active downloads", "Active clients"]) {
  await box("/", t, (p) => p.getByText(t, { exact: true }).locator("xpath=ancestor::*[contains(@class,'rounded')][1]"));
}
await box("/clients", "table", (p) => p.locator("table"));
await box("/clients", "status header", (p) => p.getByText("Status", { exact: true }));
await box("/clients", "first active", (p) => p.getByText("active", { exact: true }));
await box("/clients", "card title", (p) => p.getByText(/clients ·/i));
await browser.close();
