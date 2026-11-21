import Phaser from "phaser";
import type { EnemyDef } from "../data/enemies";
import { PATH, type PathSample } from "./path";

export class Enemy {
  alive = false;
  def: EnemyDef | null = null;
  hp = 0;
  x = 0;
  y = 0;
  dist = 0;
  progress = 0;
  radius = 0;
  rarity: "normal" | "magic" | "rare" | "unique" = "normal";
  sprite: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, "wretch").setVisible(false).setDepth(5);
    this.hpBg = scene.add.rectangle(0, 0, 20, 3, 0x1a1212, 1).setVisible(false).setDepth(6);
    this.hpFill = scene.add.rectangle(0, 0, 20, 3, 0x6e1a1a, 1).setVisible(false).setDepth(7);
  }

  reset(def: EnemyDef): void {
    this.alive = true;
    this.def = def;
    this.hp = def.maxHp;
    this.dist = 0;
    this.progress = 0;
    this.radius = def.radius;
    this.rarity = "normal";
    this.sprite.setTexture(def.id).setVisible(true).setActive(true);
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);
    PATH.sample(0, scratchSample);
    this.applySample(scratchSample);
    this.syncBars();
  }

  advance(dtSec: number): boolean {
    const def = this.def;
    if (!def || !this.alive) return false;
    this.dist += def.speed * dtSec;
    PATH.sample(this.dist, scratchSample);
    this.applySample(scratchSample);
    this.syncBars();
    return scratchSample.atEnd;
  }

  applyDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    this.syncBars();
    return this.hp <= 0;
  }

  release(): void {
    this.alive = false;
    this.def = null;
    this.sprite.setVisible(false).setActive(false);
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
  }

  private applySample(sample: PathSample): void {
    this.x = sample.x;
    this.y = sample.y;
    this.progress = sample.progress;
    this.sprite.setPosition(this.x, this.y);
  }

  private syncBars(): void {
    const def = this.def;
    if (!def) return;
    const width = def.radius * 2;
    const y = this.y - def.radius - 6;
    this.hpBg.setPosition(this.x, y).setSize(width, 3);
    const ratio = def.maxHp > 0 ? Math.max(0, this.hp / def.maxHp) : 0;
    const fill = Math.max(0.0001, width * ratio);
    this.hpFill.setPosition(this.x - (width - fill) * 0.5, y).setSize(fill, 3);
    this.hpBg.setVisible(ratio < 1);
    this.hpFill.setVisible(ratio < 1 && ratio > 0);
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

export class EnemyPool {
  private readonly free: Enemy[] = [];
  readonly active: Enemy[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    prewarm: number,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(new Enemy(scene));
  }

  spawn(def: EnemyDef): Enemy {
    const enemy = this.free.pop() ?? new Enemy(this.scene);
    enemy.reset(def);
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
