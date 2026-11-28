import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = join(root, "screenshots");
mkdirSync(shots, { recursive: true });
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const url = `${base}/?renderer=canvas`;
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";

const NODE_IDS = [
  "ash-gate",
  "ember-cut",
  "riven-ford",
  "slag-ditch",
  "twin-march",
  "cinder-fall",
  "split-crown",
  "ashen-spine",
  "hollow-stair",
  "mist-crown",
  "sovereign-gate",
  "last-watch",
];

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
  for (let i = 0; i < 10; i++) {
    const r = await ui(page);
    if (r.shopHelpOk) { await tapRect(page, r.shopHelpOk); await page.waitForTimeout(80); continue; }
    if (r.shop) { await tapRect(page, r.shop.close); await page.waitForTimeout(80); continue; }
    if (r.spoilsTake) { await tapRect(page, r.spoilsTake); await page.waitForTimeout(80); continue; }
    if (r.unlockOk) { await tapRect(page, r.unlockOk); await page.waitForTimeout(80); continue; }
    if (r.battleHintOk) { await tapRect(page, r.battleHintOk); await page.waitForTimeout(80); continue; }
    break;
  }
}
async function fresh(page) {
  await page.addInitScript(() => {
    localStorage.removeItem("tower-forge-profile");
    localStorage.removeItem("tower-forge-help-seen");
  });
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

async function cropBoard(page, dest) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const r = canvas.getBoundingClientRect();
    const g = window.__towerForge.getUiRects().game;
    const boardH = 14 * 48; // MAP_ROWS * TILE_SIZE
    return { x: r.left, y: r.top, w: r.width, h: r.height * (boardH / g.h) };
  });
  await page.screenshot({
    path: dest,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.max(1, box.w),
      height: Math.max(1, box.h),
    },
  });
}

async function runDesktop(browser) {
  const { context, page, errors, pageErrors } = await openPage(browser, { width: 1366, height: 768 });
  await goBastion(page);

  const scaling = [];
  for (let d = 1; d <= 10; d++) {
    const row = await page.evaluate((depth) => window.__towerForge.previewDepth(depth), d);
    if (!row) throw new Error(`previewDepth(${d}) failed`);
    scaling.push(row);
  }

  const layouts = [];
  async function enterNode(id) {
    const ok = await page.evaluate((nid) => window.__towerForge.enterAtlasNode(nid), id);
    if (!ok) throw new Error(`enterAtlasNode ${id} failed`);
    await page.waitForFunction(
      (nid) => window.__towerForge?.ready === true && window.__towerForge.scene === "game" && window.__towerForge.getState().atlasNodeId === nid,
      id,
      { timeout: 20000 },
    );
    await dismissOverlays(page);
  }
  await enterNode(NODE_IDS[0]);
  for (const id of NODE_IDS) {
    const current = await page.evaluate(() => window.__towerForge.getState().atlasNodeId);
    if (current !== id) await enterNode(id);
    const state = await page.evaluate(() => window.__towerForge.getState());
    if (state.atlasNodeId !== id) throw new Error(`still on ${state.atlasNodeId} after entering ${id}`);
    layouts.push({ id, layoutId: state.layoutId, mapName: state.mapName, depth: state.depth });
    await cropBoard(page, join(shots, `path-${id}.png`));
  }

  // Unique layout names
  const names = layouts.map((l) => l.layoutId);
  const unique = new Set(names);
  if (unique.size !== 12) throw new Error(`expected 12 unique layouts, got ${[...unique]}`);

  // Win -> Next -> Atlas highlight on a fresh profile (still on last-watch here).
  await context.close();

  const second = await openPage(browser, { width: 1366, height: 768 });
  const page2 = second.page;
  errors.push(...second.errors);
  pageErrors.push(...second.pageErrors);
  await goBastion(page2);
  const entered = await page2.evaluate(() => window.__towerForge.enterAtlasNode("ash-gate"));
  if (!entered) throw new Error("enter ash-gate failed");
  await waitReady(page2, "game");
  await dismissOverlays(page2);
  await page2.evaluate(() => window.__towerForge.forceOutcome("won"));
  await page2.waitForTimeout(200);
  await dismissOverlays(page2);
  const winUi = await ui(page2);
  if (!winUi.next) throw new Error("NEXT button missing after a win");
  await tapRect(page2, winUi.next);
  await waitReady(page2, "bastion");
  await dismissOverlays(page2);
  // Unlock popup (Depth 1) may have been dismissed; Atlas should now be open.
  let atlasUi = (await ui(page2)).atlas;
  if (!atlasUi) {
    await page2.evaluate(() => window.__towerForge.openAtlas());
    await page2.waitForTimeout(150);
    atlasUi = (await ui(page2)).atlas;
  }
  if (!atlasUi) throw new Error("Atlas did not open after Next");
  const highlight = {
    selected: atlasUi.selected,
    newlyOpened: atlasUi.newlyOpened ?? [],
  };
  if (highlight.selected !== "ember-cut") {
    throw new Error(`expected Ember Cut highlighted, got ${highlight.selected}`);
  }
  if (!highlight.newlyOpened.includes("ember-cut")) {
    throw new Error(`expected ember-cut in newlyOpened, got ${JSON.stringify(highlight.newlyOpened)}`);
  }
  await page2.screenshot({ path: join(shots, "paths-next-atlas.png") });
  await second.context.close();

  // Isolated 300-enemy stress on a fresh page (no leftover waves or stacked projectiles).
  const third = await openPage(browser, { width: 1366, height: 768 });
  errors.push(...third.errors);
  pageErrors.push(...third.pageErrors);
  await goBastion(third.page);
  const okNode = await third.page.evaluate(() => window.__towerForge.enterAtlasNode("ash-gate"));
  if (!okNode) throw new Error("stress enter failed");
  await waitReady(third.page, "game");
  await dismissOverlays(third.page);
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

  return {
    errors,
    pageErrors,
    scaling,
    layouts,
    highlight,
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
  await page.evaluate(() => window.__towerForge.setHighestDepthCleared?.(3));
  await dismissOverlays(page);
  const ok = await page.evaluate(() => window.__towerForge.enterAtlasNode("twin-march"));
  if (!ok) throw new Error("mobile enter twin-march failed");
  await waitReady(page, "game");
  await dismissOverlays(page);
  const state = await page.evaluate(() => window.__towerForge.getState());
  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const placed = await page.evaluate((c) => window.__towerForge.placeTower(c.col, c.row), cell);
  if (!placed) throw new Error("mobile placeTower failed");
  const started = await page.evaluate(() => window.__towerForge.startWave());
  if (!started) throw new Error("mobile startWave failed");
  await page.waitForFunction(() => (window.__towerForge.getState().enemiesAlive ?? 0) >= 1, null, { timeout: 15000 });
  await context.close();
  return {
    errors,
    pageErrors,
    layoutId: state.layoutId,
    mapName: state.mapName,
    depth: state.depth,
    enemies: true,
  };
}

function composeContactSheet() {
  return new Promise((resolve, reject) => {
    const script = `
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
shots = Path(${JSON.stringify(shots)})
ids = ${JSON.stringify(NODE_IDS)}
tiles = []
for i, nid in enumerate(ids):
    im = Image.open(shots / f"path-{nid}.png").convert("RGB")
    tiles.append(im)
# normalize size
w = min(t.width for t in tiles)
h = min(t.height for t in tiles)
tiles = [t.resize((w, h)) for t in tiles]
cols, rows = 4, 3
pad, cap = 8, 28
out = Image.new("RGB", (cols * w + pad * (cols + 1), rows * (h + cap) + pad * (rows + 1)), (18, 16, 20))
draw = ImageDraw.Draw(out)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
except Exception:
    font = ImageFont.load_default()
for i, im in enumerate(tiles):
    c, r = i % cols, i // cols
    x = pad + c * (w + pad)
    y = pad + r * (h + cap + pad)
    out.paste(im, (x, y))
    draw.text((x + 4, y + h + 4), f"{i+1}. {ids[i]}", fill=(232, 197, 71), font=font)
dest = shots / "paths-all.png"
out.save(dest)
print(dest, out.size)
`
    const proc = spawn("python3", ["-"], { cwd: root });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => { out += d; });
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`contact sheet failed: ${err || out}`));
      else resolve(out.trim());
    });
    proc.stdin.write(script);
    proc.stdin.end();
  });
}

const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
});

try {
  const desktop = await runDesktop(browser);
  const sheet = await composeContactSheet();
  const mobile = await runMobile(browser);
  const report = { desktop: { ...desktop, sheet }, mobile };
  // Don't dump full sample arrays twice
  console.log(JSON.stringify({
    scaling: desktop.scaling.map((s) => ({
      depth: s.depth,
      label: s.label,
      pips: s.pips,
      lives: s.lives,
      startGold: s.startGold,
      hp: s.hp,
      speed: s.speed,
      count: s.count,
      interval: s.interval,
      magic: s.magic,
      rare: s.rare,
      unique: s.unique,
      bossHp: s.bossHp,
      totals: s.totals,
    })),
    layouts: desktop.layouts,
    highlight: desktop.highlight,
    stress: { spawnFps: desktop.stress.fps, spawned: desktop.stress.spawned, minFps: desktop.minFps, avgFps: desktop.avgFps, lastFps: desktop.lastFps, samples: desktop.samples },
    sheet,
    mobile: { layoutId: mobile.layoutId, mapName: mobile.mapName, depth: mobile.depth },
    desktopErrors: desktop.errors,
    desktopPageErrors: desktop.pageErrors,
    mobileErrors: mobile.errors,
    mobilePageErrors: mobile.pageErrors,
  }, null, 2));
  if (desktop.errors.length || desktop.pageErrors.length) {
    throw new Error(`desktop errors: ${JSON.stringify({ errors: desktop.errors, pageErrors: desktop.pageErrors })}`);
  }
  if (mobile.errors.length || mobile.pageErrors.length) {
    throw new Error(`mobile errors: ${JSON.stringify({ errors: mobile.errors, pageErrors: mobile.pageErrors })}`);
  }
  if (desktop.minFps < 55) {
    throw new Error(`stress fps too low: min=${desktop.minFps} avg=${desktop.avgFps}`);
  }
  console.log("OK");
} finally {
  await browser.close();
}
