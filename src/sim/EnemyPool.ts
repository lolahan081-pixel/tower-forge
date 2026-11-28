import Phaser from "phaser";
import type { EnemyDef } from "../data/enemies";
import {
  IDENTITY_ENEMY_MODS,
  resolveEnemyMods,
  type EnemyModId,
  type EnemyRarity,
} from "../data/enemyMods";
import { Palette } from "../palette";
import { applySprite, playSpriteAnim } from "../game/sprites";
import { type PathRoute, type PathSample } from "./path";

export class Enemy {
  alive = false;
  def: EnemyDef | null = null;
  hp = 0;
  maxHp = 0;
  speedMult = 1;
  goldMult = 1;
  x = 0;
  y = 0;
  dist = 0;
  path: PathRoute | null = null;
  progress = 0;
  radius = 0;
  rarity: EnemyRarity = "normal";
  readonly mods: EnemyModId[] = [];
  fireResist = 0;
  coldResist = 0;
  armourMult = 1;
  regenPerSec = 0;
  splitOnDeath = false;
  shield = 0;
  maxShield = 0;
  hasteRadius = 0;
  hasteMult = 1;
  wardRadius = 0;
  wardMult = 1;
  auraSpeed = 1;
  wardTaken = 1;
  flashLeft = 0;
  sprite: Phaser.GameObjects.Sprite;
  outline: Phaser.GameObjects.Arc;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  shieldFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.sprite(0, 0, "wretch").setVisible(false).setDepth(5);
    this.outline = scene.add.circle(0, 0, 12, 0, 0).setStrokeStyle(2, Palette.gold).setVisible(false).setDepth(4);
    this.hpBg = scene.add.rectangle(0, 0, 20, 3, 0x1a1212, 1).setVisible(false).setDepth(6);
    this.hpFill = scene.add.rectangle(0, 0, 20, 3, 0x6e1a1a, 1).setVisible(false).setDepth(7);
    this.shieldFill = scene.add.rectangle(0, 0, 20, 2, Palette.cold, 1).setVisible(false).setDepth(7);
  }

  reset(
    def: EnemyDef,
    opts?: {
      hpMult?: number;
      speedMult?: number;
      goldMult?: number;
      rarity?: EnemyRarity;
      mods?: readonly EnemyModId[];
      startDist?: number;
      path: PathRoute;
    },
  ): void {
    this.alive = true;
    this.def = def;
    this.maxHp = Math.max(1, Math.round(def.maxHp * (opts?.hpMult ?? 1)));
    this.hp = this.maxHp;
    this.speedMult = opts?.speedMult ?? 1;
    this.goldMult = opts?.goldMult ?? 1;
    this.dist = opts?.startDist ?? 0;
    this.path = opts?.path ?? null;
    this.progress = 0;
    this.radius = def.radius;
    this.rarity = opts?.rarity ?? "normal";
    this.mods.length = 0;
    const incoming = opts?.mods;
    if (incoming) {
      for (let i = 0; i < incoming.length; i++) {
        const id = incoming[i];
        if (id) this.mods.push(id);
      }
    }
    const resolved = this.mods.length > 0 ? resolveEnemyMods(this.mods) : IDENTITY_ENEMY_MODS;
    this.speedMult *= resolved.speedMult;
    this.fireResist = resolved.fireResist;
    this.coldResist = resolved.coldResist;
    this.armourMult = resolved.armourMult;
    this.regenPerSec = resolved.regenPerSec;
    this.splitOnDeath = resolved.splitOnDeath;
    this.maxShield = Math.round(this.maxHp * resolved.shieldFrac);
    this.shield = this.maxShield;
    this.hasteRadius = resolved.hasteRadius;
    this.hasteMult = resolved.hasteMult;
    this.wardRadius = resolved.wardRadius;
    this.wardMult = resolved.wardMult;
    this.auraSpeed = 1;
    this.wardTaken = 1;
    this.flashLeft = 0;
    applySprite(this.sprite, def.sprite, def.display);
    this.sprite.setVisible(true).setActive(true);
    this.applyRarityTint();
    playSpriteAnim(this.sprite, def.walkAnim, false);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
    this.path?.sample(this.dist, scratchSample);
    this.applySample(scratchSample);
    this.syncBars();
    this.syncOutline();
  }

  setDist(dist: number): void {
    this.dist = Math.max(0, dist);
    this.path?.sample(this.dist, scratchSample);
    this.applySample(scratchSample);
    this.syncBars();
    this.syncOutline();
  }

  advance(dtSec: number): boolean {
    const def = this.def;
    if (!def || !this.alive || !this.path) return false;
    this.dist += def.speed * this.speedMult * this.auraSpeed * dtSec;
    if (this.regenPerSec > 0 && this.hp > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenPerSec * this.maxHp * dtSec);
    }
    this.path?.sample(this.dist, scratchSample);
    this.applySample(scratchSample);
    if (this.flashLeft > 0) {
      this.flashLeft -= dtSec;
      if (this.flashLeft <= 0) this.applyRarityTint();
    }
    this.syncBars();
    this.syncOutline();
    return scratchSample.atEnd;
  }

  applyDamage(amount: number, convertToCold = 0): boolean {
    if (!this.alive) return false;
    const coldFrac = Math.max(0, Math.min(1, convertToCold));
    let fire = amount * (1 - coldFrac);
    let cold = amount * coldFrac;
    const takenMul = this.armourMult * this.wardTaken;
    fire *= (1 - this.fireResist) * takenMul;
    cold *= (1 - this.coldResist) * takenMul;
    let taken = fire + cold;
    if (this.shield > 0) {
      const absorb = Math.min(this.shield, taken);
      this.shield -= absorb;
      taken -= absorb;
    }
    this.hp -= taken;
    this.flashLeft = 0.08;
    this.sprite.setTintFill(0xffffff);
    this.syncBars();
    return this.hp <= 0;
  }

  release(): void {
    this.alive = false;
    this.def = null;
    this.mods.length = 0;
    this.splitOnDeath = false;
    this.path = null;
    this.flashLeft = 0;
    this.sprite.anims.stop();
    this.sprite.setVisible(false).setActive(false).clearTint();
    this.outline.setVisible(false);
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.shieldFill.setVisible(false);
  }

  private applyRarityTint(): void {
    this.sprite.clearTint();
    if (this.rarity === "magic") this.sprite.setTint(0xa8c8e0);
    else if (this.rarity === "rare") this.sprite.setTint(0xffc080);
    else if (this.rarity === "unique") this.sprite.setTint(0xffe08a);
  }

  private applySample(sample: PathSample): void {
    this.x = sample.x;
    this.y = sample.y;
    this.progress = sample.progress;
    this.sprite.setPosition(this.x, this.y);
  }

  private syncOutline(): void {
    if (!this.alive || this.rarity === "normal") {
      this.outline.setVisible(false);
      return;
    }
    const color =
      this.rarity === "magic" ? Palette.coldBright : this.rarity === "rare" ? Palette.emberHot : Palette.goldBright;
    const width = this.rarity === "magic" ? 2 : 3;
    this.outline
      .setVisible(true)
      .setPosition(this.x, this.y)
      .setRadius(this.radius + 5)
      .setStrokeStyle(width, color, 0.95);
  }

  private syncBars(): void {
    const def = this.def;
    if (!def) return;
    const width = def.radius * 2;
    const y = this.y - def.radius - 6;
    this.hpBg.setPosition(this.x, y).setSize(width, 3);
    const ratio = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
    const fill = Math.max(0.0001, width * ratio);
    this.hpFill.setPosition(this.x - (width - fill) * 0.5, y).setSize(fill, 3);
    this.hpBg.setVisible(ratio < 1 || this.shield > 0);
    this.hpFill.setVisible(ratio < 1 && ratio > 0);
    if (this.maxShield > 0 && this.shield > 0) {
      const sFill = Math.max(0.0001, width * (this.shield / this.maxShield));
      this.shieldFill
        .setVisible(true)
        .setPosition(this.x - (width - sFill) * 0.5, y - 3)
        .setSize(sFill, 2);
    } else {
      this.shieldFill.setVisible(false);
    }
  }
}

const scratchSample: PathSample = {
  x: 0,
  y: 0,
  waypoint: 0,
  distOnSeg: 0,
  atEnd: false,
  progress: 0,
};

export function tickEnemyAuras(enemies: Enemy[]): void {
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e) {
      e.auraSpeed = 1;
      e.wardTaken = 1;
    }
  }
  for (let i = 0; i < enemies.length; i++) {
    const src = enemies[i];
    if (!src || !src.alive) continue;
    const hasteR = src.hasteRadius;
    const wardR = src.wardRadius;
    if (hasteR <= 0 && wardR <= 0) continue;
    const hasteR2 = hasteR * hasteR;
    const wardR2 = wardR * wardR;
    for (let j = 0; j < enemies.length; j++) {
      if (i === j) continue;
      const other = enemies[j];
      if (!other || !other.alive) continue;
      const dx = other.x - src.x;
      const dy = other.y - src.y;
      const d2 = dx * dx + dy * dy;
      if (hasteR > 0 && d2 <= hasteR2 && src.hasteMult > other.auraSpeed) other.auraSpeed = src.hasteMult;
      if (wardR > 0 && d2 <= wardR2) other.wardTaken = Math.min(other.wardTaken, src.wardMult);
    }
  }
}

export class EnemyPool {
  private readonly free: Enemy[] = [];
  readonly active: Enemy[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    prewarm: number,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(new Enemy(scene));
  }

  spawn(
    def: EnemyDef,
    opts?: {
      hpMult?: number;
      speedMult?: number;
      goldMult?: number;
      rarity?: EnemyRarity;
      mods?: readonly EnemyModId[];
      startDist?: number;
      path: PathRoute;
    },
  ): Enemy {
    const enemy = this.free.pop() ?? new Enemy(this.scene);
    enemy.reset(def, opts);
    this.active.push(enemy);
    return enemy;
  }

  releaseAt(index: number): void {
    const enemy = this.active[index];
    if (!enemy) return;
    const last = this.active.length - 1;
    this.active[index] = this.active[last]!;
    this.active.pop();
    enemy.release();
    this.free.push(enemy);
  }

  releaseAll(): void {
    for (let i = this.active.length - 1; i >= 0; i--) this.releaseAt(i);
  }

  get livingCount(): number {
    return this.active.length;
  }
}
