import Phaser from "phaser";
import { playSpriteAnim } from "../game/sprites";

const DEFAULT_LIFE = 0.28;

class FxSprite {
  alive = false;
  life = 0;
  sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.sprite(0, 0, "gem-chip").setVisible(false).setDepth(10);
  }

  reset(x: number, y: number, anim: string, size: number, apply: (image: Phaser.GameObjects.Sprite, key: string, size: number) => void): void {
    this.alive = true;
    this.life = DEFAULT_LIFE;
    this.sprite.setVisible(true).setActive(true).setPosition(x, y).setAlpha(1).clearTint();
    apply(this.sprite, `${anim}-0`, size);
    playSpriteAnim(this.sprite, anim, false);
  }

  step(dtSec: number): boolean {
    if (!this.alive) return false;
    this.life -= dtSec;
    const playing = this.sprite.anims.isPlaying;
    if (this.life <= 0 && !playing) {
      this.release();
      return true;
    }
    if (this.life <= 0 && playing) this.life = 0.05;
    return false;
  }

  release(): void {
    this.alive = false;
    this.sprite.anims.stop();
    this.sprite.setVisible(false).setActive(false).setAlpha(1).clearTint();
  }
}

/** Short-lived impact and death puffs. One-shot anims, no tweens. */
export class FxPool {
  private readonly free: FxSprite[] = [];
  readonly active: FxSprite[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly apply: (image: Phaser.GameObjects.Sprite, key: string, size: number) => void,
    prewarm: number,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(new FxSprite(scene));
  }

  spawn(x: number, y: number, anim: string, size = 16): void {
    if (!this.scene.anims.exists(anim)) return;
    const fx = this.free.pop() ?? new FxSprite(this.scene);
    fx.reset(x, y, anim, size, this.apply);
    this.active.push(fx);
  }

  step(dtSec: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      if (fx && fx.step(dtSec)) {
        const last = this.active.length - 1;
        this.active[i] = this.active[last]!;
        this.active.pop();
        this.free.push(fx);
      }
    }
  }

  releaseAll(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      if (!fx) continue;
      fx.release();
      this.free.push(fx);
      this.active.pop();
    }
  }
}
