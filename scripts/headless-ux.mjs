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

async function backToBastion(page) {
  await dismissOverlays(page);
  const scene = await page.evaluate(() => window.__towerForge.scene);
  if (scene === "bastion") return;
  if (scene === "game") {
    await page.evaluate(() => window.__towerForge.forceOutcome("won"));
    await page.waitForTimeout(120);
    await dismissOverlays(page);
    const r = await ui(page);
    if (r.returnToBastion) await tapRect(page, r.returnToBastion);
  }
  await waitReady(page, "bastion");
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

async function journey(page, tag, attempts) {
  const log = [];
  for (let i = 0; i < attempts; i++) {
    try {
      await waitReady(page, "menu");
      let r = await ui(page);
      if (!r.menuBastion) throw new Error("no bastion button");
      await tapRect(page, r.menuBastion);
      await waitReady(page, "bastion");
      r = await ui(page);
      if (!r.enterBreach) throw new Error("no enter breach");
      await tapRect(page, r.enterBreach);
      await page.waitForTimeout(200);
      r = await ui(page);
      if (!r.atlas || !r.atlas.enter) throw new Error("atlas did not open");
      await tapRect(page, r.atlas.enter);
      await waitReady(page, "game");
      await page.waitForTimeout(200);
      r = await ui(page);
      if (r.battleHintOk) {
        await tapRect(page, r.battleHintOk);
        await page.waitForTimeout(150);
        r = await ui(page);
      }
      if (!r.menuButton) throw new Error("no battle menu");
      await tapRect(page, r.menuButton);
      await waitReady(page, "menu");
      const scene = await page.evaluate(() => window.__towerForge.scene);
      if (scene !== "menu") throw new Error(`back to menu failed, scene=${scene}`);
      log.push({ i, ok: true, tag });
    } catch (err) {
      log.push({ i, ok: false, tag, error: String(err) });
      // Try to recover to menu for the next attempt
      try {
        await page.evaluate(() => {
          const api = window.__towerForge;
          if (!api) return;
          if (api.scene === "game" || api.scene === "bastion") {
            // fall through to reload if needed
          }
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitReady(page, "menu");
      } catch {
        // ignore
      }
    }
  }
  return log;
}

async function playWaveOnMap(page, nodeId, shotName) {
  await waitReady(page, "bastion");
  const ok = await page.evaluate((id) => window.__towerForge.enterAtlasNode(id), nodeId);
  if (!ok) throw new Error(`enterAtlasNode ${nodeId} failed`);
  await waitReady(page, "game");
  await page.waitForTimeout(200);
  const hint = (await ui(page)).battleHintOk;
  if (hint) {
    await tapRect(page, hint);
    await page.waitForTimeout(120);
  }
  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const placed = await page.evaluate((c) => window.__towerForge.placeTower(c.col, c.row), cell);
  if (!placed) throw new Error(`placeTower failed on ${nodeId} at ${JSON.stringify(cell)}`);
  await shot(page, shotName);
  await page.evaluate(() => window.__towerForge.setTimeScale(8));
  const started = await page.evaluate(() => window.__towerForge.startWave());
  if (!started) throw new Error(`startWave failed on ${nodeId}`);
  await page.waitForFunction(() => (window.__towerForge.getState().enemiesAlive ?? 0) >= 1, null, { timeout: 15000 });
  const state = await page.evaluate(() => window.__towerForge.getState());
  if (state.scene !== "game" || state.enemiesAlive < 1) {
    throw new Error(`wave did not spawn on ${nodeId}: ${JSON.stringify(state)}`);
  }
  return { nodeId, layoutId: state.layoutId, mapName: state.mapName, enemies: state.enemiesAlive };
}

async function runDesktopClicks(browser) {
  const results = [];
  for (const viewport of [
    { width: 1366, height: 768, tag: "1366x768" },
    { width: 1920, height: 1080, tag: "1920x1080" },
  ]) {
    const errors = [];
    const pageErrors = [];
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await fresh(page);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitReady(page, "menu");
    const log = await journey(page, viewport.tag, 4);
    results.push({ viewport: viewport.tag, log, errors, pageErrors });
    await context.close();
  }

  // After a window resize: start mid-size, then resize and repeat the journey.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await fresh(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "menu");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  const log = await journey(page, "resize-1920x1080", 3);
  results.push({ viewport: "resize-1920x1080", log, errors, pageErrors });
  await context.close();
  return results;
}

async function runFeatures(browser) {
  const errors = [];
  const pageErrors = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await fresh(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "menu");

  // Shop explanation: start a fresh Depth 1 breach, clear wave 1.
  const start = (await ui(page)).menuStart;
  await tapRect(page, start);
  await waitReady(page, "game");
  const hint = (await ui(page)).battleHintOk;
  if (hint) await tapRect(page, hint);
  await page.waitForTimeout(120);
  const cell = await page.evaluate(() => window.__towerForge.firstBuildableNearPath());
  const placed = await page.evaluate((c) => window.__towerForge.placeTower(c.col, c.row), cell);
  if (!placed) throw new Error("could not place a tower for the shop check");
  await page.evaluate(() => window.__towerForge.setTimeScale(12));
  const started = await page.evaluate(() => window.__towerForge.startWave());
  if (!started) throw new Error("startWave failed for shop check");
  await page.waitForFunction(() => {
    const api = window.__towerForge;
    const r = api.getUiRects();
    return !!(r.shop || r.shopHelpOk);
  }, null, { timeout: 30000 });
  const shopUi = await ui(page);
  if (shopUi.shopHelpOk) {
    await page.waitForTimeout(80);
    // Keep the stall itself as the official shot; dismiss the first-time card first.
    await tapRect(page, shopUi.shopHelpOk);
    await page.waitForTimeout(150);
  }
  const after = await ui(page);
  if (!after.shop) throw new Error("shop did not stay open after the hint");
  const shopCopy = await page.evaluate(() => {
    const texts = [...document.querySelectorAll("canvas")];
    return {
      hasShop: !!window.__towerForge.getUiRects().shop,
      offers: (window.__towerForge.shopOffers?.() ?? []).length,
    };
  });
  if (!shopCopy.hasShop) throw new Error("shop missing");
  await shot(page, "shop-help");

  await dismissOverlays(page);
  const menuBtn = (await ui(page)).menuButton;
  await tapRect(page, menuBtn);
  await waitReady(page, "menu");
  await tapRect(page, (await ui(page)).menuBastion);
  await waitReady(page, "bastion");
  await page.evaluate(() => window.__towerForge.openAtlas());
  await page.waitForTimeout(200);
  let atlas = (await ui(page)).atlas;
  if (!atlas) throw new Error("atlas did not open on a fresh profile");
  const lockedFresh = await page.evaluate(() => {
    const p = window.__towerForge.getProfile();
    const r = window.__towerForge.getUiRects().atlas;
    return { cleared: p.clearedAtlasNodes, selected: r?.selected, nodeCount: Object.keys(r?.nodes ?? {}).length };
  });
  await shot(page, "atlas");

  // Unlock through Depth 4 so later layouts are open, then show a selected node.
  await page.evaluate(() => window.__towerForge.setHighestDepthCleared(4));
  await page.waitForTimeout(200);
  // Dismiss any unlock popups so we can use the atlas.
  for (let i = 0; i < 6; i++) {
    const r = await ui(page);
    if (r.unlockOk) {
      await tapRect(page, r.unlockOk);
      await page.waitForTimeout(200);
    } else break;
  }
  await page.evaluate(() => window.__towerForge.openAtlas());
  await page.waitForTimeout(150);
  atlas = (await ui(page)).atlas;
  if (!atlas) throw new Error("atlas missing after unlock");
  const riven = atlas.nodes["riven-ford"];
  if (!riven) throw new Error("riven-ford node missing");
  await tapRect(page, riven);
  await page.waitForTimeout(150);
  await shot(page, "map-select");

  const waves = [];
  waves.push(await playWaveOnMap(page, "riven-ford", "map-2"));
  await backToBastion(page);
  waves.push(await playWaveOnMap(page, "twin-march", "map-3"));
  await backToBastion(page);
  waves.push(await playWaveOnMap(page, "ashen-spine", "map-4"));

  await context.close();
  return { lockedFresh, waves, errors, pageErrors };
}

async function runMobile(browser) {
  const errors = [];
  const pageErrors = [];
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await fresh(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "menu");
  const startH = await page.evaluate(() => {
    const r = window.__towerForge.getUiRects();
    const canvas = document.querySelector("canvas");
    const box = canvas.getBoundingClientRect();
    const g = r.game;
    return (r.menuStart.h / g.h) * box.height;
  });
  const log = await journey(page, "mobile-landscape", 3);
  // Atlas + shop visible on mobile too
  await waitReady(page, "menu");
  await tapRect(page, (await ui(page)).menuBastion);
  await waitReady(page, "bastion");
  await page.evaluate(() => window.__towerForge.openAtlas());
  await page.waitForTimeout(200);
  const atlas = (await ui(page)).atlas;
  if (!atlas) throw new Error("atlas missing on mobile");
  await context.close();
  return { startH, log, errors, pageErrors };
}

const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
});

try {
  const clicks = await runDesktopClicks(browser);
  console.log("CLICKS", JSON.stringify(clicks.map((c) => ({
    viewport: c.viewport,
    ok: c.log.filter((l) => l.ok).length,
    attempts: c.log.length,
    fail: c.log.filter((l) => !l.ok),
    errors: c.errors,
    pageErrors: c.pageErrors,
  })), null, 2));
  const features = await runFeatures(browser);
  const mobile = await runMobile(browser);

  const clickSummary = clicks.map((c) => {
    const ok = c.log.filter((l) => l.ok).length;
    const fail = c.log.filter((l) => !l.ok);
    return { viewport: c.viewport, ok, attempts: c.log.length, fail, errors: c.errors, pageErrors: c.pageErrors };
  });
  const mobileOk = mobile.log.filter((l) => l.ok).length;
  const allClicksOk = clickSummary.every((c) => c.ok === c.attempts && c.errors.length === 0 && c.pageErrors.length === 0);
  const mobileClicksOk = mobileOk === mobile.log.length && mobile.errors.length === 0 && mobile.pageErrors.length === 0;
  if (!allClicksOk) throw new Error(`menu click journeys failed: ${JSON.stringify(clickSummary, null, 2)}`);
  if (!mobileClicksOk) throw new Error(`mobile menu journeys failed: ${JSON.stringify(mobile, null, 2)}`);
  if (features.errors.length || features.pageErrors.length) {
    throw new Error(`feature pass console errors: ${JSON.stringify({ errors: features.errors, pageErrors: features.pageErrors })}`);
  }
  if (features.waves.length !== 3) throw new Error("expected a wave on maps 2-4");

  const report = {
    clicks: clickSummary,
    mobile: { startH: Math.round(mobile.startH * 100) / 100, ok: mobileOk, attempts: mobile.log.length },
    atlas: features.lockedFresh,
    waves: features.waves,
    screenshots: ["shop-help.png", "atlas.png", "map-select.png", "map-2.png", "map-3.png", "map-4.png"],
  };
  console.log(JSON.stringify(report, null, 2));
  console.log("OK");
} finally {
  await browser.close();
}
