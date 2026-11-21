import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = join(root, "screenshots");
mkdirSync(shots, { recursive: true });

const base = process.argv[2] ?? "http://127.0.0.1:4173";
const url = `${base}/?renderer=canvas&timescale=12`;
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const SHOT_NAMES = ["hub-stash", "forge", "lattice", "breach-select", "battle-loot", "spoils"];

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

async function dismissHelp(page) {
  const r = await ui(page);
  if (r.helpVisible && r.helpDismiss) {
    await tapRect(page, r.helpDismiss);
    await page.waitForTimeout(200);
  }
}

async function shot(page, name, take) {
  if (!take) return;
  await page.waitForTimeout(80);
  await page.screenshot({ path: join(shots, `${name}.png`) });
}

async function enterDepth(page, depth) {
  await tapRect(page, (await ui(page)).enterBreach);
  await page.waitForTimeout(150);
  const sel = (await ui(page)).depthSelect;
  if (!sel?.enter) throw new Error("depth select did not open");
  const btn = sel.depths?.[depth - 1];
  if (btn) await tapRect(page, btn);
  await tapRect(page, sel.enter);
  await waitReady(page, "game");
}

async function waitEvent(page, timeout = 45000) {
  const t0 = Date.now();
  let sawEnemies = false;
  let unique = false;
  while (Date.now() - t0 < timeout) {
    const ev = await page.evaluate(() => {
      const r = window.__towerForge.getUiRects();
      const s = window.__towerForge.getState();
      const enemies = window.__towerForge.enemyPositions();
      return {
        shop: !!r.shop,
        shopOffers: r.shop?.offers ?? null,
        shopClose: r.shop?.close ?? null,
        spoils: !!r.spoilsTake,
        spoilsTake: r.spoilsTake ?? null,
        outcome: s.outcome,
        wave: s.wave,
        waveActive: s.waveActive,
        enemiesAlive: s.enemiesAlive,
        gold: s.gold,
        lives: s.lives,
        spoilsCount: window.__towerForge.getSpoils?.().length ?? 0,
        unique: enemies.some((e) => e.rarity === "unique"),
      };
    });
    if (ev.enemiesAlive > 0) sawEnemies = true;
    if (ev.unique) unique = true;
    if (ev.shop || ev.spoils || ev.outcome === "won" || ev.outcome === "lost") {
      return { ...ev, sawEnemies, unique };
    }
    await page.waitForTimeout(160);
  }
  const st = await page.evaluate(() => window.__towerForge.getState());
  throw new Error(`timeout waiting for shop/spoils (state=${JSON.stringify(st)})`);
}


// Buildable tiles adjacent to the path, covering early, mid, and late stretches.
const BUILD_SITES = [
  [3, 5], [3, 7], [4, 7], [6, 6], [6, 10], [6, 11],
  [9, 10], [11, 11], [11, 6], [11, 4], [9, 2], [11, 2],
  [15, 2], [17, 2], [17, 8], [15, 8], [16, 9], [14, 8],
  [2, 5], [4, 5], [5, 5], [7, 11],
];

async function nextBuildTile(page) {
  return page.evaluate((sites) => {
    const s = window.__towerForge.getState();
    const shopOpen = !!window.__towerForge.getUiRects().shop;
    if (shopOpen || s.gold < 40) return null;
    const occ = new Set((s.towerSockets ?? []).map((t) => `${t.col},${t.row}`));
    for (const [col, row] of sites) {
      if (!occ.has(`${col},${row}`)) return { col, row, x: (col + 0.5) * 48, y: (row + 0.5) * 48, w: 48, h: 48 };
    }
    return null;
  }, BUILD_SITES);
}

async function placeAffordableTowers(page) {
  await page.evaluate(() => window.__towerForge.closePanel?.());
  const towersBtn = (await ui(page)).towers?.["ember-spire"];
  if (towersBtn) await tapRect(page, towersBtn);
  await page.waitForTimeout(40);
  for (let i = 0; i < BUILD_SITES.length; i++) {
    const tile = await nextBuildTile(page);
    if (!tile) break;
    const before = await page.evaluate(() => window.__towerForge.getState().towers);
    await tapRect(page, tile);
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => window.__towerForge.getState().towers);
    if (after <= before) {
      // Missed or blocked; close any panel and try the next site.
      await page.evaluate(() => window.__towerForge.closePanel?.());
    }
  }
  return page.evaluate(() => window.__towerForge.getState().towers);
}

async function runLoop(page, { takeShots }) {
  const notes = {};
  await page.addInitScript(() => localStorage.removeItem("tower-forge-profile"));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, "bastion");
  await dismissHelp(page);

  await enterDepth(page, 1);
  await page.evaluate(() => window.__towerForge.guaranteeDrop?.("relic"));

  const placed = await placeAffordableTowers(page);
  if (!placed || placed < 1) throw new Error("tower was not placed");
  notes.placed = { towers: placed };
  notes.towerCounts = [placed];

  let bought = false;
  let battleLoot = false;
  let sawUnique = false;
  let wavesCleared = 0;

  for (let i = 0; i < 12; i++) {
    const built = await placeAffordableTowers(page);
    notes.towerCounts = (notes.towerCounts ?? []).concat([built]);
    const start = (await ui(page)).startWave;
    await tapRect(page, start);
    if (!battleLoot && takeShots) {
      for (let k = 0; k < 40; k++) {
        const n = await page.evaluate(() => window.__towerForge.getState().enemiesAlive);
        if (n >= 3) {
          await shot(page, "battle-loot", true);
          battleLoot = true;
          break;
        }
        await page.waitForTimeout(80);
      }
    }
    const ev = await waitEvent(page);
    wavesCleared = ev.wave;
    if (ev.unique || ev.sawUnique) sawUnique = true;
    if (ev.unique) sawUnique = true;
    if (!battleLoot && ev.sawEnemies && takeShots) {
      // If we already left the field (shop/spoils), still a useful mid-run shot if enemies remain.
      if (ev.enemiesAlive > 0 && !ev.shop && !ev.spoils) {
        await shot(page, "battle-loot", true);
        battleLoot = true;
      }
    }
    if (ev.outcome === "lost") {
      const st = await page.evaluate(() => window.__towerForge.getState());
      throw new Error(`lost on wave ${ev.wave}, lives ${ev.lives}, towers=${st.towers}, gold=${st.gold}, counts=${JSON.stringify(notes.towerCounts)}`);
    }
    if (ev.shop) {
      if (!bought && ev.shopOffers?.[0]) {
        const goldBefore = ev.gold;
        await tapRect(page, ev.shopOffers[0]);
        await page.waitForTimeout(80);
        bought = true;
        notes.shopGoldBefore = goldBefore;
        notes.shopGoldAfter = (await page.evaluate(() => window.__towerForge.getState().gold));
      }
      const close = ev.shopClose ?? (await ui(page)).shop?.close;
      if (close) await tapRect(page, close);
      await page.waitForTimeout(80);
      await placeAffordableTowers(page);
      continue;
    }
    if (ev.spoils || ev.outcome === "won") {
      if (!battleLoot && takeShots) await shot(page, "battle-loot", true);
      const take = ev.spoilsTake ?? (await ui(page)).spoilsTake;
      if (takeShots) await shot(page, "spoils", true);
      if (take) await tapRect(page, take);
      await page.waitForTimeout(120);
      break;
    }
  }

  const afterWin = await page.evaluate(() => ({
    outcome: window.__towerForge.getState().outcome,
    spoils: window.__towerForge.getSpoils?.() ?? [],
  }));
  notes.win = afterWin.outcome;
  notes.wavesCleared = wavesCleared;
  notes.sawUnique = sawUnique;
  notes.bought = bought;
  if (afterWin.outcome !== "won") throw new Error(`did not win: ${JSON.stringify(afterWin)}`);
  if (!bought) throw new Error("shop purchase did not happen");

  const ret = (await ui(page)).returnToBastion;
  await tapRect(page, ret);
  await waitReady(page, "bastion");
  await dismissHelp(page);

  let profile = await page.evaluate(() => window.__towerForge.getProfile());
  if (profile.highestDepthCleared < 1) throw new Error("Depth 2 not unlocked");
  notes.points = profile.unspentPoints;
  notes.xp = profile.accountXp;
  notes.stashRelics = profile.relicInventory.length;
  notes.currency = profile.currency;

  const r0 = await ui(page);
  await tapRect(page, r0.tabStash);
  await page.waitForTimeout(120);
  await shot(page, "hub-stash", takeShots);

  // Gift a Normal Relic at the front of the bag so Forge page 1 can select it.
  const giftedUid = await page.evaluate(() => {
    const relic = window.__towerForge.giveRelic("ember-core", "normal");
    const p = window.__towerForge.getProfile();
    p.relicInventory = [relic, ...p.relicInventory.filter((r) => r.uid !== relic.uid)];
    if ((p.currency["kindle-shard"] ?? 0) < 1) window.__towerForge.giveCurrency?.("kindle-shard", 1);
    return relic.uid;
  });

  const r1 = await ui(page);
  await tapRect(page, r1.tabForge);
  await page.waitForTimeout(150);
  const forge = await ui(page);
  if (!forge.forgeRelics?.[0] || !forge.forgeCurrencies?.[0] || !forge.forgeApply) {
    throw new Error("forge rects missing");
  }
  await tapRect(page, forge.forgeRelics[0]);
  await tapRect(page, forge.forgeCurrencies[0]);
  await shot(page, "forge", takeShots);
  await tapRect(page, forge.forgeApply);
  await page.waitForTimeout(150);
  const crafted = await page.evaluate((uid) => {
    const relic = window.__towerForge.getProfile().relicInventory.find((r) => r.uid === uid);
    return relic ? { defId: relic.defId, rarity: relic.rarity, affixes: relic.affixes?.length ?? 0, uid: relic.uid } : null;
  }, giftedUid);
  if (!crafted || crafted.rarity !== "magic") throw new Error(`craft failed: ${JSON.stringify(crafted)}`);
  notes.crafted = crafted;

  const r2 = await ui(page);
  await tapRect(page, r2.tabLoadout);
  await page.waitForTimeout(150);
  const beforeEquip = await page.evaluate(() => window.__towerForge.getState().preview?.damage);
  const load = await ui(page);
  await tapRect(page, load.invTabRelics);
  await page.waitForTimeout(120);
  const load2 = await ui(page);
  if (!load2.inventory?.[0] || !load2.relics?.[0]) {
    throw new Error(`loadout relic rects missing inv=${load2.inventory?.length} slots=${load2.relics?.length}`);
  }
  await tapRect(page, load2.inventory[0]);
  await tapRect(page, load2.relics[0]);
  await page.waitForTimeout(150);
  const afterEquip = await page.evaluate((uid) => {
    const p = window.__towerForge.getProfile();
    const slotted = p.loadouts["ember-spire"]?.relics?.map((r) => r && r.uid);
    return { damage: window.__towerForge.getState().preview?.damage, slotted, stillInBag: p.relicInventory.some((r) => r.uid === uid) };
  }, giftedUid);
  if (!afterEquip.slotted?.includes(giftedUid)) {
    throw new Error(`relic not equipped: ${JSON.stringify(afterEquip)}`);
  }
  if (!(afterEquip.damage > beforeEquip)) throw new Error(`relic did not change stats: ${beforeEquip} -> ${JSON.stringify(afterEquip)}`);
  notes.equip = { beforeEquip, afterEquip };

  await page.evaluate(() => {
    if ((window.__towerForge.getProfile().unspentPoints ?? 0) < 1) window.__towerForge.givePoints?.(1);
  });
  const r3 = await ui(page);
  await tapRect(page, r3.tabLattice);
  await page.waitForTimeout(150);
  await shot(page, "lattice", takeShots);
  const hearth = (await ui(page)).latticeNodes?.["hearth-ember"];
  if (!hearth) throw new Error("hearth node missing");
  await tapRect(page, hearth);
  await page.waitForTimeout(120);
  const r4 = await ui(page);
  await tapRect(page, r4.tabLoadout);
  await page.waitForTimeout(120);
  const afterLattice = await page.evaluate(() => ({
    damage: window.__towerForge.getState().preview?.damage,
    nodes: window.__towerForge.getProfile().allocatedNodes,
  }));
  if (!afterLattice.nodes.includes("hearth-ember")) throw new Error(`lattice not allocated: ${JSON.stringify(afterLattice.nodes)}`);
  if (!(afterLattice.damage > afterEquip.damage)) throw new Error(`lattice did not change stats: ${afterEquip.damage} -> ${afterLattice.damage}`);
  notes.lattice = afterLattice;

  const r5 = await ui(page);
  await tapRect(page, r5.enterBreach);
  await page.waitForTimeout(150);
  const sel = (await ui(page)).depthSelect;
  if (!sel?.depths?.[1]) throw new Error("depth 2 button missing");
  await shot(page, "breach-select", takeShots);
  await tapRect(page, sel.depths[1]);
  await tapRect(page, sel.enter);
  await waitReady(page, "game");

  await page.evaluate(() => window.__towerForge.setTimeScale?.(1));
  const rare = await page.evaluate(() => window.__towerForge.spawnModified("rare"));
  if (!rare || rare.rarity !== "rare" || rare.mods.length < 3) throw new Error(`rare missing: ${JSON.stringify(rare)}`);
  notes.rare = rare;

  const stress = await page.evaluate(async () => {
    const r = window.__towerForge.stress(300);
    return r;
  });
  await page.waitForTimeout(1400);
  const fps = await page.evaluate(() => window.__towerForge.getState().fps);
  notes.stress = { spawned: stress.spawned, fps };
  if (stress.spawned < 300) throw new Error(`stress spawned ${stress.spawned}`);

  return notes;
}

async function withPage(browser, viewport, label, takeShots) {
  const errors = [];
  const pageErrors = [];
  const context = await browser.newContext({
    viewport,
    ...(label === "iphone" ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  try {
    const notes = await runLoop(page, { takeShots });
    await context.close();
    return { label, notes, errors, pageErrors };
  } catch (err) {
    if (takeShots) await page.screenshot({ path: join(shots, "final-failure.png") }).catch(() => {});
    await context.close();
    throw new Error(`${label}: ${err instanceof Error ? err.message : err}`);
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
});

let desktop;
let iphone;
try {
  desktop = await withPage(browser, { width: 1280, height: 860 }, "desktop", true);
  iphone = await withPage(browser, { width: 844, height: 390 }, "iphone", false);
} finally {
  await browser.close();
}

const allErrors = [...desktop.errors, ...desktop.pageErrors, ...iphone.errors, ...iphone.pageErrors];
const report = { desktop, iphone, shots: SHOT_NAMES.map((n) => `screenshots/${n}.png`) };
console.log(JSON.stringify(report, null, 2));
if (allErrors.length) {
  console.error("console errors", allErrors);
  process.exit(1);
}
if (desktop.notes.stress.fps < 20) {
  console.error("low fps", desktop.notes.stress);
  process.exit(1);
}
