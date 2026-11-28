/** Shared UI metrics. Buttons are sized so they stay ~44px in screen space on phone landscape (FIT scale ≈ 0.5). */
import Phaser from "phaser";

export type UiRect = { x: number; y: number; w: number; h: number };

export const BTN_H = 88;

/** Battle and main-menu MENU; 96 * iPhone 12 landscape FIT (390/792) ≈ 47px. */
export const MENU_BTN_H = 96;
export const MENU_BTN_W = 168;

export function containsRect(r: UiRect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectCenter(r: UiRect): { x: number; y: number } {
  return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 };
}

export const FONT_HUD = '22px Georgia, "Times New Roman", serif';
export const FONT_BTN = '20px Georgia, "Times New Roman", serif';
export const FONT_BTN_SM = '16px Georgia, "Times New Roman", serif';
export const FONT_TITLE = '28px Georgia, "Times New Roman", serif';
export const FONT_BODY = '18px Georgia, "Times New Roman", serif';

const worldScratch = { x: 0, y: 0 };

/** Camera-space point for this scene. Prefer this over stale pointer.worldX after a resize or scene swap. */
export function pointerWorld(scene: Phaser.Scene, pointer: Phaser.Input.Pointer): { x: number; y: number } {
  pointer.updateWorldPoint(scene.cameras.main);
  const out = pointer.positionToCamera(scene.cameras.main, worldScratch) as { x: number; y: number };
  return out;
}

/**
 * Starting a scene in the same tick as pointerdown leaves Phaser's pointer
 * stuck "down", so the next screen often ignores clicks. Defer one frame.
 */
export function startScene(scene: Phaser.Scene, key: string, data?: object): void {
  scene.tweens.killAll();
  scene.time.delayedCall(0, () => {
    scene.tweens.killAll();
    scene.scene.start(key, data);
  });
}

/** Reset leftover pointer state and keep FIT letterbox bounds in sync with the canvas. */
export function prepareSceneInput(scene: Phaser.Scene): void {
  scene.scale.updateBounds();
  const mgr = scene.input.manager;
  for (let i = 0; i < mgr.pointers.length; i++) {
    const p = mgr.pointers[i];
    if (p) p.reset();
  }
  scene.input.enabled = true;
  const onResize = (): void => {
    scene.scale.updateBounds();
  };
  scene.scale.on("resize", onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off("resize", onResize);
    scene.tweens.killAll();
  });
}

export function setTreeInput(root: Phaser.GameObjects.Container, enabled: boolean): void {
  const apply = (obj: Phaser.GameObjects.GameObject): void => {
    const anyObj = obj as Phaser.GameObjects.GameObject & {
      input?: { enabled: boolean } | null;
      disableInteractive?: () => void;
      list?: Phaser.GameObjects.GameObject[];
    };
    if (anyObj.input) anyObj.input.enabled = enabled;
    if (!enabled && typeof anyObj.disableInteractive === "function" && anyObj.input) {
      // Keep the hit area; just flip enabled so show() can turn it back on.
    }
    const list = anyObj.list;
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const child = list[i];
        if (child) apply(child);
      }
    }
  };
  apply(root);
}

/** Short pop used when a panel opens. Resets position so repeated shows do not drift. */
export function popIn(scene: Phaser.Scene, obj: Phaser.GameObjects.Container, x: number, y: number, dy = 10): void {
  scene.tweens.killTweensOf(obj);
  obj.setPosition(x, y + dy).setAlpha(0);
  scene.tweens.add({ targets: obj, alpha: 1, y, duration: 140, ease: "Cubic.Out" });
}
