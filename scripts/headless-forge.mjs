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
const relic = await page.evaluate(() => window.__towerForge.giveRelic("ember-core", "normal"));
await page.evaluate(() => window.__towerForge.giveCurrency("kindle-shard", 1));
const ui0 = await page.evaluate(() => window.__towerForge.getUiRects());
await tapRect(page, ui0.tabForge);
await page.waitForTimeout(120);
const ui = await page.evaluate(() => window.__towerForge.getUiRects());
if (!ui.forgeRelics?.[0] || !ui.forgeCurrencies?.[0] || !ui.forgeApply) throw new Error("forge rects missing");
await tapRect(page, ui.forgeRelics[0]);
await page.waitForTimeout(80);
await tapRect(page, ui.forgeCurrencies[0]); // kindle-shard is first currency id
await page.waitForTimeout(80);
await tapRect(page, ui.forgeApply);
await page.waitForTimeout(150);
const after = await page.evaluate(() => {
  const r = window.__towerForge.getProfile().relicInventory.find((x) => x.defId === "ember-core");
  return { rarity: r?.rarity, affixes: r?.affixes?.length ?? 0, shards: window.__towerForge.getProfile().currency["kindle-shard"] };
});
if (after.rarity !== "magic") throw new Error(`expected magic, got ${JSON.stringify(after)}`);
if (after.shards !== 0) throw new Error(`shard not consumed: ${after.shards}`);
await browser.close();
const report = { before: relic.rarity, after, errors, pageErrors };
console.log(JSON.stringify(report, null, 2));
if (errors.length || pageErrors.length) process.exit(1);
