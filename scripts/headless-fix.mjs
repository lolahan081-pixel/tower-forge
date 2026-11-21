/**
 * Desktop + mobile (touch) verification of starter Sigils, Inscription UX, and scaling.
 * Usage: node scripts/headless-fix.mjs [baseUrl]
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

async function waitReady(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__towerForge?.ready === true, { timeout: 20000 });
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
  const c = mid(rect);
  await tapWorld(page, c.x, c.y, touch);
}

async function dismissHelp(page, touch) {
  const visible = await page.evaluate(() => window.__towerForge.getState().helpVisible);
  if (!visible) return;
  const rects = await page.evaluate(() => window.__towerForge.getUiRects());
  await tapRect(page, rects.helpDismiss, touch);
  await page.waitForTimeout(200);
}


async function tapInventoryDef(page, defId, touch) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const ui = await page.evaluate(() => window.__towerForge.getUiRects());
    const state = await page.evaluate(() => window.__towerForge.getState());
    const start = (ui.panel.invPage ?? 0) * (ui.panel.invPageSize ?? ui.panel.inventory.length);
    const idx = state.inventory.findIndex((g) => g.defId === defId);
    if (idx < 0) throw new Error(`${defId} missing from inventory`);
    if (idx >= start && idx < start + ui.panel.inventory.length) {
      await tapRect(page, ui.panel.inventory[idx - start], touch);
      return;
    }
    await tapRect(page, ui.panel.next, touch);
    await page.waitForTimeout(180);
  }
  throw new Error(`could not bring ${defId} into view`);
}

async function runScenario(page, { touch, screenshotAfterBuild, screenshotAfterFire }) {
  await waitReady(page);
  await dismissHelp(page, touch);

  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const rects0 = await page.evaluate(() => window.__towerForge.getUiRects());
  await tapRect(page, rects0.towers["ember-spire"], touch);
  await page.waitForTimeout(80);
  // Tap the cell center in world space.
  await tapWorld(page, (cell.col + 0.5) * 48, (cell.row + 0.5) * 48, touch);
  await page.waitForTimeout(250);

  let state = await page.evaluate(() => window.__towerForge.getState());
  if (!state.towerSockets[0]) throw new Error("tower was not placed by tap");
  const starter = state.towerSockets[0].sockets.find((s) => s && s.kind === "sigil");
  if (!starter || starter.defId !== "cinder-orb") {
    throw new Error(`expected free starter Cinder Orb, got ${JSON.stringify(state.towerSockets[0].sockets)}`);
  }
  const invHadCinder = state.inventory.filter((g) => g.defId === "cinder-orb").length;
  // Starter is a new instance, not taken from inventory (still at least one in bag).
  if (invHadCinder < 1) throw new Error("starter Sigil was taken from inventory");

  if (screenshotAfterBuild) {
    await page.screenshot({ path: screenshotAfterBuild, fullPage: true });
  }

  // Close the auto-opened panel so firing is proven without it.
  if (state.panelOpen) {
    const rects = await page.evaluate(() => window.__towerForge.getUiRects());
    await tapRect(page, rects.panel.close, touch);
    await page.waitForTimeout(150);
  }
  state = await page.evaluate(() => window.__towerForge.getState());
  if (state.panelOpen) throw new Error("panel did not close");

  const before = state;
  const rects = await page.evaluate(() => window.__towerForge.getUiRects());
  await tapRect(page, rects.startWave, touch);
  await page.waitForTimeout(200);

  let peak = 0;
  let fired = false;
  let late = before;
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(120);
    late = await page.evaluate(() => window.__towerForge.getState());
    if (late.peakProjectiles > peak) peak = late.peakProjectiles;
    if (late.projectiles > 0 || late.peakProjectiles > 0 || late.lastVolleyCount > 0) fired = true;
    if (late.gold > before.gold && fired) break;
  }
  if (screenshotAfterFire) {
    await page.screenshot({ path: screenshotAfterFire, fullPage: true });
  }
  if (!fired) throw new Error("Ember Spire did not fire with the panel closed");
  if (late.gold <= before.gold && late.enemiesAlive >= 6) {
    throw new Error("no kills registered with the panel closed");
  }

  // Open panel by tapping the tower, socket a Rune, unsocket it.
  await tapWorld(page, (cell.col + 0.5) * 48, (cell.row + 0.5) * 48, touch);
  await page.waitForTimeout(200);
  late = await page.evaluate(() => window.__towerForge.getState());
  if (!late.panelOpen) throw new Error("tapping the tower did not open the panel");

  await tapInventoryDef(page, "split-volley", touch);
  await page.waitForTimeout(120);
  const ui = await page.evaluate(() => window.__towerForge.getUiRects());
  const emptySocket = ui.panel.sockets[1];
  if (!emptySocket) throw new Error("no empty socket rect");
  await tapRect(page, emptySocket, touch);
  await page.waitForTimeout(200);
  late = await page.evaluate(() => window.__towerForge.getState());
  const slot1 = late.towerSockets[0].sockets[1];
  if (!slot1 || slot1.defId !== "split-volley") {
    throw new Error(`expected Split Volley in socket 1, got ${JSON.stringify(late.towerSockets[0].sockets)}`);
  }

  // Select the filled socket, then Unsocket.
  const ui2 = await page.evaluate(() => window.__towerForge.getUiRects());
  await tapRect(page, ui2.panel.sockets[1], touch);
  await page.waitForTimeout(120);
  await tapRect(page, ui2.panel.unsocket, touch);
  await page.waitForTimeout(200);
  late = await page.evaluate(() => window.__towerForge.getState());
  if (late.towerSockets[0].sockets[1] !== null) throw new Error("unsocket failed");
  if (!late.inventory.some((g) => g.defId === "split-volley")) throw new Error("unsocketed rune not returned");

  return {
    fired,
    peakProjectiles: peak,
    goldBefore: before.gold,
    goldAfter: late.gold,
    lives: late.lives,
    lastVolleyCount: late.lastVolleyCount,
    starter: starter.defId,
    unsocketOk: true,
    panelOpen: late.panelOpen,
  };
}

const report = { url, desktop: null, mobileLandscape: null, mobilePortrait: null, console: [], pageErrors: [] };

const browser = await chromium.launch(launchOpts);

// Desktop
{
  const logs = logBag();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  logs.attach(page);
  try {
    report.desktop = await runScenario(page, {
      touch: false,
      screenshotAfterBuild: path.join(shotDir, "fix-desktop.png"),
    });
  } finally {
    report.console.push(...logs.consoleLines.map((l) => `desktop ${l}`));
    report.pageErrors.push(...logs.pageErrors);
    await page.close();
  }
}

// Mobile landscape — iPhone 12
{
  const device = devices["iPhone 12"];
  const logs = logBag();
  const page = await browser.newPage({
    ...device,
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  logs.attach(page);
  try {
    report.mobileLandscape = await runScenario(page, {
      touch: true,
      screenshotAfterFire: path.join(shotDir, "fix-mobile-landscape.png"),
    });
  } finally {
    report.console.push(...logs.consoleLines.map((l) => `mobile-land ${l}`));
    report.pageErrors.push(...logs.pageErrors);
    await page.close();
  }
}

// Mobile portrait — Pixel 5, shorter path: help dismiss, build, screenshot (letterbox + rotate hint)
{
  const device = devices["Pixel 5"];
  const logs = logBag();
  const page = await browser.newPage({
    ...device,
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });
  logs.attach(page);
  try {
    await waitReady(page);
    await dismissHelp(page, true);
    const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
    const rects = await page.evaluate(() => window.__towerForge.getUiRects());
    await tapRect(page, rects.towers["ember-spire"], true);
    await page.waitForTimeout(80);
    await tapWorld(page, (cell.col + 0.5) * 48, (cell.row + 0.5) * 48, true);
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => window.__towerForge.getState());
    await page.screenshot({ path: path.join(shotDir, "fix-mobile-portrait.png"), fullPage: true });
    report.mobilePortrait = {
      placed: state.towers === 1,
      panelOpen: state.panelOpen,
      starter: state.towerSockets[0]?.sockets?.[0]?.defId ?? null,
    };
  } finally {
    report.console.push(...logs.consoleLines.map((l) => `mobile-port ${l}`));
    report.pageErrors.push(...logs.pageErrors);
    await page.close();
  }
}

await browser.close();

const shots = ["fix-desktop.png", "fix-mobile-landscape.png", "fix-mobile-portrait.png"].map((n) => {
  const pth = path.join(shotDir, n);
  const ok = fs.existsSync(pth) && fs.statSync(pth).size > 1000;
  return { path: pth, bytes: ok ? fs.statSync(pth).size : 0, ok };
});
report.shots = shots;

const failed =
  report.pageErrors.length > 0 ||
  !report.desktop?.fired ||
  !report.mobileLandscape?.fired ||
  !report.mobilePortrait?.placed ||
  shots.some((s) => !s.ok);

fs.writeFileSync(path.join(shotDir, "fix-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
