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
const ui0 = await page.evaluate(() => window.__towerForge.getUiRects());
await tapRect(page, ui0.tabStash);
await page.waitForTimeout(120);
const tab = (await page.evaluate(() => window.__towerForge.getState())).tab;
if (tab !== "stash") throw new Error(`expected stash tab, got ${tab}`);
await tapRect(page, ui0.enterBreach);
await page.waitForTimeout(150);
const sel = await page.evaluate(() => window.__towerForge.getUiRects().depthSelect);
if (!sel?.enter || !sel.depths?.[0]) throw new Error("depth select missing");
await tapRect(page, sel.depths[0]);
await tapRect(page, sel.enter);
await waitReady(page, "game");
const waves = (await page.evaluate(() => window.__towerForge.getState())).wave;
await page.evaluate(() => window.__towerForge.forceOutcome("won"));
await page.waitForTimeout(200);
await page.evaluate(() => window.__towerForge.collectSpoils?.());
const ret = (await page.evaluate(() => window.__towerForge.getUiRects())).returnToBastion;
await tapRect(page, ret);
await waitReady(page, "bastion");
const p = await page.evaluate(() => window.__towerForge.getProfile());
if (p.highestDepthCleared < 1) throw new Error(`depth not unlocked: ${p.highestDepthCleared}`);
if (p.unspentPoints < 1) throw new Error(`no points granted: ${p.unspentPoints}`);
await browser.close();
const report = { tab, waveOnEnter: waves, highest: p.highestDepthCleared, points: p.unspentPoints, xp: p.accountXp, errors, pageErrors };
console.log(JSON.stringify(report, null, 2));
if (errors.length || pageErrors.length) process.exit(1);
