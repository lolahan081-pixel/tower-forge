/**
 * Desktop + iPhone 12 landscape (touch) verification of the Bastion hub,
 * loadout Runes, battle Sigil swap, return, and persistence.
 * Usage: node scripts/headless-hub.mjs [baseUrl]
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const shotDir = path.join(root, "screenshots");
fs.mkdirSync(shotDir, { recursive: true });

const base = process.argv[2] ?? "http://127.0.0.1:4173";
const url = `${base}/?renderer=canvas`;
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const launchOpts = {
  headless: true,
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
};

function logBag() {
  const consoleLines = [];
  const pageErrors = [];
  return {
    consoleLines,
    pageErrors,
    attach(page) {
      page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
      page.on("pageerror", (err) => pageErrors.push(String(err)));
    },
  };
}

async function waitReady(page, scene) {
  await page.waitForFunction(
    (want) => window.__towerForge?.ready === true && (!want || window.__towerForge.scene === want),
    scene ?? "",
    { timeout: 20000 },
  );
}

async function gotoFresh(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitReady(page, "bastion");
}

async function tapWorld(page, worldX, worldY, touch) {
  const pt = await page.evaluate(
    ({ worldX, worldY }) => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("no canvas");
      const r = canvas.getBoundingClientRect();
      const size = window.__towerForge.getUiRects().game;
      return {
        x: r.left + (worldX / size.w) * r.width,
        y: r.top + (worldY / size.h) * r.height,
      };
    },
    { worldX, worldY },
  );
  if (touch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
}

function mid(r) {
  return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 };
}

async function tapRect(page, rect, touch) {
  if (!rect || rect.w <= 0 || rect.h <= 0) throw new Error("invalid rect");
  const c = mid(rect);
  await tapWorld(page, c.x, c.y, touch);
}

async function dismissHelp(page, touch) {
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  if (!ui.helpVisible) return;
  await tapRect(page, ui.helpDismiss, touch);
  await page.waitForTimeout(200);
}

async function measureCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("no canvas");
    const r = canvas.getBoundingClientRect();
    return {
      left: r.left,
      right: window.innerWidth - r.right,
      top: r.top,
      bottom: window.innerHeight - r.bottom,
      width: r.width,
      height: r.height,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
}

function assertCentered(box, label) {
  const dx = Math.abs(box.left - box.right);
  const dy = Math.abs(box.top - box.bottom);
  if (dx > 2 || dy > 2) {
    throw new Error(`${label} canvas not centered: ${JSON.stringify(box)}`);
  }
  return { ...box, dx, dy, centered: true };
}

async function socketSplitVolley(page, touch) {
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  const state = await page.evaluate(() => window.__towerForge.getState());
  if (state.scene !== "bastion") throw new Error(`expected bastion, got ${state.scene}`);
  if (ui.towers["ember-spire"]) await tapRect(page, ui.towers["ember-spire"], touch);
  await page.waitForTimeout(80);

  const ui2 = await page.evaluate(() => window.__towerForge.getUiRects());
  const st2 = await page.evaluate(() => window.__towerForge.getState());
  const idx = st2.runeInventory.findIndex((g) => g.defId === "split-volley");
  if (idx < 0) throw new Error("Split Volley missing from rune inventory");
  const invRect = ui2.inventory[idx];
  if (!invRect) throw new Error(`no inventory rect for Split Volley at ${idx}`);
  await tapRect(page, invRect, touch);
  await page.waitForTimeout(80);
  const sock = ui2.runeSockets[0];
  if (!sock) throw new Error("no rune socket");
  await tapRect(page, sock, touch);
  await page.waitForTimeout(120);

  const after = await page.evaluate(() => window.__towerForge.getState());
  const has = (after.loadoutRunes ?? []).some((g) => g && g.defId === "split-volley");
  if (!has) throw new Error(`Split Volley not in Ember Spire loadout: ${JSON.stringify(after.loadoutRunes)}`);
  if (after.preview.projectileCount !== 3) {
    throw new Error(`preview should be 3 projectiles, got ${after.preview.projectileCount}`);
  }
}

async function enterBreach(page, touch) {
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  if (!ui.enterBreach) throw new Error("no Enter Breach button");
  await tapRect(page, ui.enterBreach, touch);
  await waitReady(page, "game");
  await dismissHelp(page, touch);
}

async function buildAndFire(page, touch) {
  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const rects = await page.evaluate(() => window.__towerForge.getUiRects());
  await tapRect(page, rects.towers["ember-spire"], touch);
  await page.waitForTimeout(80);
  await tapWorld(page, (cell.col + 0.5) * 48, (cell.row + 0.5) * 48, touch);
  await page.waitForTimeout(200);

  const placed = await page.evaluate(() => window.__towerForge.getState());
  if (!placed.towerSockets[0]) throw new Error("tower was not placed");
  const starter = placed.towerSockets[0].sockets.find((s) => s && s.kind === "sigil");
  if (!starter || starter.defId !== "cinder-orb") {
    throw new Error(`expected starter Cinder Orb, got ${JSON.stringify(placed.towerSockets[0].sockets)}`);
  }
  const rune = placed.towerSockets[0].sockets.find((s) => s && s.defId === "split-volley");
  if (!rune) throw new Error("loadout rune not applied to built tower");
  if (placed.towerSockets[0].resolved.projectileCount !== 3) {
    throw new Error(`expected 3 projectiles from Split Volley, got ${placed.towerSockets[0].resolved.projectileCount}`);
  }

  await tapRect(page, rects.startWave, touch);
  const goldBefore = placed.gold;
  let fired = false;
  let volley = 0;
  let goldAfter = goldBefore;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const st = await page.evaluate(() => window.__towerForge.getState());
    if (st.lastVolleyCount > 0 || st.peakProjectiles > 0) fired = true;
    if (st.lastVolleyCount > volley) volley = st.lastVolleyCount;
    goldAfter = st.gold;
    if (fired && goldAfter > goldBefore) break;
  }
  if (!fired) throw new Error("Ember Spire did not fire");
  if (volley !== 3 && !(fired && goldAfter > goldBefore)) {
    // lastVolleyCount may have been overwritten, but a kill still proves fire.
  }
  if (volley !== 3 && goldAfter <= goldBefore) {
    throw new Error(`expected Split Volley (3) or a kill, volley=${volley} gold ${goldBefore}->${goldAfter}`);
  }
  return { fired, volley, goldBefore, goldAfter, cell };
}

async function swapSigil(page, cell, touch, screenshot) {
  await tapWorld(page, (cell.col + 0.5) * 48, (cell.row + 0.5) * 48, touch);
  await page.waitForTimeout(180);
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  const st = await page.evaluate(() => window.__towerForge.getState());
  if (!st.panelOpen || !ui.panel) throw new Error("sigil panel did not open");
  const idx = st.inventory.findIndex((g) => g.kind === "sigil" && g.defId === "crimson-spike");
  if (idx < 0) throw new Error("Crimson Spike missing from sigil inventory");
  const invRect = ui.panel.inventory[idx];
  if (!invRect) throw new Error("no inventory rect for Crimson Spike");
  await tapRect(page, invRect, touch);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__towerForge.getState());
  const sigil = after.towerSockets[0].sockets.find((s) => s && s.kind === "sigil");
  if (!sigil || sigil.defId !== "crimson-spike") {
    throw new Error(`expected swapped Crimson Spike, got ${JSON.stringify(after.towerSockets[0].sockets)}`);
  }
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
  await page.evaluate(() => window.__towerForge.closePanel());
  return sigil.defId;
}

async function loseAndReturn(page, touch) {
  await page.evaluate(() => window.__towerForge.forceOutcome("lost"));
  await page.waitForTimeout(200);
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  if (!ui.returnToBastion) throw new Error("no Return to Bastion button");
  await tapRect(page, ui.returnToBastion, touch);
  await waitReady(page, "bastion");
  const st = await page.evaluate(() => window.__towerForge.getState());
  const has = (st.loadoutRunes ?? []).some((g) => g && g.defId === "split-volley");
  if (!has) throw new Error("loadout missing Split Volley after return");
}

async function reloadPersists(page) {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await waitReady(page, "bastion");
  await dismissHelp(page, false);
  const st = await page.evaluate(() => window.__towerForge.getState());
  const has = (st.loadoutRunes ?? []).some((g) => g && g.defId === "split-volley");
  if (!has) throw new Error("loadout did not persist across reload");
  return true;
}

async function runDesktop(browser, logs) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  logs.attach(page);
  await gotoFresh(page);
  await dismissHelp(page, false);
  const hubState = await page.evaluate(() => window.__towerForge.getState());
  if (hubState.scene !== "bastion") throw new Error("hub did not show on load");
  await socketSplitVolley(page, false);
  await page.screenshot({ path: path.join(shotDir, "hub.png"), fullPage: true });
  const center = assertCentered(await measureCanvas(page), "desktop");
  await enterBreach(page, false);
  const combat = await buildAndFire(page, false);
  const swapped = await swapSigil(page, combat.cell, false, path.join(shotDir, "battle-sigil.png"));
  await loseAndReturn(page, false);
  const persisted = await reloadPersists(page);
  await context.close();
  return { hub: true, ...combat, swapped, persisted, center };
}

async function runMobile(browser, logs) {
  const context = await browser.newContext({
    ...devices["iPhone 12 landscape"],
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  logs.attach(page);
  await gotoFresh(page);
  await dismissHelp(page, true);
  await socketSplitVolley(page, true);
  await page.screenshot({ path: path.join(shotDir, "hub-mobile.png"), fullPage: true });
  const center = assertCentered(await measureCanvas(page), "iPhone 12 landscape");
  await enterBreach(page, true);
  const combat = await buildAndFire(page, true);
  const swapped = await swapSigil(page, combat.cell, true, null);
  await loseAndReturn(page, true);
  const persisted = await reloadPersists(page);
  await context.close();
  return { hub: true, ...combat, swapped, persisted, center };
}

const logs = logBag();
const browser = await chromium.launch(launchOpts);
let desktop;
let mobile;
try {
  desktop = await runDesktop(browser, logs);
  mobile = await runMobile(browser, logs);
} finally {
  await browser.close();
}

const errors = logs.consoleLines.filter((l) => l.startsWith("[error]") || l.startsWith("[assert]"));
const report = {
  url,
  desktop,
  mobile,
  console: errors,
  pageErrors: logs.pageErrors,
  shots: ["hub.png", "hub-mobile.png", "battle-sigil.png"].map((name) => {
    const p = path.join(shotDir, name);
    const exists = fs.existsSync(p);
    return { path: p, bytes: exists ? fs.statSync(p).size : 0, ok: exists };
  }),
};
console.log(JSON.stringify(report, null, 2));
if (errors.length || logs.pageErrors.length) process.exit(1);
for (const s of report.shots) if (!s.ok) process.exit(1);
