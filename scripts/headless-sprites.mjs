import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = join(root, "screenshots");
mkdirSync(shots, { recursive: true });
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const url = `${base}/?renderer=canvas`;
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";

async function waitReady(page, scene) {
  await page.waitForFunction(
    (s) => window.__towerForge?.ready === true && (!s || window.__towerForge.scene === s),
    scene ?? "",
    { timeout: 20000 },
  );
}
async function tapWorld(page, x, y) {
  const pt = await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector("canvas");
    const r = canvas.getBoundingClientRect();
    const g = window.__towerForge.getUiRects().game;
    return { x: r.left + (x / g.w) * r.width, y: r.top + (y / g.h) * r.height };
  }, { x, y });
  await page.mouse.click(pt.x, pt.y);
}
async function tapRect(page, rect) {
  if (!rect || !(rect.w > 0) || !(rect.h > 0)) throw new Error(`bad rect ${JSON.stringify(rect)}`);
  await tapWorld(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
}
async function ui(page) {
  return page.evaluate(() => window.__towerForge.getUiRects());
}
async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const r = await ui(page);
    if (r.shopHelpOk) { await tapRect(page, r.shopHelpOk); await page.waitForTimeout(120); continue; }
    if (r.shop) { await tapRect(page, r.shop.close); await page.waitForTimeout(120); continue; }
    if (r.spoilsTake) { await tapRect(page, r.spoilsTake); await page.waitForTimeout(120); continue; }
    if (r.unlockOk) { await tapRect(page, r.unlockOk); await page.waitForTimeout(120); continue; }
    if (r.battleHintOk) { await tapRect(page, r.battleHintOk); await page.waitForTimeout(120); continue; }
    break;
  }
}
async function shot(page, name) {
  await page.waitForTimeout(80);
  await page.screenshot({ path: join(shots, `${name}.png`) });
}
async function fresh(page) {
  await page.addInitScript(() => {
    localStorage.removeItem("tower-forge-profile");
    localStorage.removeItem("tower-forge-help-seen");
  });
}
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

async function openPage(browser, viewport, extras = {}) {
  const errors = [];
  const pageErrors = [];
  const context = await browser.newContext({ viewport, ...extras });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await fresh(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "menu");
  return { context, page, errors, pageErrors };
}

async function goBastion(page) {
  const r = await ui(page);
  if (!r.menuBastion) throw new Error("no bastion button");
  await tapRect(page, r.menuBastion);
  await waitReady(page, "bastion");
  await dismissOverlays(page);
}

async function runDesktop(browser) {
  const { context, page, errors, pageErrors } = await openPage(browser, { width: 1366, height: 768 });
  await goBastion(page);
  await page.evaluate(() => {
    const api = window.__towerForge;
    api.setHighestDepthCleared(4);
    api.giveRune?.("split-volley");
    api.giveRune?.("quickening");
    api.giveRelic("ember-core", "rare");
    api.giveRelic("blood-censer", "magic");
    for (const id of ["kindle-shard", "ash-mote", "crown-cinder", "sovereign-ember", "rift-salt", "null-ash", "blight-heart", "unbinding-tear"]) {
      api.giveCurrency?.(id, 3);
    }
  });
  await dismissOverlays(page);
  await page.waitForTimeout(200);
  await shot(page, "sprites-hub");

  const forgeTab = (await ui(page)).tabForge;
  if (!forgeTab) throw new Error("no forge tab");
  await tapRect(page, forgeTab);
  await page.waitForTimeout(200);
  await shot(page, "sprites-forge");

  await page.evaluate(() => window.__towerForge.openAtlas());
  await page.waitForTimeout(200);
  if (!(await ui(page)).atlas) throw new Error("atlas did not open");
  await shot(page, "sprites-atlas");
  const enter = (await ui(page)).atlas.enter;
  await tapRect(page, enter);
  await waitReady(page, "game");
  await dismissOverlays(page);

  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const placed = await page.evaluate((c) => window.__towerForge.placeTower(c.col, c.row, "ember-spire"), cell);
  if (!placed) throw new Error("place ember-spire failed");
  const cell2 = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  await page.evaluate((c) => window.__towerForge.placeTower(c.col, c.row, "blood-font"), cell2);
  await page.evaluate(() => {
    window.__towerForge.guaranteeRarity?.("rare");
    for (let i = 0; i < 5; i++) window.__towerForge.spawnModified?.("rare");
    window.__towerForge.spawnModified?.("unique");
  });
  const started = await page.evaluate(() => window.__towerForge.startWave());
  if (!started) throw new Error("startWave failed");
  await page.waitForFunction(() => (window.__towerForge.getState().enemiesAlive ?? 0) >= 4, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  await shot(page, "sprites-battle");

  await page.evaluate(() => window.__towerForge.openShop());
  await page.waitForTimeout(150);
  const shopUi = await ui(page);
  if (!shopUi.shop?.panel) throw new Error("shop panel rect missing");
  if (!shopUi.menuButton) throw new Error("menu button missing");
  const shopOverlap = overlaps(shopUi.shop.panel, shopUi.menuButton);
  await page.evaluate(() => {
    const api = window.__towerForge;
    // close shop via hook path: hide by tapping continue if needed later
  });
  await tapRect(page, shopUi.shop.close);
  await page.waitForTimeout(120);

  // Fresh breach so the stress count is exactly 300 (no leftover wave spawns).
  await page.evaluate(() => window.__towerForge.forceOutcome("won"));
  await page.waitForTimeout(120);
  await dismissOverlays(page);
  const ret = (await ui(page)).returnToBastion;
  if (ret) await tapRect(page, ret);
  await waitReady(page, "bastion");
  await dismissOverlays(page);
  await page.evaluate(() => window.__towerForge.enterAtlasNode("ash-gate"));
  await waitReady(page, "game");
  await dismissOverlays(page);
  const stressCell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  await page.evaluate((c) => window.__towerForge.placeTower(c.col, c.row, "ember-spire"), stressCell);
  const stress = await page.evaluate(() => window.__towerForge.stress(300));
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(250);
    const s = await page.evaluate(() => window.__towerForge.getState());
    samples.push({ fps: s.fps, enemies: s.enemiesAlive });
  }
  const fpsList = samples.map((s) => s.fps);
  const minFps = Math.min(...fpsList);
  const avgFps = Math.round((fpsList.reduce((a, b) => a + b, 0) / fpsList.length) * 10) / 10;

  await context.close();
  return {
    errors,
    pageErrors,
    shopOverlap,
    shopPanel: shopUi.shop.panel,
    menuButton: shopUi.menuButton,
    stress,
    samples,
    minFps,
    avgFps,
    lastFps: fpsList[fpsList.length - 1],
  };
}

async function runMobile(browser) {
  const { context, page, errors, pageErrors } = await openPage(browser, { width: 844, height: 390 }, {
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await goBastion(page);
  await page.evaluate(() => window.__towerForge.openAtlas());
  await page.waitForTimeout(200);
  if (!(await ui(page)).atlas) throw new Error("atlas missing on mobile");
  await tapRect(page, (await ui(page)).atlas.enter);
  await waitReady(page, "game");
  await dismissOverlays(page);
  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const placed = await page.evaluate((c) => window.__towerForge.placeTower(c.col, c.row), cell);
  if (!placed) throw new Error("mobile placeTower failed");
  const started = await page.evaluate(() => window.__towerForge.startWave());
  if (!started) throw new Error("mobile startWave failed");
  await page.waitForFunction(() => (window.__towerForge.getState().enemiesAlive ?? 0) >= 1, null, { timeout: 15000 });
  await page.evaluate(() => window.__towerForge.openShop());
  await page.waitForTimeout(150);
  const shopUi = await ui(page);
  const shopOverlap = !!(shopUi.shop?.panel && shopUi.menuButton && overlaps(shopUi.shop.panel, shopUi.menuButton));
  const startH = await page.evaluate(() => {
    const r = window.__towerForge.getUiRects();
    const canvas = document.querySelector("canvas");
    const box = canvas.getBoundingClientRect();
    const g = r.game;
    return (r.menuButton.h / g.h) * box.height;
  });
  await context.close();
  return { errors, pageErrors, shopOverlap, startH, enemies: true };
}

const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
});

try {
  const desktop = await runDesktop(browser);
  const mobile = await runMobile(browser);
  const report = { desktop, mobile };
  console.log(JSON.stringify(report, null, 2));
  if (desktop.errors.length || desktop.pageErrors.length) {
    throw new Error(`desktop console errors: ${JSON.stringify({ errors: desktop.errors, pageErrors: desktop.pageErrors })}`);
  }
  if (mobile.errors.length || mobile.pageErrors.length) {
    throw new Error(`mobile console errors: ${JSON.stringify({ errors: mobile.errors, pageErrors: mobile.pageErrors })}`);
  }
  if (desktop.shopOverlap) throw new Error("shop panel still overlaps MENU");
  if (mobile.shopOverlap) throw new Error("shop panel overlaps MENU on mobile");
  if (desktop.minFps < 55) throw new Error(`stress fps too low: min=${desktop.minFps} avg=${desktop.avgFps} samples=${JSON.stringify(desktop.samples)}`);
  console.log("OK");
} finally {
  await browser.close();
}
