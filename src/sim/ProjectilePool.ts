import Phaser from "phaser";
import type { Enemy } from "./EnemyPool";

const HIT_PAD = 4;

export class Projectile {
  alive = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  damage = 0;
  speed = 0;
  life = 0;
  target: Enemy | null = null;
  sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, "ember-bolt").setVisible(false).setDepth(8);
  }

  reset(x: number, y: number, target: Enemy, damage: number, speed: number): void {
    this.alive = true;
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.speed = speed;
    this.life = 1.6;
    this.target = target;
    this.aimAt(target.x, target.y);
    this.sprite.setVisible(true).setActive(true).setPosition(x, y).setRotation(Math.atan2(this.vy, this.vx));
  }

  /** @returns true if this frame should apply damage to `target` (still set). */
  step(dtSec: number): boolean {
    if (!this.alive) return false;
    this.life -= dtSec;
    const target = this.target;
    if (target && target.alive) {
      this.aimAt(target.x, target.y);
    }
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.sprite.setPosition(this.x, this.y).setRotation(Math.atan2(this.vy, this.vx));
    if (this.life <= 0) {
      this.release();
      return false;
    }
    if (target && target.alive) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const reach = target.radius + HIT_PAD;
      if (dx * dx + dy * dy <= reach * reach) return true;
    }
    return false;
  }

  release(): void {
    this.alive = false;
    this.target = null;
    this.sprite.setVisible(false).setActive(false);
  }

  private aimAt(tx: number, ty: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.0001) {
      this.vx = this.speed;
      this.vy = 0;
      return;
    }
    this.vx = (dx / len) * this.speed;
    this.vy = (dy / len) * this.speed;
  }
}

export class ProjectilePool {
  private readonly free: Projectile[] = [];
  readonly active: Projectile[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    prewarm: number,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(new Projectile(scene));
  }

  spawn(x: number, y: number, target: Enemy, damage: number, speed: number): Projectile {
    const proj = this.free.pop() ?? new Projectile(this.scene);
    proj.reset(x, y, target, damage, speed);
    this.active.push(proj);
    return proj;
  }

  releaseAt(index: number): void {
    const proj = this.active[index];
    if (!proj) return;
    const last = this.active.length - 1;
    this.active[index] = this.active[last]!;
    this.active.pop();
    proj.release();
    this.free.push(proj);
  }
}

export class Beam {
  alive = false;
  life = 0;
  maxLife = 0.12;
  sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, "blood-beam").setVisible(false).setDepth(8);
  }

  reset(x1: number, y1: number, x2: number, y2: number): void {
    this.alive = true;
    this.life = this.maxLife;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    this.sprite
      .setVisible(true)
      .setActive(true)
      .setPosition((x1 + x2) * 0.5, (y1 + y2) * 0.5)
      .setRotation(Math.atan2(dy, dx))
      .setDisplaySize(Math.max(8, len), 3)
      .setAlpha(1);
  }

  step(dtSec: number): boolean {
    if (!this.alive) return false;
    this.life -= dtSec;
    this.sprite.setAlpha(Math.max(0, this.life / this.maxLife));
    if (this.life <= 0) {
      this.release();
      return true;
    }
    return false;
  }

  release(): void {
    this.alive = false;
    this.sprite.setVisible(false).setActive(false).setAlpha(1);
  }
}

export class BeamPool {
  private readonly free: Beam[] = [];
  readonly active: Beam[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    prewarm: number,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(new Beam(scene));
  }

  spawn(x1: number, y1: number, x2: number, y2: number): void {
    const beam = this.free.pop() ?? new Beam(this.scene);
    beam.reset(x1, y1, x2, y2);
    this.active.push(beam);
  }

  step(dtSec: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const beam = this.active[i];
      if (beam && beam.step(dtSec)) {
        const last = this.active.length - 1;
        this.active[i] = this.active[last]!;
        this.active.pop();
        this.free.push(beam);
      }
    }
  }
}
