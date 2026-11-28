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

function overlaps(a, b) {
  if (!a || !b || !(a.w > 0) || !(b.w > 0)) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

async function waitReady(page, scene) {
  await page.waitForFunction(
    (s) => window.__towerForge?.ready === true && (!s || window.__towerForge.scene === s),
    scene ?? "",
    { timeout: 20000 },
  );
}

async function worldToScreen(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector("canvas");
    const r = canvas.getBoundingClientRect();
    const g = window.__towerForge.getUiRects().game;
    return { x: r.left + (x / g.w) * r.width, y: r.top + (y / g.h) * r.height };
  }, { x, y });
}

async function tapWorld(page, x, y, touch) {
  const pt = await worldToScreen(page, x, y);
  if (touch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
}

async function tapRect(page, rect, touch = false) {
  if (!rect || !(rect.w > 0) || !(rect.h > 0)) throw new Error(`bad rect ${JSON.stringify(rect)}`);
  await tapWorld(page, rect.x + rect.w / 2, rect.y + rect.h / 2, touch);
}

async function moveTo(page, x, y) {
  const pt = await worldToScreen(page, x, y);
  await page.mouse.move(pt.x, pt.y);
}

async function ui(page) {
  return page.evaluate(() => window.__towerForge.getUiRects());
}

async function dismissOverlays(page, touch = false) {
  for (let i = 0; i < 10; i++) {
    const r = await ui(page);
    if (r.shopHelpOk) { await tapRect(page, r.shopHelpOk, touch); await page.waitForTimeout(80); continue; }
    if (r.shop) { await tapRect(page, r.shop.close, touch); await page.waitForTimeout(80); continue; }
    if (r.spoilsTake) { await tapRect(page, r.spoilsTake, touch); await page.waitForTimeout(80); continue; }
    if (r.unlockOk) { await tapRect(page, r.unlockOk, touch); await page.waitForTimeout(80); continue; }
    if (r.battleHintOk) { await tapRect(page, r.battleHintOk, touch); await page.waitForTimeout(80); continue; }
    break;
  }
}

async function openPage(browser, viewport, extras = {}) {
  const errors = [];
  const pageErrors = [];
  const context = await browser.newContext({ viewport, ...extras });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.removeItem("tower-forge-profile");
    localStorage.removeItem("tower-forge-help-seen");
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "menu");
  return { context, page, errors, pageErrors };
}

async function goGame(page, touch = false) {
  const r = await ui(page);
  if (!r.menuBastion) throw new Error("no bastion button");
  await tapRect(page, r.menuBastion, touch);
  await waitReady(page, "bastion");
  await dismissOverlays(page, touch);
  const ok = await page.evaluate(() => window.__towerForge.enterAtlasNode("ash-gate"));
  if (!ok) throw new Error("enter ash-gate failed");
  await waitReady(page, "game");
  await dismissOverlays(page, touch);
}

function assertNoOverlap(rects, label) {
  const menu = rects.menuButton;
  const hudY = 14 * 48;
  const offenders = [];
  const check = (name, box) => {
    if (!box) return;
    if (menu && overlaps(box, menu)) offenders.push(`${name} overlaps MENU`);
    if (box.y + box.h > hudY + 1 && box.y < hudY + 120 && name !== "hud") {
      // panel/picker should stay above the HUD
      if (box.y < hudY && box.y + box.h > hudY) offenders.push(`${name} overlaps HUD`);
    }
  };
  if (rects.panel) {
    check("currentSigil", rects.panel.currentSigil);
    check("changeSigil", rects.panel.changeSigil);
    check("sell", rects.panel.sell);
    check("panelClose", rects.panel.close);
    if (rects.panel.picker) {
      check("pickerClose", rects.panel.picker.close);
      check("pickerRemove", rects.panel.picker.remove);
      for (const c of rects.panel.picker.cells) check("pickerCell", c);
    }
  }
  if (rects.confirmPlace) check("confirmPlace", rects.confirmPlace);
  if (offenders.length) throw new Error(`${label}: ${offenders.join("; ")}`);
}

async function menuScreenHeight(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const r = canvas.getBoundingClientRect();
    const ui = window.__towerForge.getUiRects();
    return (ui.menuButton.h / ui.game.h) * r.height;
  });
}

async function runDesktop(browser) {
  const { context, page, errors, pageErrors } = await openPage(browser, { width: 1366, height: 768 });
  await goGame(page);
  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const cellX = (cell.col + 0.5) * 48;
  const cellY = (cell.row + 0.5) * 48;

  const bar = (await ui(page)).towers["ember-spire"];
  if (!bar) throw new Error("ember-spire bar missing");
  await tapRect(page, bar);
  await page.waitForTimeout(80);
  let rects = await ui(page);
  if (!rects.placing) throw new Error("selecting a frame did not enter place mode");
  if (!rects.cancelPlace) throw new Error("CANCEL missing while placing");
  await moveTo(page, cellX, cellY);
  await page.waitForTimeout(80);
  await page.screenshot({ path: join(shots, "ux-place.png") });

  await tapRect(page, rects.cancelPlace);
  await page.waitForTimeout(80);
  let state = await page.evaluate(() => window.__towerForge.getState());
  rects = await ui(page);
  if (state.towers !== 0) throw new Error("cancel still placed a frame");
  if (rects.placing) throw new Error("cancel did not leave place mode");

  await tapRect(page, bar);
  await page.waitForTimeout(80);
  await tapWorld(page, cellX, cellY, false);
  await page.waitForTimeout(80);
  state = await page.evaluate(() => window.__towerForge.getState());
  if (state.towers !== 1) throw new Error(`expected 1 frame after click-place, got ${state.towers}`);

  await tapWorld(page, cellX, cellY, false);
  await page.waitForTimeout(120);
  rects = await ui(page);
  if (!rects.panel) throw new Error("inspect panel did not open");
  if (!rects.panel.changeSigil || !rects.panel.sell) throw new Error("panel missing CHANGE/SELL");
  assertNoOverlap(rects, "panel");
  await page.screenshot({ path: join(shots, "ux-panel.png") });

  await tapRect(page, rects.panel.changeSigil);
  await page.waitForTimeout(120);
  rects = await ui(page);
  if (!rects.panel?.picker) throw new Error("sigil picker did not open");
  if (!rects.panel.picker.cells || rects.panel.picker.cells.length < 2) throw new Error("picker has no sigils");
  assertNoOverlap(rects, "picker");
  await page.screenshot({ path: join(shots, "ux-sigil-pick.png") });

  // Inventory order: cinder-orb, forked-spark, hoarfrost-burst, crimson-spike.
  // Ember Spire (projectile) accepts crimson-spike (index 3) and cinder-orb (index 0).
  const pick = rects.panel.picker.cells[3] ?? rects.panel.picker.cells[0];
  await tapRect(page, pick);
  await page.waitForTimeout(120);
  state = await page.evaluate(() => window.__towerForge.getState());
  const sock = state.towerSockets?.[0]?.sockets?.[0];
  if (rects.panel.picker.cells[3] && sock?.defId !== "crimson-spike") {
    throw new Error(`expected crimson-spike after pick, got ${sock?.defId}`);
  }

  rects = await ui(page);
  if (!rects.panel?.sell) {
    await tapWorld(page, cellX, cellY, false);
    await page.waitForTimeout(80);
    rects = await ui(page);
  }
  const goldBefore = state.gold;
  await tapRect(page, rects.panel.sell);
  await page.waitForTimeout(80);
  state = await page.evaluate(() => window.__towerForge.getState());
  if (state.towers !== 0) throw new Error("sell did not remove the frame");
  if (!(state.gold > goldBefore)) throw new Error(`sell did not refund gold (${goldBefore} -> ${state.gold})`);

  const goldAfterSell = state.gold;
  await context.close();

  const third = await openPage(browser, { width: 1366, height: 768 });
  errors.push(...third.errors);
  pageErrors.push(...third.pageErrors);
  await goGame(third.page);
  const stress = await third.page.evaluate(() => window.__towerForge.stress(300));
  await third.page.waitForTimeout(200);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    await third.page.waitForTimeout(150);
    const s = await third.page.evaluate(() => window.__towerForge.getState());
    samples.push({ fps: s.fps, enemies: s.enemiesAlive });
  }
  const fpsList = samples.map((s) => s.fps);
  const minFps = Math.min(...fpsList);
  const avgFps = Math.round((fpsList.reduce((a, b) => a + b, 0) / fpsList.length) * 10) / 10;
  await third.context.close();
  return { errors, pageErrors, cell, goldAfterSell, stress, samples, minFps, avgFps };
}

async function runMobile(browser) {
  const { context, page, errors, pageErrors } = await openPage(browser, { width: 844, height: 390 }, {
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await goGame(page, false);
  const menuPx = await menuScreenHeight(page);
  if (menuPx < 44) throw new Error(`MENU is ${menuPx.toFixed(1)}px high on iPhone 12 landscape, need >= 44`);
  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const cellX = (cell.col + 0.5) * 48;
  const cellY = (cell.row + 0.5) * 48;
  const bar = (await ui(page)).towers["ember-spire"];
  await tapRect(page, bar, false);
  await page.waitForTimeout(80);
  await tapWorld(page, cellX, cellY, false);
  await page.waitForTimeout(120);
  let state = await page.evaluate(() => window.__towerForge.getState());
  let rects = await ui(page);
  if (state.towers !== 0) throw new Error("mobile first tap placed a frame without confirm");
  if (!rects.confirmPlace) throw new Error("mobile confirm PLACE button missing");
  if (!rects.pendingCell) throw new Error("mobile pending cell missing");
  assertNoOverlap(rects, "mobile-confirm");
  await page.screenshot({ path: join(shots, "ux-mobile.png") });
  await tapRect(page, rects.confirmPlace, false);
  await page.waitForTimeout(120);
  state = await page.evaluate(() => window.__towerForge.getState());
  if (state.towers !== 1) throw new Error(`mobile confirm did not place, towers=${state.towers}`);
  await tapWorld(page, cellX, cellY, false);
  await page.waitForTimeout(120);
  rects = await ui(page);
  if (!rects.panel) throw new Error("mobile inspect panel missing");
  assertNoOverlap(rects, "mobile-panel");
  await tapRect(page, rects.panel.changeSigil, false);
  await page.waitForTimeout(120);
  rects = await ui(page);
  if (!rects.panel?.picker) throw new Error("mobile sigil picker missing");
  const pick = rects.panel.picker.cells[3] ?? rects.panel.picker.cells[0];
  await tapRect(page, pick, false);
  await page.waitForTimeout(120);
  rects = await ui(page);
  if (!rects.panel?.sell) {
    await tapWorld(page, cellX, cellY, false);
    await page.waitForTimeout(80);
    rects = await ui(page);
  }
  await tapRect(page, rects.panel.sell, false);
  await page.waitForTimeout(80);
  state = await page.evaluate(() => window.__towerForge.getState());
  if (state.towers !== 0) throw new Error("mobile sell failed");
  await context.close();
  return { errors, pageErrors, menuPx, cell };
}

const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
});

try {
  const desktop = await runDesktop(browser);
  console.log("desktop ok", JSON.stringify({ cell: desktop.cell, goldAfterSell: desktop.goldAfterSell, minFps: desktop.minFps, avgFps: desktop.avgFps, errors: desktop.errors, pageErrors: desktop.pageErrors }));
  const mobile = await runMobile(browser);
  const report = {
    desktop: {
      cell: desktop.cell,
      goldAfterSell: desktop.goldAfterSell,
      stress: { spawned: desktop.stress.spawned, spawnFps: desktop.stress.fps, minFps: desktop.minFps, avgFps: desktop.avgFps, samples: desktop.samples },
      errors: desktop.errors,
      pageErrors: desktop.pageErrors,
    },
    mobile: { cell: mobile.cell, menuPx: Math.round(mobile.menuPx * 10) / 10, errors: mobile.errors, pageErrors: mobile.pageErrors },
    shots: ["ux-place.png", "ux-panel.png", "ux-sigil-pick.png", "ux-mobile.png"],
  };
  console.log(JSON.stringify(report, null, 2));
  if (desktop.errors.length || desktop.pageErrors.length) throw new Error(`desktop errors ${JSON.stringify({ errors: desktop.errors, pageErrors: desktop.pageErrors })}`);
  if (mobile.errors.length || mobile.pageErrors.length) throw new Error(`mobile errors ${JSON.stringify({ errors: mobile.errors, pageErrors: mobile.pageErrors })}`);
  if (desktop.minFps < 55) throw new Error(`stress fps too low: min=${desktop.minFps} avg=${desktop.avgFps}`);
  console.log("OK");
} finally {
  await browser.close();
}
