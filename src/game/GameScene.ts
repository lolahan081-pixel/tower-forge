import Phaser from "phaser";
import { ENEMIES, type EnemyId } from "../data/enemies";
import { type GemInstance } from "../data/items";
import {
  MAP_COLS,
  MAP_ROWS,
  STARTING_GOLD,
  STARTING_LIVES,
  TILE_SIZE,
  cellCenter,
  isBuildableTile,
  isInBounds,
} from "../data/map";
import { isSigilId, SIGILS } from "../data/sigils";
import { grantSocketXp, resolveAttack, sigilFitsFrame, type ResolvedAttack } from "../data/stats";
import { TOWERS, isTowerId, type TowerId } from "../data/towers";
import { Palette } from "../palette";
import { collectInRadius, findChainTarget, findNearestToExit } from "../sim/combat";
import { EnemyPool, type Enemy } from "../sim/EnemyPool";
import { PATH } from "../sim/path";
import { BeamPool, NovaPool, ProjectilePool } from "../sim/ProjectilePool";
import { WaveController } from "../sim/WaveController";
import { Hud, pointerToCell } from "./Hud";
import { createStarterInventory, TowerPanel } from "./TowerPanel";
import { drawBoard } from "./drawMap";
import { generateTextures } from "./textures";
import type { PlacedTower } from "./towerState";

export type Outcome = "playing" | "won" | "lost";

export type GemSnap = { uid: string; defId: string; kind: string; level: number; xp: number };

export type GameSnapshot = {
  ready: boolean;
  gold: number;
  lives: number;
  wave: number;
  waveActive: boolean;
  enemiesAlive: number;
  towers: number;
  projectiles: number;
  peakProjectiles: number;
  lastVolleyCount: number;
  fps: number;
  outcome: Outcome;
  selected: TowerId;
  panelOpen: boolean;
  inventory: GemSnap[];
  towerSockets: {
    col: number;
    row: number;
    sockets: (GemSnap | null)[];
    resolved: ResolvedAttack;
  }[];
};

export class GameScene extends Phaser.Scene {
  private gold = STARTING_GOLD;
  private lives = STARTING_LIVES;
  private outcome: Outcome = "playing";
  private selected: TowerId = "ember-spire";
  private towers: PlacedTower[] = [];
  private occupied = new Set<string>();
  private inventory: GemInstance[] = [];
  private enemies!: EnemyPool;
  private projectiles!: ProjectilePool;
  private beams!: BeamPool;
  private novas!: NovaPool;
  private waves = new WaveController();
  private hud!: Hud;
  private panel!: TowerPanel;
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

  create(): void {
    generateTextures(this);
    drawBoard(this);
    this.inventory = createStarterInventory();

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
    );

    this.panel = new TowerPanel(this, {
      inventory: () => this.inventory,
      socket: (tower, slot, uid) => this.trySocket(tower, slot, uid),
      unsocket: (tower, slot) => this.tryUnsocket(tower, slot),
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.updateHover(pointer.worldX, pointer.worldY);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      if (this.hud.isOverHud(pointer.worldY)) return;
      if (this.panel.contains(pointer.worldX, pointer.worldY)) return;
      const cell = pointerToCell(pointer.worldX, pointer.worldY);
      const existing = this.towerAt(cell.col, cell.row);
      if (existing) {
        this.panel.show(existing);
        return;
      }
      if (this.panel.visible) this.panel.hide();
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
  }

  update(_time: number, delta: number): void {
    const dtMs = delta;
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
      }
    } else {
      this.beams.step(dtSec);
      this.novas.step(dtSec);
    }

    if (this.hudDirty) {
      this.hud.refresh(this.hudArgs());
      this.hudDirty = false;
    }
  }

  tryBuild(col: number, row: number, towerId: TowerId): boolean {
    if (this.outcome !== "playing") return false;
    if (!isBuildableTile(col, row)) return false;
    const key = `${col},${row}`;
    if (this.occupied.has(key)) return false;
    const def = TOWERS[towerId];
    if (this.gold < def.cost) return false;

    const { x, y } = cellCenter(col, row);
    const sockets: (GemInstance | null)[] = [];
    for (let i = 0; i < def.sockets; i++) sockets.push(null);
    const sprite = this.add.image(x, y, def.id).setDepth(4);
    const rangeGfx = this.add.graphics().setDepth(2).setVisible(false);
    rangeGfx.lineStyle(1, def.accent, 0.35);
    rangeGfx.strokeCircle(x, y, def.stats.range);

    this.towers.push({
      col,
      row,
      id: towerId,
      x,
      y,
      sockets,
      resolved: resolveAttack(def, sockets),
      cooldown: 0,
      sprite,
      rangeGfx,
    });
    this.occupied.add(key);
    this.gold -= def.cost;
    this.hudDirty = true;
    return true;
  }

  tryStartWave(): boolean {
    if (this.outcome !== "playing") return false;
    if (!this.waves.startNext()) return false;
    this.hudDirty = true;
    return true;
  }

  trySocket(tower: PlacedTower, slot: number, uid: string): boolean {
    if (slot < 0 || slot >= tower.sockets.length) return false;
    const incoming = this.takeGemByUid(uid, tower);
    if (!incoming) return false;

    if (incoming.kind === "sigil") {
      if (!isSigilId(incoming.defId) || !sigilFitsFrame(SIGILS[incoming.defId].tags, TOWERS[tower.id].tags)) {
        this.inventory.push(incoming);
        return false;
      }
      for (let i = 0; i < tower.sockets.length; i++) {
        const g = tower.sockets[i];
        if (i !== slot && g && g.kind === "sigil") {
          this.inventory.push(g);
          tower.sockets[i] = null;
        }
      }
    }

    const occupant = tower.sockets[slot];
    if (occupant) this.inventory.push(occupant);
    tower.sockets[slot] = incoming;
    this.recompute(tower);
    return true;
  }

  tryUnsocket(tower: PlacedTower, slot: number): boolean {
    if (slot < 0 || slot >= tower.sockets.length) return false;
    const gem = tower.sockets[slot];
    if (!gem) return false;
    tower.sockets[slot] = null;
    this.inventory.push(gem);
    this.recompute(tower);
    return true;
  }

  /** Pull a gem out of inventory, or off this same tower if it is already socketed. */
  private takeGemByUid(uid: string, tower: PlacedTower): GemInstance | null {
    const invIndex = this.inventory.findIndex((g) => g.uid === uid);
    if (invIndex >= 0) {
      const [gem] = this.inventory.splice(invIndex, 1);
      return gem ?? null;
    }
    for (let i = 0; i < tower.sockets.length; i++) {
      const g = tower.sockets[i];
      if (g && g.uid === uid) {
        tower.sockets[i] = null;
        return g;
      }
    }
    return null;
  }

  private recompute(tower: PlacedTower): void {
    tower.resolved = resolveAttack(TOWERS[tower.id], tower.sockets);
    if (this.panel.openTower === tower) this.panel.refresh();
  }

  private towerAt(col: number, row: number): PlacedTower | undefined {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (t && t.col === col && t.row === row) return t;
    }
    return undefined;
  }

  private spawnEnemy(id: EnemyId): void {
    this.enemies.spawn(ENEMIES[id]);
  }

  private stepEnemies(dtSec: number): void {
    const list = this.enemies.active;
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
      if (tower.cooldown > 0) tower.cooldown -= dtSec;
      if (enemies.length === 0) continue;
      if (tower.cooldown > 0) continue;
      const resolved = tower.resolved;
      if (resolved.behaviour === "none" || resolved.attackRate <= 0) continue;
      const target = findNearestToExit(tower.x, tower.y, resolved.range, enemies);
      if (!target) continue;
      this.fire(t, tower, resolved, target, enemies);
      tower.cooldown = 1 / resolved.attackRate;
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
      if (e.applyDamage(resolved.damage)) this.killEnemy(e, index);
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
      const killed = current.applyDamage(resolved.damage);
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
        const killed = hit.applyDamage(proj.damage);
        if (killed) this.killEnemy(hit, proj.ownerIndex);
      }
      if (!proj.alive) this.projectiles.releaseAt(i);
    }
  }

  private killEnemy(enemy: Enemy, ownerIndex: number): void {
    const reward = enemy.def?.goldReward ?? 0;
    const list = this.enemies.active;
    const idx = list.indexOf(enemy);
    if (idx >= 0) this.enemies.releaseAt(idx);
    else enemy.release();
    if (this.stressMode) return;
    if (reward > 0) {
      this.gold += reward;
      this.hudDirty = true;
    }
    const tower = this.towers[ownerIndex];
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
    const ok = isBuildableTile(col, row);
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
      waveActive: this.waves.active,
      selected: this.selected,
      outcome: this.outcome,
      canStart: this.waves.canStart(),
    };
  }

  getSnapshot(): GameSnapshot {
    return {
      ready: true,
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
      inventory: this.inventory.map(snapGem),
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
      placeTower: (col: number, row: number, towerId?: string): boolean => {
        const id = towerId && isTowerId(towerId) ? towerId : this.selected;
        return this.tryBuild(col, row, id);
      },
      startWave: (): boolean => this.tryStartWave(),
      getState: (): GameSnapshot => this.getSnapshot(),
      firstBuildableNearPath: (): { col: number; row: number } => firstBuildableNearPath(this.occupied),
      stress: (count: number): { spawned: number; fps: number } => this.runStress(count),
      enemyPositions: (): { x: number; y: number; progress: number; hp: number }[] => {
        return this.enemies.active.map((e) => ({ x: e.x, y: e.y, progress: e.progress, hp: e.hp }));
      },
      openPanel: (col: number, row: number): boolean => {
        const t = this.towerAt(col, row);
        if (!t) return false;
        this.panel.show(t);
        return true;
      },
      socketByDef: (col: number, row: number, defId: string): boolean => {
        const t = this.towerAt(col, row);
        if (!t) return false;
        const gem = this.inventory.find((g) => g.defId === defId);
        if (!gem) return false;
        const slot = firstOpenSlot(t, gem.kind === "sigil");
        if (slot < 0) return false;
        return this.trySocket(t, slot, gem.uid);
      },
    };
    window.__towerForge = api;
  }

  private runStress(count: number): { spawned: number; fps: number } {
    this.stressMode = true;
    const n = Math.max(0, Math.min(count, 400));
    const startCount = this.enemies.active.length;
    for (let i = 0; i < n; i++) {
      const id: EnemyId = (i & 1) === 0 ? "wretch" : "brute";
      this.enemies.spawn(ENEMIES[id]);
    }
    const active = this.enemies.active;
    const placed = active.length - startCount;
    for (let i = 0; i < placed; i++) {
      const enemy = active[startCount + i];
      if (!enemy) continue;
      enemy.dist = (i / Math.max(1, placed)) * PATH.totalLen * 0.92;
      enemy.advance(0);
    }
    return { spawned: placed, fps: this.getSnapshot().fps };
  }
}

function snapGem(g: GemInstance): GemSnap {
  return { uid: g.uid, defId: g.defId, kind: g.kind, level: g.level, xp: g.xp };
}

function firstOpenSlot(tower: PlacedTower, preferFront: boolean): number {
  if (preferFront) {
    for (let i = 0; i < tower.sockets.length; i++) if (!tower.sockets[i]) return i;
  } else {
    for (let i = 1; i < tower.sockets.length; i++) if (!tower.sockets[i]) return i;
    if (!tower.sockets[0]) return 0;
  }
  return -1;
}

function firstBuildableNearPath(occupied: Set<string>): { col: number; row: number } {
  const candidates: { col: number; row: number }[] = [
    { col: 3, row: 5 },
    { col: 3, row: 7 },
    { col: 2, row: 5 },
    { col: 4, row: 5 },
    { col: 5, row: 5 },
    { col: 10, row: 3 },
    { col: 16, row: 7 },
  ];
  for (const c of candidates) {
    if (isBuildableTile(c.col, c.row) && !occupied.has(`${c.col},${c.row}`)) return c;
  }
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (isBuildableTile(col, row) && !occupied.has(`${col},${row}`)) return { col, row };
    }
  }
  return { col: 1, row: 1 };
}

