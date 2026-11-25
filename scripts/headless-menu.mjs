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
async function shot(page, name) {
  await page.waitForTimeout(80);
  await page.screenshot({ path: join(shots, `${name}.png`) });
}

async function runDesktop(browser) {
  const errors = [];
  const pageErrors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.addInitScript(() => localStorage.removeItem("tower-forge-profile"));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "menu");
  const startLabel = await page.evaluate(() => window.__towerForge.getState());
  if (startLabel.scene !== "menu") throw new Error(`expected menu, got ${startLabel.scene}`);
  const r0 = await ui(page);
  if (!r0.menuStart || !r0.menuBastion || !r0.menuHowToPlay || !r0.menuSettings) {
    throw new Error("menu buttons missing");
  }
  await shot(page, "menu");

  await tapRect(page, r0.menuStart);
  await waitReady(page, "game");
  await page.waitForTimeout(150);
  const hint = (await ui(page)).battleHintOk;
  if (!hint) throw new Error("first-run battle hint missing");
  await tapRect(page, hint);
  await page.waitForTimeout(120);
  const battle = await page.evaluate(() => {
    const r = window.__towerForge.getUiRects();
    const s = window.__towerForge.getState();
    return {
      scene: s.scene,
      hasStart: !!r.startWave,
      hasSigil: !!r.inscribe,
      hasTowers: Object.keys(r.towers ?? {}).length,
      hasMenu: !!r.menuButton,
    };
  });
  if (battle.scene !== "game" || !battle.hasStart || !battle.hasSigil || battle.hasTowers < 1) {
    throw new Error(`basic battle UI missing: ${JSON.stringify(battle)}`);
  }

  await tapRect(page, (await ui(page)).menuButton);
  await waitReady(page, "menu");
  await tapRect(page, (await ui(page)).menuBastion);
  await waitReady(page, "bastion");
  await page.waitForTimeout(150);
  const hub = await page.evaluate(() => {
    const p = window.__towerForge.getProfile();
    return { tab: window.__towerForge.getState().tab, cleared: p.highestDepthCleared, popup: !!window.__towerForge.getUiRects().unlockOk };
  });
  if (hub.cleared !== 0) throw new Error(`fresh hub should have 0 clears, got ${hub.cleared}`);
  if (hub.popup) throw new Error("fresh hub should not show an unlock popup");
  if (hub.tab !== "loadout") throw new Error(`expected loadout, got ${hub.tab}`);
  // Locked tabs must not switch.
  const tabs = await ui(page);
  await tapRect(page, tabs.tabStash);
  await page.waitForTimeout(80);
  if ((await page.evaluate(() => window.__towerForge.getState().tab)) !== "loadout") {
    throw new Error("locked stash tab should not open");
  }
  await shot(page, "hub-locked");

  await page.evaluate(() => window.__towerForge.setHighestDepthCleared?.(1));
  await page.waitForTimeout(150);
  const popup = (await ui(page)).unlockOk;
  if (!popup) throw new Error("unlock popup missing after Depth 1 clear");
  await shot(page, "unlock-popup");
  await tapRect(page, popup);
  await page.waitForTimeout(100);

  await context.close();
  return { battle, errors, pageErrors };
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
  await page.addInitScript(() => localStorage.removeItem("tower-forge-profile"));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "menu");
  const r = await ui(page);
  // Buttons should be usable at FIT scale (~0.46–0.5): 88 world px >= 44 screen px.
  const scale = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const box = canvas.getBoundingClientRect();
    const g = window.__towerForge.getUiRects().game;
    return { sx: box.width / g.w, sy: box.height / g.h, left: box.left, right: window.innerWidth - box.right };
  });
  const startH = r.menuStart.h * scale.sy;
  if (startH < 44) throw new Error(`start button too small on mobile: ${startH}px`);
  await shot(page, "menu-mobile");
  await context.close();
  return { scale, startH, errors, pageErrors };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
});
let desktop;
let mobile;
try {
  desktop = await runDesktop(browser);
  mobile = await runMobile(browser);
} catch (err) {
  await browser.close();
  throw err;
}
await browser.close();
const allErrors = [...desktop.errors, ...desktop.pageErrors, ...mobile.errors, ...mobile.pageErrors];
const report = {
  desktop,
  mobile,
  shots: ["screenshots/menu.png", "screenshots/menu-mobile.png", "screenshots/hub-locked.png", "screenshots/unlock-popup.png"],
};
console.log(JSON.stringify(report, null, 2));
if (allErrors.length) {
  console.error("console errors", allErrors);
  process.exit(1);
}
