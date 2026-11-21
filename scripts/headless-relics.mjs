import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = `${process.argv[2] ?? "http://127.0.0.1:4173"}/?renderer=canvas`;
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";

async function waitReady(page, scene) {
  await page.waitForFunction(
    (want) => window.__towerForge?.ready === true && (!want || window.__towerForge.scene === want),
    scene ?? "",
    { timeout: 20000 },
  );
}
async function tapWorld(page, worldX, worldY) {
  const pt = await page.evaluate(({ worldX, worldY }) => {
    const canvas = document.querySelector("canvas");
    const r = canvas.getBoundingClientRect();
    const size = window.__towerForge.getUiRects().game;
    return { x: r.left + (worldX / size.w) * r.width, y: r.top + (worldY / size.h) * r.height };
  }, { worldX, worldY });
  await page.mouse.click(pt.x, pt.y);
}
async function tapRect(page, rect) {
  await tapWorld(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
}
async function dismissHelp(page) {
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  if (ui.helpVisible) {
    await tapRect(page, ui.helpDismiss);
    await page.waitForTimeout(200);
  }
}

const errors = [];
const pageErrors = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.goto(url, { waitUntil: "domcontentloaded" });
await waitReady(page, "bastion");
await dismissHelp(page);

const before = await page.evaluate(() => window.__towerForge.getState());
const dmgBefore = before.preview.damage;
await page.evaluate(() => window.__towerForge.giveRelic("ember-core", "magic"));
await page.waitForTimeout(80);
const ui0 = await page.evaluate(() => window.__towerForge.getUiRects());
await tapRect(page, ui0.invTabRelics);
await page.waitForTimeout(80);
const ui1 = await page.evaluate(() => window.__towerForge.getUiRects());
if (!ui1.inventory?.[0]) throw new Error("relic not in inventory");
await tapRect(page, ui1.inventory[0]);
await page.waitForTimeout(80);
await tapRect(page, ui1.relics[0]);
await page.waitForTimeout(120);
const after = await page.evaluate(() => window.__towerForge.getState());
const equipped = after.loadoutRelics?.[0];
if (!equipped || equipped.defId !== "ember-core") throw new Error(`relic not equipped: ${JSON.stringify(after.loadoutRelics)}`);
if (!(after.preview.damage > dmgBefore)) {
  throw new Error(`stats did not rise: ${dmgBefore} -> ${after.preview.damage}`);
}

await tapRect(page, (await page.evaluate(() => window.__towerForge.getUiRects())).enterBreach);
await page.waitForTimeout(120);
const depthUi = await page.evaluate(() => window.__towerForge.getUiRects());
if (depthUi.depthSelect?.enter) await tapRect(page, depthUi.depthSelect.enter);
await waitReady(page, "game");
await dismissHelp(page);
await page.evaluate(() => window.__towerForge.guaranteeDrop("relic"));
const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
const rects = await page.evaluate(() => window.__towerForge.getUiRects());
await tapRect(page, rects.towers["ember-spire"]);
await tapWorld(page, (cell.col + 0.5) * 48, (cell.row + 0.5) * 48);
await tapRect(page, rects.startWave);
for (let i = 0; i < 30; i++) {
  const st = await page.evaluate(() => window.__towerForge.getState());
  if (st.gold > 60 || (await page.evaluate(() => (window.__towerForge.getSpoils?.() ?? []).length)) > 0) break;
  await page.waitForTimeout(250);
}
await page.evaluate(() => window.__towerForge.forceOutcome("won"));
await page.waitForTimeout(200);
const spoils = await page.evaluate(() => window.__towerForge.getSpoils?.() ?? []);
if (!spoils.length) throw new Error("expected spoils after guaranteed drop + win");
await page.evaluate(() => window.__towerForge.collectSpoils());
await page.waitForTimeout(80);
const uiEnd = await page.evaluate(() => window.__towerForge.getUiRects());
if (!uiEnd.returnToBastion) throw new Error("no return button");
await tapRect(page, uiEnd.returnToBastion);
await waitReady(page, "bastion");
const hub = await page.evaluate(() => window.__towerForge.getState());
const bag = (hub.relicInventory ?? []).length + (hub.loadoutRelics ?? []).filter(Boolean).length;
if (bag < 2) throw new Error(`expected equipped + dropped relic in profile, got ${bag}`);

await browser.close();
const report = { dmgBefore, dmgAfter: after.preview.damage, equipped, spoils: spoils.length, bag, errors, pageErrors };
console.log(JSON.stringify(report, null, 2));
if (errors.length || pageErrors.length) process.exit(1);
