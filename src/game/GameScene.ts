import { ENEMIES, type EnemyId } from "../data/enemies";
import Phaser from "phaser";
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
import { resolveStats, type StatBlock } from "../data/stats";
import { TOWERS, isTowerId, type TowerId } from "../data/towers";
import { Palette } from "../palette";
import { EnemyPool, type Enemy } from "../sim/EnemyPool";
import { PATH } from "../sim/path";
import { BeamPool, ProjectilePool } from "../sim/ProjectilePool";
import { WaveController } from "../sim/WaveController";
import { Hud, pointerToCell } from "./Hud";
import { drawBoard } from "./drawMap";
import { generateTextures } from "./textures";

export type Outcome = "playing" | "won" | "lost";

export type GameSnapshot = {
  ready: boolean;
  gold: number;
  lives: number;
  wave: number;
  waveActive: boolean;
  enemiesAlive: number;
  towers: number;
  projectiles: number;
  fps: number;
  outcome: Outcome;
  selected: TowerId;
};

type PlacedTower = {
  col: number;
  row: number;
  id: TowerId;
  x: number;
  y: number;
  stats: StatBlock;
  cooldown: number;
  sprite: Phaser.GameObjects.Image;
  rangeGfx: Phaser.GameObjects.Graphics;
};

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
  private waves = new WaveController();
  private hud!: Hud;
  private hover!: Phaser.GameObjects.Rectangle;
  private rangePreview!: Phaser.GameObjects.Graphics;
  private hudDirty = true;
  private fpsEma = 60;
  private stressMode = false;

  constructor() {
    super("game");
  }

  create(): void {
    generateTextures(this);
    drawBoard(this);

    this.enemies = new EnemyPool(this, 64);
    this.projectiles = new ProjectilePool(this, 64);
    this.beams = new BeamPool(this, 16);

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

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.updateHover(pointer.worldX, pointer.worldY);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      if (this.hud.isOverHud(pointer.worldY)) return;
      const cell = pointerToCell(pointer.worldX, pointer.worldY);
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

    if (this.outcome === "playing") {
      this.waves.update(dtMs, (id) => this.spawnEnemy(id));
      this.stepEnemies(dtSec);
      this.stepTowers(dtSec);
      this.stepProjectiles(dtSec);
      this.beams.step(dtSec);
      if (this.waves.endIfClear(this.enemies.livingCount)) {
        this.hudDirty = true;
        if (!this.waves.hasMoreWaves) this.setOutcome("won");
      }
    } else {
      this.beams.step(dtSec);
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
    const stats = resolveStats(def.stats);
    const sprite = this.add.image(x, y, def.id).setDepth(4);
    const rangeGfx = this.add.graphics().setDepth(2).setVisible(false);
    rangeGfx.lineStyle(1, def.accent, 0.35);
    rangeGfx.strokeCircle(x, y, stats.range);

    this.towers.push({
      col,
      row,
      id: towerId,
      x,
      y,
      stats,
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

  private spawnEnemy(id: EnemyId): void {
    const def = ENEMIES[id];
    this.enemies.spawn(def);
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
    if (enemies.length === 0) {
      for (let t = 0; t < this.towers.length; t++) {
        const tower = this.towers[t];
        if (tower && tower.cooldown > 0) tower.cooldown -= dtSec;
      }
      return;
    }
    for (let t = 0; t < this.towers.length; t++) {
      const tower = this.towers[t];
      if (!tower) continue;
      tower.cooldown -= dtSec;
      if (tower.cooldown > 0) continue;
      const target = findNearestToExit(tower.x, tower.y, tower.stats.range, enemies);
      if (!target) continue;
      const def = TOWERS[tower.id];
      if (def.fire === "instant") {
        const killed = target.applyDamage(tower.stats.damage);
        this.beams.spawn(tower.x, tower.y, target.x, target.y);
        if (killed) this.killEnemy(target);
      } else {
        this.projectiles.spawn(tower.x, tower.y, target, tower.stats.damage, def.projectileSpeed);
      }
      const rate = tower.stats.attackRate;
      tower.cooldown = rate > 0 ? 1 / rate : 1;
    }
  }

  private stepProjectiles(dtSec: number): void {
    const list = this.projectiles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const proj = list[i];
      if (!proj) continue;
      const hit = proj.step(dtSec);
      if (!proj.alive) {
        this.projectiles.releaseAt(i);
        continue;
      }
      if (!hit) continue;
      const target = proj.target;
      proj.release();
      this.projectiles.releaseAt(i);
      if (target && target.alive) {
        const killed = target.applyDamage(proj.damage);
        if (killed) this.killEnemy(target);
      }
    }
  }

  private killEnemy(enemy: Enemy): void {
    const reward = enemy.def?.goldReward ?? 0;
    const list = this.enemies.active;
    const idx = list.indexOf(enemy);
    if (idx >= 0) this.enemies.releaseAt(idx);
    else enemy.release();
    if (!this.stressMode && reward > 0) {
      this.gold += reward;
      this.hudDirty = true;
    }
  }

  private setOutcome(outcome: Outcome): void {
    if (this.outcome !== "playing") return;
    this.outcome = outcome;
    this.waves.active = false;
    this.hudDirty = true;
  }

  private updateHover(x: number, y: number): void {
    if (this.hud.isOverHud(y) || this.outcome !== "playing") {
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
    const ok = isBuildableTile(col, row) && !this.occupied.has(key);
    this.hover
      .setPosition(cx, cy)
      .setStrokeStyle(2, ok ? Palette.gold : Palette.invalid)
      .setFillStyle(ok ? Palette.gold : Palette.invalid, 0.08)
      .setVisible(true);

    this.rangePreview.clear();
    if (ok) {
      const range = resolveStats(TOWERS[this.selected].stats).range;
      this.rangePreview.lineStyle(1, TOWERS[this.selected].accent, 0.45);
      this.rangePreview.strokeCircle(cx, cy, range);
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
      fps: Math.round(this.fpsEma * 10) / 10,
      outcome: this.outcome,
      selected: this.selected,
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

function findNearestToExit(x: number, y: number, range: number, enemies: Enemy[]): Enemy | null {
  const rangeSq = range * range;
  let best: Enemy | null = null;
  let bestProgress = -1;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || !e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy > rangeSq) continue;
    if (e.progress > bestProgress) {
      bestProgress = e.progress;
      best = e;
    }
  }
  return best;
}

function firstBuildableNearPath(occupied: Set<string>): { col: number; row: number } {
  // Prefer a cell adjacent to the early corridor (row 6, cols 1-5).
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

