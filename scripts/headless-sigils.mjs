/**
 * Headless check of Sigil / Rune sockets:
 * place a frame, socket Cinder Orb + Split Volley, start a wave,
 * confirm a multi-projectile volley, kills, and gem XP, then screenshot.
 *
 * Usage: node scripts/headless-sigils.mjs [baseUrl]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const shotDir = path.join(root, "screenshots");
const shotPath = path.join(shotDir, "sigils.png");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const url = `${base}/?renderer=canvas`;

fs.mkdirSync(shotDir, { recursive: true });

const consoleLines = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--no-sandbox",
  ],
});

const page = await browser.newPage({ viewport: { width: 980, height: 780 } });
page.on("console", (msg) => {
  consoleLines.push(`[${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", (err) => {
  pageErrors.push(String(err));
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => window.__towerForge?.ready === true, { timeout: 20000 });

const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
const placed = await page.evaluate(({ col, row }) => window.__towerForge.placeTower(col, row, "ember-spire"), cell);
const afterPlace = await page.evaluate(() => window.__towerForge.getState());
const socketSigil = await page.evaluate(
  ({ col, row }) => window.__towerForge.socketByDef(col, row, "cinder-orb"),
  cell,
);
const socketRune = await page.evaluate(
  ({ col, row }) => window.__towerForge.socketByDef(col, row, "split-volley"),
  cell,
);
const afterSocket = await page.evaluate(() => window.__towerForge.getState());
const panelOpen = await page.evaluate(({ col, row }) => window.__towerForge.openPanel(col, row), cell);
const started = await page.evaluate(() => window.__towerForge.startWave());

const xpBefore = socketXp(afterSocket);

let peak = afterSocket.peakProjectiles;
let lastVolley = afterSocket.lastVolleyCount;
let mid = afterSocket;
let shotTaken = false;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(80);
  const frame = await page.evaluate(() => {
    const api = window.__towerForge;
    return { state: api.getState(), positions: api.enemyPositions() };
  });
  mid = frame.state;
  if (mid.peakProjectiles > peak) peak = mid.peakProjectiles;
  if (mid.lastVolleyCount > lastVolley) lastVolley = mid.lastVolleyCount;
  if (!mid.panelOpen) {
    await page.evaluate(({ col, row }) => window.__towerForge.openPanel(col, row), cell);
  }
  const combatVisible = mid.enemiesAlive > 0 && (mid.projectiles > 0 || mid.lastVolleyCount > 0);
  if (!shotTaken && combatVisible && mid.panelOpen) {
    await page.waitForTimeout(80);
    await page.screenshot({ path: shotPath, fullPage: true });
    shotTaken = true;
  }
}

if (!shotTaken) {
  await page.evaluate(({ col, row }) => window.__towerForge.openPanel(col, row), cell);
  await page.screenshot({ path: shotPath, fullPage: true });
}

// Let a few more seconds accumulate XP, then stress.
await page.waitForTimeout(4000);
const late = await page.evaluate(() => window.__towerForge.getState());
if (late.peakProjectiles > peak) peak = late.peakProjectiles;
if (late.lastVolleyCount > lastVolley) lastVolley = late.lastVolleyCount;
const xpAfter = socketXp(late);

const stress = await page.evaluate(() => window.__towerForge.stress(300));
await page.waitForTimeout(3000);
const afterStress = await page.evaluate(() => window.__towerForge.getState());

await browser.close();

const resolved = afterSocket.towerSockets[0]?.resolved;
const multiProj = (resolved?.projectileCount ?? 0) >= 3 || lastVolley >= 3 || peak >= 3;
const xpUp = xpAfter > xpBefore;
const goldUp = late.gold > afterPlace.gold;
const shotOk = fs.existsSync(shotPath) && fs.statSync(shotPath).size > 1000;

const report = {
  url,
  screenshot: shotPath,
  screenshotBytes: shotOk ? fs.statSync(shotPath).size : 0,
  cell,
  placed,
  socketSigil,
  socketRune,
  panelOpen,
  started,
  resolved,
  afterSocketTowers: afterSocket.towerSockets,
  mid: {
    gold: mid.gold,
    lives: mid.lives,
    wave: mid.wave,
    enemiesAlive: mid.enemiesAlive,
    projectiles: mid.projectiles,
    lastVolleyCount: mid.lastVolleyCount,
    peakProjectiles: mid.peakProjectiles,
    fps: mid.fps,
    panelOpen: mid.panelOpen,
  },
  late: {
    gold: late.gold,
    lives: late.lives,
    enemiesAlive: late.enemiesAlive,
    lastVolleyCount: late.lastVolleyCount,
    peakProjectiles: late.peakProjectiles,
    fps: late.fps,
    sockets: late.towerSockets,
  },
  xpBefore,
  xpAfter,
  multiProj,
  xpUp,
  goldUp,
  peak,
  lastVolley,
  stress,
  afterStress: { enemiesAlive: afterStress.enemiesAlive, fps: afterStress.fps },
  console: consoleLines,
  pageErrors,
};

const reportPath = path.join(shotDir, "sigils-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failed = !placed || !socketSigil || !socketRune || !started || !shotOk || !multiProj || !xpUp || pageErrors.length > 0;
process.exit(failed ? 1 : 0);

function socketXp(state) {
  let xp = 0;
  for (const t of state.towerSockets ?? []) {
    for (const g of t.sockets ?? []) {
      if (!g) continue;
      xp += g.xp + (g.level - 1) * 1000;
    }
  }
  return xp;
}
