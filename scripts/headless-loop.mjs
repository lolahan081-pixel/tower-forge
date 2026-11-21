/**
 * Headless play of the core loop: place a tower, start a wave, wait,
 * screenshot, then optionally stress-spawn ~300 enemies for an FPS sample.
 *
 * Usage: node scripts/headless-loop.mjs [baseUrl]
 * Expects a running preview server (default http://127.0.0.1:4173).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const shotDir = path.join(root, "screenshots");
const shotPath = path.join(shotDir, "loop.png");
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

const before = await page.evaluate(() => window.__towerForge.getState());
const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
const placed = await page.evaluate(
  ({ col, row }) => window.__towerForge.placeTower(col, row, "ember-spire"),
  cell,
);
const afterPlace = await page.evaluate(() => window.__towerForge.getState());
const started = await page.evaluate(() => window.__towerForge.startWave());

// Let enemies walk and the tower shoot for a few seconds.
await page.waitForTimeout(8000);

const mid = await page.evaluate(() => {
  const api = window.__towerForge;
  return { state: api.getState(), positions: api.enemyPositions() };
});

await page.screenshot({ path: shotPath, fullPage: true });

const stress = await page.evaluate(() => window.__towerForge.stress(300));
await page.waitForTimeout(3000);
const afterStress = await page.evaluate(() => window.__towerForge.getState());

await browser.close();

const moved =
  mid.positions.length > 0 &&
  mid.positions.some((p) => p.progress > 0.01 || p.x > 30);

const goldSpent = afterPlace.gold < before.gold;
const goldOrLivesChanged = mid.state.gold !== afterPlace.gold || mid.state.lives !== afterPlace.lives;
const shotOk = fs.existsSync(shotPath) && fs.statSync(shotPath).size > 1000;

const report = {
  url,
  screenshot: shotPath,
  screenshotBytes: shotOk ? fs.statSync(shotPath).size : 0,
  before,
  cell,
  placed,
  afterPlace,
  started,
  mid: mid.state,
  enemiesSample: mid.positions.slice(0, 5),
  enemiesAliveMid: mid.positions.length,
  enemiesMoved: moved,
  goldSpent,
  goldOrLivesChanged,
  midFps: mid.state.fps,
  stress,
  afterStress: {
    enemiesAlive: afterStress.enemiesAlive,
    fps: afterStress.fps,
    towers: afterStress.towers,
  },
  console: consoleLines,
  pageErrors,
};

const reportPath = path.join(shotDir, "headless-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failed =
  !placed ||
  !started ||
  !shotOk ||
  pageErrors.length > 0 ||
  !moved;

process.exit(failed ? 1 : 0);
