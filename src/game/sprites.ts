import Phaser from "phaser";
import { ATLAS_KEY, SPRITE_ANIMS } from "../data/sprites";

export type AtlasImage = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

export function hasAtlasFrame(scene: Phaser.Scene, frame: string): boolean {
  return scene.textures.exists(ATLAS_KEY) && scene.textures.get(ATLAS_KEY).has(frame);
}

/** Prefer an atlas frame, then a baked fallback texture, then gem-chip. */
export function applySprite(image: AtlasImage, key: string, display?: number): void {
  const scene = image.scene;
  if (hasAtlasFrame(scene, key)) image.setTexture(ATLAS_KEY, key);
  else if (scene.textures.exists(key)) image.setTexture(key);
  else image.setTexture("gem-chip");
  if (display !== undefined) image.setDisplaySize(display, display);
}

export function setIcon(image: AtlasImage, key: string, tintFallback?: number, size = 16): void {
  const scene = image.scene;
  if (hasAtlasFrame(scene, key) || scene.textures.exists(key)) {
    applySprite(image, key, size);
    image.clearTint();
    return;
  }
  image.setTexture("gem-chip").setDisplaySize(size, size);
  if (tintFallback !== undefined) image.setTint(tintFallback);
  else image.clearTint();
}

export function addIcon(scene: Phaser.Scene, x: number, y: number, key = "gem-chip", size = 16): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, "gem-chip");
  setIcon(image, key, undefined, size);
  return image;
}

export function registerSpriteAnims(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ATLAS_KEY)) return;
  const atlas = scene.textures.get(ATLAS_KEY);
  for (const def of SPRITE_ANIMS) {
    if (scene.anims.exists(def.key)) continue;
    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    let ok = true;
    for (let i = 0; i < def.frames; i++) {
      const frame = `${def.prefix}${i}`;
      if (!atlas.has(frame)) {
        ok = false;
        break;
      }
      frames.push({ key: ATLAS_KEY, frame });
    }
    if (!ok || frames.length === 0) continue;
    scene.anims.create({ key: def.key, frames, frameRate: def.frameRate, repeat: def.repeat });
  }
}

export function playSpriteAnim(image: Phaser.GameObjects.Sprite, key: string | undefined, ignoreIfPlaying = true): void {
  if (!key || !image.scene.anims.exists(key)) return;
  image.play(key, ignoreIfPlaying);
}

export function hookAttackIdle(image: Phaser.GameObjects.Sprite): void {
  image.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
    if (!anim.key.endsWith("-attack") || !image.active) return;
    const idle = `${anim.key.slice(0, -7)}idle`;
    if (image.scene.anims.exists(idle)) image.play(idle, true);
  });
}
