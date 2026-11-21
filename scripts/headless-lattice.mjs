import { chromium } from "playwright";
const url = `${process.argv[2] ?? "http://127.0.0.1:4173"}/?renderer=canvas`;
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";
async function waitReady(page, scene) {
  await page.waitForFunction((s) => window.__towerForge?.ready === true && (!s || window.__towerForge.scene === s), scene ?? "", { timeout: 20000 });
}
async function tapWorld(page, x, y) {
  const pt = await page.evaluate(({ x, y }) => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    const g = window.__towerForge.getUiRects().game;
    return { x: r.left + (x / g.w) * r.width, y: r.top + (y / g.h) * r.height };
  }, { x, y });
  await page.mouse.click(pt.x, pt.y);
}
async function tapRect(page, rect) { await tapWorld(page, rect.x + rect.w / 2, rect.y + rect.h / 2); }
async function dismissHelp(page) {
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  if (ui.helpVisible) { await tapRect(page, ui.helpDismiss); await page.waitForTimeout(200); }
}
const errors = []; const pageErrors = [];
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist","--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.goto(url, { waitUntil: "domcontentloaded" });
await waitReady(page, "bastion");
await dismissHelp(page);

const before = await page.evaluate(() => {
  const s = window.__towerForge.getState();
  return { damage: s.preview?.damage, tab: s.tab };
});

await page.evaluate(() => window.__towerForge.givePoints?.(3));
const ui0 = await page.evaluate(() => window.__towerForge.getUiRects());
await tapRect(page, ui0.tabLattice);
await page.waitForTimeout(150);
const ui1 = await page.evaluate(() => window.__towerForge.getUiRects());
const hearth = ui1.latticeNodes?.["hearth-ember"];
if (!hearth) throw new Error("hearth node missing");
await tapRect(page, hearth);
await page.waitForTimeout(120);
const afterHearth = await page.evaluate(() => window.__towerForge.getProfile());
if (!afterHearth.allocatedNodes.includes("hearth-ember")) {
  throw new Error(`hearth not allocated: ${JSON.stringify(afterHearth.allocatedNodes)}`);
}
const shaft = (await page.evaluate(() => window.__towerForge.getUiRects())).latticeNodes?.["searing-shaft"];
if (!shaft) throw new Error("searing-shaft missing");
await tapRect(page, shaft);
await page.waitForTimeout(120);
const mid = await page.evaluate(() => window.__towerForge.getProfile());
if (!mid.allocatedNodes.includes("searing-shaft")) {
  throw new Error(`shaft not allocated: ${JSON.stringify(mid.allocatedNodes)}`);
}

const ui2 = await page.evaluate(() => window.__towerForge.getUiRects());
await tapRect(page, ui2.tabLoadout);
await page.waitForTimeout(150);
const after = await page.evaluate(() => {
  const s = window.__towerForge.getState();
  return { damage: s.preview?.damage, tab: s.tab };
});

await browser.close();
const report = { before, after, allocated: mid.allocatedNodes, unspent: mid.unspentPoints, errors, pageErrors };
console.log(JSON.stringify(report, null, 2));
if (errors.length || pageErrors.length) process.exit(1);
if (mid.unspentPoints !== 1) throw new Error(`expected 1 unspent, got ${mid.unspentPoints}`);
if (!(after.damage > before.damage)) throw new Error(`damage did not rise: ${before.damage} -> ${after.damage}`);
