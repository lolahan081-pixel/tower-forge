import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_TITLE, type UiRect } from "./ui";

const CARD_W = 640;
const CARD_H = 380;
const BTN_W = 240;

export class ConfirmDialog {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  readonly cancelRect: UiRect;
  readonly confirmRect: UiRect;
  private onConfirm: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const btnY = cy + CARD_H / 2 - 28 - BTN_H / 2;
    const gap = 24;
    const cancelX = cx - gap / 2 - BTN_W;
    const confirmX = cx + gap / 2;
    this.cancelRect = { x: cancelX, y: btnY - BTN_H / 2, w: BTN_W, h: BTN_H };
    this.confirmRect = { x: confirmX, y: btnY - BTN_H / 2, w: BTN_W, h: BTN_H };

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.82).setOrigin(0, 0);
    const card = scene.add.rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.goldDim);
    this.title = scene.add
      .text(cx, cy - CARD_H / 2 + 36, "", { font: FONT_TITLE, color: "#e8c547", align: "center", wordWrap: { width: CARD_W - 64 } })
      .setOrigin(0.5, 0);
    this.body = scene.add
      .text(cx, cy - 50, "", { font: FONT_BODY, color: "#e8e0d4", align: "center", wordWrap: { width: CARD_W - 72 }, lineSpacing: 6 })
      .setOrigin(0.5, 0);
    const cancel = scene.add.rectangle(cancelX + BTN_W / 2, btnY, BTN_W, BTN_H, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight);
    const cancelLabel = scene.add.text(cancelX + BTN_W / 2, btnY, "CANCEL", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5);
    const confirm = scene.add.rectangle(confirmX + BTN_W / 2, btnY, BTN_W, BTN_H, 0x3a1a1a, 1).setStrokeStyle(2, Palette.danger);
    const confirmLabel = scene.add.text(confirmX + BTN_W / 2, btnY, "RESET", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5);
    this.root = scene.add
      .container(0, 0, [dim, card, this.title, this.body, cancel, cancelLabel, confirm, confirmLabel])
      .setDepth(85)
      .setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(title: string, body: string, onConfirm: () => void): void {
    this.title.setText(title);
    this.body.setText(body);
    this.onConfirm = onConfirm;
    this.root.setVisible(true);
  }

  hide(): void {
    this.onConfirm = null;
    this.root.setVisible(false);
  }

  handleTap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (containsRect(this.cancelRect, x, y)) {
      this.hide();
      return true;
    }
    if (containsRect(this.confirmRect, x, y)) {
      const fn = this.onConfirm;
      this.hide();
      if (fn) fn();
    }
    return true;
  }
}
