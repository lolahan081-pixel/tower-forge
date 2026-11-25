import Phaser from "phaser";
import { ENEMIES, type EnemyId } from "../data/enemies";
import { makeGem, type GemInstance } from "../data/items";
import { allowedDropsFor, rollKillDrops, type SpoilsItem } from "../data/drops";
import { buildBreachWaves, goldScale, hpScale, livesForDepth, speedScale } from "../data/depths";
import { rarityGoldMult, rollEnemyPack, type EnemyRarity } from "../data/enemyMods";
import { ATLAS_START_ID, getAtlasNode, isAtlasNodeId } from "../data/atlas";
import { getMapLayout, isMapLayoutId, type MapLayout } from "../data/maps";
import { awardBreachClear, collectSpoils, getProfile, markBattleHintSeen, markShopHintSeen, persistProfile, setHighestDepthCleared } from "../data/profile";
import { isFeatureUnlocked } from "../data/unlocks";
import { makeRelic, type RelicId, type RelicRarity } from "../data/relics";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  MAP_ROWS,
  STARTING_GOLD,
  STARTING_LIVES,
  TILE_SIZE,
  cellCenter,
  firstBuildableNearPath,
  isBuildableTile,
  isInBounds,
} from "../data/map";
import { isSigilId, SIGILS } from "../data/sigils";
import { latticeForTags } from "../data/lattice";
import { grantSocketXp, resolveLoadout, sigilFitsFrame, type ResolvedAttack } from "../data/stats";
import { TOWERS, isTowerId, type TowerId } from "../data/towers";
import { Palette } from "../palette";
import { collectInRadius, findChainTarget, findNearestToExit } from "../sim/combat";
import { EnemyPool, tickEnemyAuras, type Enemy } from "../sim/EnemyPool";
import { routesForPaths, type PathRoute } from "../sim/path";
import { BeamPool, NovaPool, ProjectilePool } from "../sim/ProjectilePool";
import { WaveController } from "../sim/WaveController";
import type { GameSnapshot, GemSnap } from "../debug";
import { BattleHint } from "./BattleHint";
import { MessagePopup } from "./MessagePopup";
import { HelpOverlay } from "./HelpOverlay";
import { Hud, pointerToCell } from "./Hud";
import { rollShopOffers } from "../data/shop";
import { ShopOverlay } from "./ShopOverlay";
import { SigilPanel } from "./SigilPanel";
import { SpoilsOverlay } from "./SpoilsOverlay";
import { drawBoard } from "./drawMap";
import { gemName } from "./gems";
import { generateTextures } from "./textures";
import type { PlacedTower } from "./towerState";
import { pointerWorld, prepareSceneInput, startScene } from "./ui";

export type Outcome = "playing" | "won" | "lost";

export class GameScene extends Phaser.Scene {
  private gold = STARTING_GOLD;
  private lives = STARTING_LIVES;
  private outcome: Outcome = "playing";
  private selected: TowerId = "ember-spire";
  private towers: PlacedTower[] = [];
  private occupied = new Set<string>();
  private enemies!: EnemyPool;
  private projectiles!: ProjectilePool;
  private beams!: BeamPool;
  private novas!: NovaPool;
  private waves = new WaveController();
  private hud!: Hud;
  private panel!: SigilPanel;
  private help!: HelpOverlay;
  private battleHint!: BattleHint;
  private lastTower: PlacedTower | null = null;
  private spoilsOverlay!: SpoilsOverlay;
  private spoils: SpoilsItem[] = [];
  private depth = 1;
  private atlasNodeId = ATLAS_START_ID;
  private layout: MapLayout = getMapLayout("cinder-approach");
  private routes: PathRoute[] = routesForPaths(getMapLayout("cinder-approach").paths);
  private spawnPathIndex = 0;
  private shopHint!: MessagePopup;
  private dropGuarantee: "off" | "relic" | "rune" | "sigil" | "currency" = "off";
  private forceRarity: "off" | EnemyRarity = "off";
  private shop!: ShopOverlay;
  private timeScale = 1;
  private hover!: Phaser.GameObjects.Rectangle;
  private rangePreview!: Phaser.GameObjects.Graphics;
  private hudDirty = true;
  private fpsEma = 60;
  private stressMode = false;
  private peakProjectiles = 0;
  private lastVolleyCount = 0;
  private readonly novaHits: Enemy[] = new Array(64);
  private readonly chainMarks: (Enemy | null)[] = [null, null, null, null, null, null, null, null];

  constructor() {
    super("game");
  }

  init(data?: { depth?: number; layoutId?: string; atlasNodeId?: string }): void {
    const nodeId = data?.atlasNodeId && isAtlasNodeId(data.atlasNodeId) ? data.atlasNodeId : ATLAS_START_ID;
    const node = getAtlasNode(nodeId);
    this.atlasNodeId = node.id;
    this.depth = data?.depth && data.depth > 0 ? data.depth : node.depth;
    const layoutId = data?.layoutId && isMapLayoutId(data.layoutId) ? data.layoutId : node.layoutId;
    this.layout = getMapLayout(layoutId);
    this.routes = routesForPaths(this.layout.paths);
    this.spawnPathIndex = 0;
  }

  create(): void {
    this.resetBattleState();
    this.waves.useWaves(buildBreachWaves(this.depth));
    this.lives = livesForDepth(this.depth);
    generateTextures(this);
    prepareSceneInput(this);
    drawBoard(this, this.layout);

    this.enemies = new EnemyPool(this, 64);
    this.projectiles = new ProjectilePool(this, 96);
    this.beams = new BeamPool(this, 24);
    this.novas = new NovaPool(this, 8);

    this.hover = this.add
      .rectangle(0, 0, TILE_SIZE - 2, TILE_SIZE - 2)
      .setStrokeStyle(2, Palette.gold)
      .setFillStyle(Palette.gold, 0.08)
      .setDepth(3)
      .setVisible(false);
    this.rangePreview = this.add.graphics().setDepth(2);

    this.hud = new Hud(
      this,
      (id) => {
        this.selected = id;
        this.hudDirty = true;
      },
      () => {
        this.tryStartWave();
      },
      () => {
        this.openInscribe();
      },
      () => {
        this.returnToBastion();
      },
      () => {
        this.returnToMenu();
      },
    );

    this.help = new HelpOverlay(this, () => {
      this.hudDirty = true;
    }, "battle");

    this.panel = new SigilPanel(this, {
      inventory: () => getProfile().sigilInventory,
      loadoutRunes: (tower) => getProfile().loadouts[tower.id]?.runes ?? [],
      swap: (tower, uid) => this.trySwapSigil(tower, uid),
      unsocket: (tower) => this.tryUnsocketSigil(tower),
    });

    this.spoilsOverlay = new SpoilsOverlay(this, () => {
      this.spoils = [];
      this.hudDirty = true;
    });
    this.shop = new ShopOverlay(
      this,
      () => this.gold,
      (amount) => {
        if (this.gold < amount) return false;
        this.gold -= amount;
        this.hudDirty = true;
        return true;
      },
      () => {
        this.hudDirty = true;
      },
    );
    const scaleParam = Number(new URLSearchParams(window.location.search).get("timescale") ?? "1");
    this.timeScale = Number.isFinite(scaleParam) && scaleParam > 0 ? Math.min(12, scaleParam) : 1;

    this.shopHint = new MessagePopup(this, 92);
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const pt = pointerWorld(this, pointer);
      this.updateHover(pt.x, pt.y);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      const pt = pointerWorld(this, pointer);
      if (this.shopHint.visible) {
        this.shopHint.handleTap(pt.x, pt.y);
        return;
      }
      if (this.help.visible) {
        this.help.handleTap(pt.x, pt.y);
        return;
      }
      if (this.battleHint.visible) {
        this.battleHint.handleTap(pt.x, pt.y);
        return;
      }
      if (this.spoilsOverlay.visible) {
        this.spoilsOverlay.handleTap(pt.x, pt.y);
        return;
      }
      if (this.shop.visible) {
        this.shop.handleTap(pt.x, pt.y);
        return;
      }
      if (this.panel.visible) {
        this.panel.handleTap(pt.x, pt.y);
        return;
      }
      if (this.hud.isOverMenu(pt.x, pt.y) || this.hud.isOverHud(pt.y)) return;
      const cell = pointerToCell(pt.x, pt.y);
      const existing = this.towerAt(cell.col, cell.row);
      if (existing) {
        this.lastTower = existing;
        this.panel.show(existing);
        return;
      }
      this.tryBuild(cell.col, cell.row, this.selected);
    });

    this.input.keyboard?.on("keydown-ONE", () => {
      this.selected = "ember-spire";
      this.hudDirty = true;
    });
    this.input.keyboard?.on("keydown-TWO", () => {
      this.selected = "blood-font";
      this.hudDirty = true;
    });
    this.input.keyboard?.on("keydown-SPACE", () => {
      this.tryStartWave();
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      this.panel.hide();
    });

    this.hud.refresh(this.hudArgs());
    this.exposeDebugHook();
    this.help.hide();
    this.battleHint = new BattleHint(this, () => {
      markBattleHintSeen();
      this.hudDirty = true;
    });
    if (!getProfile().seenBattleHint) this.battleHint.show();
  }

  private resetBattleState(): void {
    this.gold = STARTING_GOLD;
    this.lives = livesForDepth(this.depth);
    this.outcome = "playing";
    this.selected = "ember-spire";
    this.towers = [];
    this.occupied = new Set();
    this.lastTower = null;
    this.spoils = [];
    this.dropGuarantee = "off";
    this.forceRarity = "off";
    this.hudDirty = true;
    this.fpsEma = 60;
    this.stressMode = false;
    this.peakProjectiles = 0;
    this.lastVolleyCount = 0;
    this.waves = new WaveController();
  }

  private returnToBastion(): void {
    if (this.spoils.length > 0) collectSpoils(this.spoils);
    this.spoils = [];
    persistProfile();
    startScene(this, "bastion");
  }

  private returnToMenu(): void {
    if (this.spoils.length > 0) collectSpoils(this.spoils);
    this.spoils = [];
    persistProfile();
    startScene(this, "menu");
  }

  private openInscribe(): void {
    if (this.help.visible) return;
    const tower = this.lastTower ?? this.towers[this.towers.length - 1];
    if (!tower) return;
    this.panel.show(tower);
  }


  update(time: number, delta: number): void {
    const dtMs = delta * this.timeScale;
    const dtSec = dtMs * 0.001;
    const instantFps = this.game.loop.actualFps;
    if (Number.isFinite(instantFps) && instantFps > 0) {
      this.fpsEma = this.fpsEma * 0.9 + instantFps * 0.1;
    }
    if (this.projectiles.active.length > this.peakProjectiles) {
      this.peakProjectiles = this.projectiles.active.length;
    }

    if (this.outcome === "playing") {
      this.waves.update(dtMs, (id) => this.spawnEnemy(id));
      this.stepEnemies(dtSec);
      this.stepTowers(dtSec);
      this.stepProjectiles(dtSec);
      this.beams.step(dtSec);
      this.novas.step(dtSec);
      if (this.waves.endIfClear(this.enemies.livingCount)) {
        this.hudDirty = true;
        if (!this.waves.hasMoreWaves) this.setOutcome("won");
        else this.openShop();
      }
    } else {
      this.beams.step(dtSec);
      this.novas.step(dtSec);
    }

    const pulse = 0.55 + 0.45 * Math.sin(time / 180);
    for (let i = 0; i < this.towers.length; i++) {
      const tw = this.towers[i];
      if (tw && tw.badge.visible) tw.badge.setAlpha(pulse);
    }

    if (this.hudDirty) {
      this.hud.refresh(this.hudArgs());
      this.hudDirty = false;
    }
  }

  tryBuild(col: number, row: number, towerId: TowerId): boolean {
    if (this.outcome !== "playing") return false;
    if (!isBuildableTile(col, row, this.layout.tiles)) return false;
    const key = `${col},${row}`;
    if (this.occupied.has(key)) return false;
    const def = TOWERS[towerId];
    if (this.gold < def.cost) return false;

    const { x, y } = cellCenter(col, row);
    const runes = getProfile().loadouts[towerId]?.runes ?? [];
    const sockets: (GemInstance | null)[] = [makeGem("sigil", def.starterSigil), ...runes];
    const sprite = this.add.image(x, y, def.id).setDepth(4);
    const rangeGfx = this.add.graphics().setDepth(2).setVisible(false);
    rangeGfx.lineStyle(1, def.accent, 0.35);
    rangeGfx.strokeCircle(x, y, def.stats.range);
    const badge = this.add.image(x, y - 28, "no-sigil").setDepth(9).setVisible(false);

    const tower: PlacedTower = {
      col,
      row,
      id: towerId,
      x,
      y,
      sockets,
      resolved: resolveLoadout(
        def,
        sockets[0] ?? null,
        sockets.slice(1),
        getProfile().loadouts[towerId]?.relics ?? [],
        latticeForTags(SIGILS[def.starterSigil].tags),
      ),
      cooldown: 0,
      sprite,
      rangeGfx,
      badge,
    };
    this.towers.push(tower);
    this.lastTower = tower;
    this.syncBadge(tower);
    this.occupied.add(key);
    this.gold -= def.cost;
    this.hudDirty = true;
    return true;
  }

  tryStartWave(): boolean {
    if (this.outcome !== "playing") return false;
    if (this.shop.visible) this.shop.hide();
    if (!this.waves.startNext()) return false;
    this.hudDirty = true;
    return true;
  }

  trySwapSigil(tower: PlacedTower, uid: string): boolean {
    const inv = getProfile().sigilInventory;
    const invIndex = inv.findIndex((g) => g.uid === uid);
    if (invIndex < 0) return false;
    const incoming = inv.splice(invIndex, 1)[0];
    if (!incoming) return false;
    if (incoming.kind !== "sigil" || !isSigilId(incoming.defId) || !sigilFitsFrame(SIGILS[incoming.defId].tags, TOWERS[tower.id].tags)) {
      inv.push(incoming);
      return false;
    }
    const occupant = tower.sockets[0];
    if (occupant) inv.push(occupant);
    tower.sockets[0] = incoming;
    persistProfile();
    this.recompute(tower);
    return true;
  }

  tryUnsocketSigil(tower: PlacedTower): boolean {
    const gem = tower.sockets[0];
    if (!gem) return false;
    tower.sockets[0] = null;
    getProfile().sigilInventory.push(gem);
    persistProfile();
    this.recompute(tower);
    return true;
  }

  private recompute(tower: PlacedTower): void {
    const loadout = getProfile().loadouts[tower.id];
    const sigil = tower.sockets[0] && tower.sockets[0].kind === "sigil" ? tower.sockets[0] : null;
    const tags = sigil && isSigilId(sigil.defId) ? SIGILS[sigil.defId].tags : [];
    tower.resolved = resolveLoadout(TOWERS[tower.id], sigil, tower.sockets.slice(1), loadout?.relics ?? [], latticeForTags(tags));
    this.syncBadge(tower);
    if (this.panel.openTower === tower) this.panel.refresh();
  }

  private syncBadge(tower: PlacedTower): void {
    tower.badge.setVisible(tower.resolved.behaviour === "none");
    if (!tower.badge.visible) tower.badge.setAlpha(1);
  }

  private towerAt(col: number, row: number): PlacedTower | undefined {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (t && t.col === col && t.row === row) return t;
    }
    return undefined;
  }


  private nextRoute(): PathRoute {
    const routes = this.routes;
    const route = routes[this.spawnPathIndex % routes.length];
    this.spawnPathIndex += 1;
    return route ?? routes[0]!;
  }

  private openShop(): void {
    const runes = isFeatureUnlocked("runes", getProfile().highestDepthCleared);
    this.shop.show(rollShopOffers(Math.random, { runes }), this.shopInfo(runes));
    if (!getProfile().seenShopHint) {
      this.shopHint.show(
        "The Ashen Peddler",
        "This stall appears between waves. Spend gold from kills and waves on Sigils. Bought Sigils go to your bag; swap them onto a frame with the SIGIL button.\n\nRunes join the stall once you have cleared Depth 1.",
        () => markShopHintSeen(),
      );
    }
  }

  private shopInfo(runesUnlocked: boolean): { owned: string; equipped: string; runesUnlocked: boolean } {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const g of getProfile().sigilInventory) {
      const n = gemName(g);
      if (!seen.has(n)) {
        seen.add(n);
        names.push(n);
      }
    }
    const eq: string[] = [];
    const eqSeen = new Set<string>();
    for (const tower of this.towers) {
      const gem = tower.sockets[0];
      if (!gem) continue;
      const n = gemName(gem);
      if (!eqSeen.has(n)) {
        eqSeen.add(n);
        eq.push(n);
      }
    }
    const cap = (list: string[]): string => {
      if (list.length <= 4) return list.join(", ");
      return `${list.slice(0, 4).join(", ")} and ${list.length - 4} more`;
    };
    return { owned: cap(names), equipped: cap(eq), runesUnlocked };
  }

  private spawnEnemy(id: EnemyId, forced?: EnemyRarity): void {
    const pack =
      id === "hollow-sovereign"
        ? { rarity: "unique" as const, mods: [] }
        : !isFeatureUnlocked("enemy-mods", getProfile().highestDepthCleared) && this.forceRarity === "off" && !forced
          ? { rarity: "normal" as const, mods: [] }
          : rollEnemyPack(this.depth, forced ?? (this.forceRarity === "off" ? undefined : this.forceRarity));
    const path = this.nextRoute();
    this.enemies.spawn(ENEMIES[id], {
      hpMult: hpScale(this.depth),
      speedMult: speedScale(this.depth),
      goldMult: goldScale(this.depth) * rarityGoldMult(pack.rarity),
      rarity: pack.rarity,
      mods: pack.mods,
      path,
    });
  }

  private stepEnemies(dtSec: number): void {
    const list = this.enemies.active;
    tickEnemyAuras(list);
    for (let i = list.length - 1; i >= 0; i--) {
      const enemy = list[i];
      if (!enemy) continue;
      const reached = enemy.advance(dtSec);
      if (reached) {
        this.enemies.releaseAt(i);
        if (!this.stressMode) {
          this.lives -= 1;
          this.hudDirty = true;
          if (this.lives <= 0) this.setOutcome("lost");
        }
      }
    }
  }

  private stepTowers(dtSec: number): void {
    const enemies = this.enemies.active;
    for (let t = 0; t < this.towers.length; t++) {
      const tower = this.towers[t];
      if (!tower) continue;
      tower.cooldown -= dtSec;
      if (enemies.length === 0) continue;
      const resolved = tower.resolved;
      if (resolved.behaviour === "none" || resolved.attackRate <= 0) continue;
      let safety = 0;
      while (tower.cooldown <= 0 && safety < 8) {
        safety += 1;
        const target = findNearestToExit(tower.x, tower.y, resolved.range, enemies);
        if (!target) break;
        this.fire(t, tower, resolved, target, enemies);
        tower.cooldown += 1 / resolved.attackRate;
      }
    }
  }

  private fire(index: number, tower: PlacedTower, resolved: ResolvedAttack, target: Enemy, enemies: Enemy[]): void {
    if (resolved.behaviour === "nova") {
      this.fireNova(index, resolved, target, enemies);
      this.lastVolleyCount = 0;
      return;
    }
    if (resolved.behaviour === "chain" && resolved.projectileSpeed <= 0) {
      this.fireInstantChain(index, tower, resolved, target, enemies);
      this.lastVolleyCount = 0;
      return;
    }
    this.fireProjectiles(index, tower, resolved, target);
  }

  private fireProjectiles(index: number, tower: PlacedTower, resolved: ResolvedAttack, target: Enemy): void {
    const n = resolved.projectileCount;
    const base = Math.atan2(target.y - tower.y, target.x - tower.x);
    const spread = 0.32;
    const tint = 0xffffff;
    const mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const angle = n === 1 ? base : base + (i - mid) * spread;
      const speed = resolved.projectileSpeed;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const home = n === 1 || i === Math.round(mid);
      this.projectiles.spawn(
        tower.x,
        tower.y,
        target,
        resolved.damage,
        speed,
        vx,
        vy,
        resolved.pierceCount,
        resolved.chainCount,
        home,
        resolved.texture,
        tint,
        index,
        resolved.convertToCold,
      );
    }
    this.lastVolleyCount = n;
  }

  private fireNova(index: number, resolved: ResolvedAttack, target: Enemy, enemies: Enemy[]): void {
    this.novas.spawn(target.x, target.y, resolved.novaRadius, Palette.coldBright);
    const n = collectInRadius(target.x, target.y, resolved.novaRadius, enemies, this.novaHits, 64);
    for (let i = 0; i < n; i++) {
      const e = this.novaHits[i];
      if (!e || !e.alive) continue;
      if (e.applyDamage(resolved.damage, resolved.convertToCold)) this.killEnemy(e, index);
    }
  }

  private fireInstantChain(index: number, tower: PlacedTower, resolved: ResolvedAttack, first: Enemy, enemies: Enemy[]): void {
    let x = tower.x;
    let y = tower.y;
    let current: Enemy | null = first;
    let marks = 0;
    for (let i = 0; i < this.chainMarks.length; i++) this.chainMarks[i] = null;
    const jumps = 1 + resolved.chainCount;
    const tint = Palette.lightning;
    for (let j = 0; j < jumps && current; j++) {
      if (marks < this.chainMarks.length) {
        this.chainMarks[marks] = current;
        marks += 1;
      }
      this.beams.spawn(x, y, current.x, current.y, tint, "spark-beam", 0.14);
      const nx = current.x;
      const ny = current.y;
      const killed = current.applyDamage(resolved.damage, resolved.convertToCold);
      if (killed) this.killEnemy(current, index);
      x = nx;
      y = ny;
      current = findChainTarget(x, y, enemies, this.chainMarks, marks);
    }
  }

  private stepProjectiles(dtSec: number): void {
    const list = this.projectiles.active;
    const enemies = this.enemies.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const proj = list[i];
      if (!proj) continue;
      proj.step(dtSec, enemies);
      const hit = proj.hitEnemy;
      if (hit && hit.alive) {
        const killed = hit.applyDamage(proj.damage, proj.convertToCold);
        if (killed) this.killEnemy(hit, proj.ownerIndex);
      }
      if (!proj.alive) this.projectiles.releaseAt(i);
    }
  }

  private killEnemy(enemy: Enemy, ownerIndex: number): void {
    const reward = Math.round((enemy.def?.goldReward ?? 0) * (enemy.goldMult ?? 1));
    const split = enemy.splitOnDeath && enemy.def && !this.stressMode;
    const splitDef = split ? enemy.def : null;
    const splitDist = enemy.dist;
    const splitPath = enemy.path;
    const childHpMult = split && enemy.def ? Math.max(1, Math.round(enemy.maxHp * 0.4)) / enemy.def.maxHp : 0;
    const list = this.enemies.active;
    const idx = list.indexOf(enemy);
    if (idx >= 0) this.enemies.releaseAt(idx);
    else enemy.release();
    if (splitDef && splitPath) {
      for (let s = 0; s < 2; s++) {
        const child = this.enemies.spawn(splitDef, {
          hpMult: childHpMult,
          speedMult: speedScale(this.depth),
          goldMult: 0,
          rarity: "normal",
          mods: [],
          startDist: Math.max(0, splitDist + (s === 0 ? -12 : 12)),
          path: splitPath,
        });
        child.splitOnDeath = false;
      }
    }
    if (this.stressMode) return;
    const tower = this.towers[ownerIndex];
    const goldMult = tower?.resolved.goldMult ?? 1;
    if (reward > 0) {
      this.gold += Math.max(1, Math.round(reward * goldMult));
      this.hudDirty = true;
    }
    const rarity = enemy.rarity ?? "normal";
    if (this.dropGuarantee === "relic") {
      this.spoils.push({ kind: "relic", item: makeRelic("gate-seal", "magic", Math.max(1, this.depth * 2)) });
    } else if (this.dropGuarantee !== "off") {
      const allowed = allowedDropsFor(getProfile().highestDepthCleared);
      const forced = rollKillDrops("unique", this.depth, Math.random, allowed);
      const hit = forced.find((d) => d.kind === this.dropGuarantee);
      if (hit) this.spoils.push(hit);
    } else {
      const drops = rollKillDrops(rarity, this.depth, Math.random, allowedDropsFor(getProfile().highestDepthCleared));
      for (let i = 0; i < drops.length; i++) this.spoils.push(drops[i]!);
    }
    if (tower) {
      grantSocketXp(tower.sockets, reward);
      this.recompute(tower);
    }
  }

  private setOutcome(outcome: Outcome): void {
    if (this.outcome !== "playing") return;
    this.outcome = outcome;
    this.waves.active = false;
    this.hudDirty = true;
    if (outcome === "won") awardBreachClear(this.depth, this.atlasNodeId);
    if (this.spoils.length > 0) this.spoilsOverlay.show(this.spoils);
  }

  private updateHover(x: number, y: number): void {
    if (this.hud.isOverHud(y) || this.panel.contains(x, y) || this.outcome !== "playing") {
      this.hover.setVisible(false);
      this.rangePreview.clear();
      return;
    }
    const { col, row } = pointerToCell(x, y);
    if (!isInBounds(col, row) || row >= MAP_ROWS) {
      this.hover.setVisible(false);
      this.rangePreview.clear();
      return;
    }
    const { x: cx, y: cy } = cellCenter(col, row);
    const key = `${col},${row}`;
    if (this.occupied.has(key)) {
      this.hover.setVisible(false);
      this.rangePreview.clear();
      return;
    }
    const ok = isBuildableTile(col, row, this.layout.tiles);
    this.hover
      .setPosition(cx, cy)
      .setStrokeStyle(2, ok ? Palette.gold : Palette.invalid)
      .setFillStyle(ok ? Palette.gold : Palette.invalid, 0.08)
      .setVisible(true);

    this.rangePreview.clear();
    if (ok) {
      const def = TOWERS[this.selected];
      this.rangePreview.lineStyle(1, def.accent, 0.45);
      this.rangePreview.strokeCircle(cx, cy, def.stats.range);
    }
  }

  private hudArgs() {
    return {
      gold: this.gold,
      lives: this.lives,
      waveNumber: this.waves.waveNumber,
      waveTotal: this.waves.totalWaves,
      waveActive: this.waves.active,
      selected: this.selected,
      outcome: this.outcome,
      canStart: this.waves.canStart(),
      canInscribe: this.towers.length > 0 && this.outcome === "playing",
    };
  }

  getSnapshot(): GameSnapshot {
    return {
      ready: true,
      scene: "game",
      gold: this.gold,
      lives: this.lives,
      wave: this.waves.waveNumber,
      waveActive: this.waves.active,
      enemiesAlive: this.enemies.livingCount,
      towers: this.towers.length,
      projectiles: this.projectiles.active.length,
      peakProjectiles: this.peakProjectiles,
      lastVolleyCount: this.lastVolleyCount,
      fps: Math.round(this.fpsEma * 10) / 10,
      outcome: this.outcome,
      selected: this.selected,
      panelOpen: this.panel.visible,
      helpVisible: this.help.visible,
      layoutId: this.layout.id,
      mapName: this.layout.name,
      atlasNodeId: this.atlasNodeId,
      inventory: getProfile().sigilInventory.map(snapGem),
      towerSockets: this.towers.map((t) => ({
        col: t.col,
        row: t.row,
        sockets: t.sockets.map((g) => (g ? snapGem(g) : null)),
        resolved: t.resolved,
      })),
    };
  }

  private exposeDebugHook(): void {
    const api = {
      ready: true,
      scene: "game" as const,
      placeTower: (col: number, row: number, towerId?: string): boolean => {
        const id = towerId && isTowerId(towerId) ? towerId : this.selected;
        return this.tryBuild(col, row, id);
      },
      startWave: (): boolean => this.tryStartWave(),
      getState: (): GameSnapshot => this.getSnapshot(),
      firstBuildableNearPath: (): { col: number; row: number } => firstBuildableNearPath(this.layout.tiles, this.occupied),
      stress: (count: number): { spawned: number; fps: number } => this.runStress(count),
      enemyPositions: () => {
        return this.enemies.active.map((e) => ({
          x: e.x,
          y: e.y,
          progress: e.progress,
          hp: e.hp,
          rarity: e.rarity,
          mods: e.mods.slice(),
        }));
      },
      openPanel: (col: number, row: number): boolean => {
        const t = this.towerAt(col, row);
        if (!t) return false;
        this.lastTower = t;
        this.panel.show(t);
        return true;
      },
      closePanel: (): void => {
        this.panel.hide();
      },
      dismissHelp: (): void => {
        this.help.dismiss();
      },
      getUiRects: () => ({
        game: { w: GAME_WIDTH, h: GAME_HEIGHT },
        scene: "game" as const,
        helpVisible: this.help.visible,
        helpDismiss: this.help.dismissRect(),
        ...this.hud.rects(),
        panel: this.panel.visible ? this.panel.rects() : null,
        battleHintOk: this.battleHint.visible ? this.battleHint.okRect : null,
        shopHelpOk: this.shopHint.visible ? this.shopHint.okRect : null,
        shop: this.shop.visible ? { offers: this.shop.offerBuyRects, close: this.shop.closeRect } : null,
        spoilsTake: this.spoilsOverlay.visible ? this.spoilsOverlay.takeRect : null,
      }),
      socketByDef: (col: number, row: number, defId: string): boolean => {
        const t = this.towerAt(col, row);
        if (!t) return false;
        const gem = getProfile().sigilInventory.find((g) => g.defId === defId);
        if (!gem) return false;
        return this.trySwapSigil(t, gem.uid);
      },
      getProfile: () => getProfile(),
      forceOutcome: (outcome: "won" | "lost") => {
        this.setOutcome(outcome);
      },
      getSpoils: () => this.spoils,
      collectSpoils: () => {
        this.spoilsOverlay.take();
      },
      giveRelic: (defId?: string, rarity: RelicRarity = "magic") => {
        const id = (defId as RelicId) || "ember-core";
        const relic = makeRelic(id, rarity, Math.max(1, this.depth * 2));
        getProfile().relicInventory.push(relic);
        persistProfile();
        return relic;
      },
      guaranteeDrop: (kind: "off" | "relic" | "rune" | "sigil" | "currency" = "relic") => {
        this.dropGuarantee = kind;
      },
      guaranteeRarity: (rarity: "off" | EnemyRarity = "rare") => {
        this.forceRarity = rarity;
      },
      setHighestDepthCleared: (depth: number) => {
        setHighestDepthCleared(depth);
      },
      setTimeScale: (scale: number) => {
        this.timeScale = Number.isFinite(scale) && scale > 0 ? Math.min(12, scale) : 1;
      },
      spawnModified: (rarity: EnemyRarity = "rare") => {
        this.spawnEnemy("wretch", rarity);
        const e = this.enemies.active[this.enemies.active.length - 1];
        if (e) e.setDist((e.path ?? this.routes[0])!.totalLen * 0.35);
        return e ? { rarity: e.rarity, mods: e.mods.slice(), hp: e.hp } : null;
      },
      shopOffers: () => this.shop.currentOffers,
      buyShop: (index: number) => this.shop.buy(index),
    };
    window.__towerForge = api;
  }

  private runStress(count: number): { spawned: number; fps: number } {
    this.stressMode = true;
    const n = Math.max(0, Math.min(count, 400));
    const startCount = this.enemies.active.length;
    for (let i = 0; i < n; i++) {
      const id: EnemyId = (i & 1) === 0 ? "wretch" : "brute";
      this.enemies.spawn(ENEMIES[id], { path: this.nextRoute() });
    }
    const active = this.enemies.active;
    const placed = active.length - startCount;
    for (let i = 0; i < placed; i++) {
      const enemy = active[startCount + i];
      if (!enemy) continue;
      const total = enemy.path?.totalLen ?? this.routes[0]!.totalLen;
      enemy.dist = (i / Math.max(1, placed)) * total * 0.92;
      enemy.advance(0);
    }
    return { spawned: placed, fps: this.getSnapshot().fps };
  }
}

function snapGem(g: GemInstance): GemSnap {
  return { uid: g.uid, defId: g.defId, kind: g.kind, level: g.level, xp: g.xp };
}
