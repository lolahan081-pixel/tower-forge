import Phaser from "phaser";
import type { Enemy } from "./EnemyPool";
import { findChainTarget, hasHitEnemy } from "./combat";

const HIT_PAD = 4;
const MAX_HITS = 8;

export class Projectile {
  alive = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  damage = 0;
  convertToCold = 0;
  speed = 0;
  life = 0;
  pierceLeft = 0;
  chainLeft = 0;
  home = false;
  ownerIndex = -1;
  target: Enemy | null = null;
  sprite: Phaser.GameObjects.Image;
  readonly hits: (Enemy | null)[] = [null, null, null, null, null, null, null, null];
  hitCount = 0;
  /** Set by step() when this frame collided; cleared at the start of step. */
  hitEnemy: Enemy | null = null;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, "cinder-orb").setVisible(false).setDepth(8);
  }

  reset(
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    speed: number,
    vx: number,
    vy: number,
    pierce: number,
    chain: number,
    home: boolean,
    texture: string,
    tint: number,
    ownerIndex: number,
    convertToCold = 0,
  ): void {
    this.alive = true;
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.convertToCold = convertToCold;
    this.speed = speed;
    this.vx = vx;
    this.vy = vy;
    this.life = 1.8;
    this.pierceLeft = pierce;
    this.chainLeft = chain;
    this.home = home;
    this.ownerIndex = ownerIndex;
    this.target = target;
    this.hitCount = 0;
    this.hitEnemy = null;
    for (let i = 0; i < MAX_HITS; i++) this.hits[i] = null;
    this.sprite
      .setTexture(texture)
      .setTint(tint)
      .setVisible(true)
      .setActive(true)
      .setPosition(x, y)
      .setDisplaySize(18, 18)
      .setRotation(Math.atan2(vy, vx));
  }

  /** Moves and, if a new enemy was hit this frame, stores it in `hitEnemy`. */
  step(dtSec: number, enemies: Enemy[]): void {
    this.hitEnemy = null;
    if (!this.alive) return;
    this.life -= dtSec;
    if (this.life <= 0) {
      this.release();
      return;
    }

    if (this.home && this.target && this.target.alive && !hasHitEnemy(this.hits, this.hitCount, this.target)) {
      this.aimAt(this.target.x, this.target.y);
    }

    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.sprite.setPosition(this.x, this.y).setRotation(Math.atan2(this.vy, this.vx));

    const hit = this.findCollision(enemies);
    if (!hit) return;
    this.rememberHit(hit);
    this.hitEnemy = hit;

    if (this.pierceLeft > 0) {
      this.pierceLeft -= 1;
      this.home = false;
      this.target = null;
      return;
    }
    if (this.chainLeft > 0) {
      this.chainLeft -= 1;
      const next = findChainTarget(this.x, this.y, enemies, this.hits, this.hitCount);
      if (next) {
        this.target = next;
        this.home = true;
        this.aimAt(next.x, next.y);
        return;
      }
    }
    this.release();
  }

  release(): void {
    this.alive = false;
    this.target = null;
    // Leave hitEnemy and ownerIndex for the scene to resolve this frame's hit.
    this.sprite.setVisible(false).setActive(false).clearTint();
  }

  private findCollision(enemies: Enemy[]): Enemy | null {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.alive) continue;
      if (hasHitEnemy(this.hits, this.hitCount, e)) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const reach = e.radius + HIT_PAD;
      if (dx * dx + dy * dy <= reach * reach) return e;
    }
    return null;
  }

  private rememberHit(enemy: Enemy): void {
    if (this.hitCount >= MAX_HITS) return;
    this.hits[this.hitCount] = enemy;
    this.hitCount += 1;
  }

  private aimAt(tx: number, ty: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.0001) return;
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

  spawn(
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    speed: number,
    vx: number,
    vy: number,
    pierce: number,
    chain: number,
    home: boolean,
    texture: string,
    tint: number,
    ownerIndex: number,
    convertToCold = 0,
  ): Projectile {
    const proj = this.free.pop() ?? new Projectile(this.scene);
    proj.reset(x, y, target, damage, speed, vx, vy, pierce, chain, home, texture, tint, ownerIndex, convertToCold);
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

  reset(x1: number, y1: number, x2: number, y2: number, tint: number, texture: string, life = 0.12): void {
    this.alive = true;
    this.maxLife = life;
    this.life = life;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    this.sprite
      .setTexture(texture)
      .setTint(tint)
      .setVisible(true)
      .setActive(true)
      .setPosition((x1 + x2) * 0.5, (y1 + y2) * 0.5)
      .setRotation(Math.atan2(dy, dx))
      .setDisplaySize(Math.max(8, len), 4)
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
    this.sprite.setVisible(false).setActive(false).setAlpha(1).clearTint();
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

  spawn(x1: number, y1: number, x2: number, y2: number, tint = 0xffffff, texture = "blood-beam", life = 0.12): void {
    const beam = this.free.pop() ?? new Beam(this.scene);
    beam.reset(x1, y1, x2, y2, tint, texture, life);
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

export class NovaPulse {
  alive = false;
  life = 0;
  maxLife = 0.28;
  sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(0, 0, "nova-ring").setVisible(false).setDepth(8);
  }

  reset(x: number, y: number, radius: number, tint: number): void {
    this.alive = true;
    this.life = this.maxLife;
    this.sprite
      .setVisible(true)
      .setActive(true)
      .setPosition(x, y)
      .setTint(tint)
      .setAlpha(0.9)
      .setDisplaySize(radius * 0.4, radius * 0.4);
  }

  step(dtSec: number): boolean {
    if (!this.alive) return false;
    this.life -= dtSec;
    const t = 1 - Math.max(0, this.life / this.maxLife);
    const size = 16 + t * 140;
    this.sprite.setDisplaySize(size, size).setAlpha(Math.max(0, 1 - t));
    if (this.life <= 0) {
      this.release();
      return true;
    }
    return false;
  }

  release(): void {
    this.alive = false;
    this.sprite.setVisible(false).setActive(false).clearTint();
  }
}

export class NovaPool {
  private readonly free: NovaPulse[] = [];
  readonly active: NovaPulse[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    prewarm: number,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(new NovaPulse(scene));
  }

  spawn(x: number, y: number, radius: number, tint: number): void {
    const pulse = this.free.pop() ?? new NovaPulse(this.scene);
    pulse.reset(x, y, radius, tint);
    this.active.push(pulse);
  }

  step(dtSec: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const pulse = this.active[i];
      if (pulse && pulse.step(dtSec)) {
        const last = this.active.length - 1;
        this.active[i] = this.active[last]!;
        this.active.pop();
        this.free.push(pulse);
      }
    }
  }
}
