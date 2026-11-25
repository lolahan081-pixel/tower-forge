import Phaser from "phaser";
import { Palette } from "../palette";
import { FONT_BTN, type UiRect } from "./ui";

export type UiButtonStyle = "normal" | "emph" | "danger";

export type UiButtonOpts = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  style?: UiButtonStyle;
  depth?: number;
  font?: string;
  onClick: () => void;
};

/**
 * One interactive container covering the full label, with hover and press
 * feedback. Actions fire on pointerup inside the button so a scene swap is
 * not started mid-pointerdown.
 */
export class UiButton {
  readonly rect: UiRect;
  readonly root: Phaser.GameObjects.Container;
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  private readonly style: UiButtonStyle;
  private enabled = true;
  private hover = false;
  private pressed = false;
  private onClick: () => void;

  constructor(scene: Phaser.Scene, opts: UiButtonOpts) {
    this.rect = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
    this.style = opts.style ?? "normal";
    this.onClick = opts.onClick;
    const depth = opts.depth ?? 8;
    this.root = scene.add.container(opts.x, opts.y).setDepth(depth);
    this.root.setSize(opts.w, opts.h);
    this.root.setInteractive(new Phaser.Geom.Rectangle(0, 0, opts.w, opts.h), Phaser.Geom.Rectangle.Contains);
    if (this.root.input) this.root.input.cursor = "pointer";
    this.box = scene.add
      .rectangle(opts.w / 2, opts.h / 2, opts.w, opts.h, this.idleFill(), 1)
      .setStrokeStyle(2, this.idleStroke());
    this.label = scene.add
      .text(opts.w / 2, opts.h / 2, opts.label, { font: opts.font ?? FONT_BTN, color: this.idleColor() })
      .setOrigin(0.5);
    this.root.add([this.box, this.label]);

    this.root.on("pointerover", () => {
      this.hover = true;
      this.paint();
    });
    this.root.on("pointerout", () => {
      this.hover = false;
      this.pressed = false;
      this.paint();
    });
    this.root.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled || pointer.rightButtonDown()) return;
      this.pressed = true;
      this.paint();
    });
    this.root.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled || pointer.rightButtonDown()) return;
      const fire = this.pressed;
      this.pressed = false;
      this.paint();
      if (fire) this.onClick();
    });
    this.paint();
  }

  setLabel(text: string): void {
    this.label.setText(text);
  }

  setHandler(onClick: () => void): void {
    this.onClick = onClick;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.root.input) this.root.input.enabled = enabled;
    if (this.root.input) this.root.input.cursor = enabled ? "pointer" : "default";
    if (!enabled) {
      this.hover = false;
      this.pressed = false;
    }
    this.paint();
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
    if (this.root.input) this.root.input.enabled = visible && this.enabled;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  private idleFill(): number {
    if (this.style === "emph") return 0x2a2014;
    if (this.style === "danger") return 0x3a1a1a;
    return 0x1a161c;
  }

  private idleStroke(): number {
    if (this.style === "emph") return Palette.gold;
    if (this.style === "danger") return Palette.danger;
    return Palette.stoneLight;
  }

  private idleColor(): string {
    return this.style === "emph" ? "#e8c547" : "#e8e0d4";
  }

  private paint(): void {
    if (!this.enabled) {
      this.box.setFillStyle(0x141216, 1).setStrokeStyle(2, Palette.stone);
      this.label.setColor("#8a8490");
      return;
    }
    if (this.pressed) {
      this.box.setFillStyle(this.style === "danger" ? 0x541c1c : 0x3a2a18, 1).setStrokeStyle(3, Palette.goldBright);
      this.label.setColor("#e8c547");
      return;
    }
    if (this.hover) {
      this.box.setFillStyle(this.idleFill(), 1).setStrokeStyle(3, Palette.gold);
      this.label.setColor(this.style === "normal" ? "#e8e0d4" : "#e8c547");
      return;
    }
    this.box.setFillStyle(this.idleFill(), 1).setStrokeStyle(2, this.idleStroke());
    this.label.setColor(this.idleColor());
  }
}
