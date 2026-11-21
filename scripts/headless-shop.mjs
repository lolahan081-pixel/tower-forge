import { chromium } from "playwright";
const url = `${process.argv[2] ?? "http://127.0.0.1:4173"}/?renderer=canvas&timescale=8`;
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
await tapRect(page, (await page.evaluate(() => window.__towerForge.getUiRects())).enterBreach);
await waitReady(page, "game");
const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
const ui = await page.evaluate(() => window.__towerForge.getUiRects());
await tapRect(page, ui.towers["ember-spire"]);
await tapWorld(page, (cell.col + 0.5) * 48, (cell.row + 0.5) * 48);
const invBefore = (await page.evaluate(() => window.__towerForge.getProfile().runeInventory.length + window.__towerForge.getProfile().sigilInventory.length));
await tapRect(page, ui.startWave);
let shop = [];
for (let i = 0; i < 40; i++) {
  shop = await page.evaluate(() => window.__towerForge.shopOffers?.() ?? []);
  if (shop.length) break;
  await page.waitForTimeout(200);
}
if (!shop.length) throw new Error("shop did not open after wave 1");
const offer = shop[0];
const goldBefore = (await page.evaluate(() => window.__towerForge.getState())).gold;
const bought = await page.evaluate(() => window.__towerForge.buyShop(0));
if (!bought) throw new Error("buy failed");
const goldAfter = (await page.evaluate(() => window.__towerForge.getState())).gold;
const invAfter = (await page.evaluate(() => window.__towerForge.getProfile().runeInventory.length + window.__towerForge.getProfile().sigilInventory.length));
if (goldAfter !== goldBefore - offer.price) throw new Error(`gold ${goldBefore} -> ${goldAfter}, price ${offer.price}`);
if (invAfter !== invBefore + 1) throw new Error(`inventory ${invBefore} -> ${invAfter}`);
await browser.close();
const report = { goldBefore, goldAfter, price: offer.price, defId: offer.gem.defId, errors, pageErrors };
console.log(JSON.stringify(report, null, 2));
if (errors.length || pageErrors.length) process.exit(1);
