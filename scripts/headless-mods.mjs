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
async function enterDepth(page, depth = 1) {
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  await tapRect(page, ui.enterBreach);
  await page.waitForTimeout(150);
  const sel = await page.evaluate(() => window.__towerForge.getUiRects().depthSelect);
  if (sel?.depths?.[depth - 1]) await tapRect(page, sel.depths[depth - 1]);
  if (sel?.enter) await tapRect(page, sel.enter);
  await waitReady(page, "game");
}
const errors = []; const pageErrors = [];
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist","--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.goto(url, { waitUntil: "domcontentloaded" });
await waitReady(page, "bastion");
await dismissHelp(page);
await enterDepth(page, 1);
const rare = await page.evaluate(() => window.__towerForge.spawnModified("rare"));
if (!rare || rare.rarity !== "rare" || rare.mods.length < 3 || rare.mods.length > 4) {
  throw new Error(`bad rare pack: ${JSON.stringify(rare)}`);
}
const magic = await page.evaluate(() => window.__towerForge.spawnModified("magic"));
if (!magic || magic.rarity !== "magic" || magic.mods.length < 1 || magic.mods.length > 2) {
  throw new Error(`bad magic pack: ${JSON.stringify(magic)}`);
}
const unique = await page.evaluate(() => window.__towerForge.spawnModified("unique"));
if (!unique || unique.rarity !== "unique") throw new Error(`bad unique: ${JSON.stringify(unique)}`);
await browser.close();
const report = { rare, magic, unique, errors, pageErrors };
console.log(JSON.stringify(report, null, 2));
if (errors.length || pageErrors.length) process.exit(1);
