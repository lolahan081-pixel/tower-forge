import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { UiButton } from "./UiButton";
import { BTN_H, FONT_BODY, FONT_TITLE, setTreeInput, type UiRect } from "./ui";

const CARD_W = 640;
const CARD_H = 380;
const BTN_W = 240;

export class ConfirmDialog {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly cancel: UiButton;
  private readonly confirm: UiButton;
  readonly cancelRect: UiRect;
  readonly confirmRect: UiRect;
  private onConfirm: (() => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const btnY = cy + CARD_H / 2 - 28 - BTN_H;
    const gap = 24;
    const cancelX = cx - gap / 2 - BTN_W;
    const confirmX = cx + gap / 2;

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.82).setOrigin(0, 0).setInteractive();
    const card = scene.add.rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.goldDim);
    this.title = scene.add
      .text(cx, cy - CARD_H / 2 + 36, "", { font: FONT_TITLE, color: "#e8c547", align: "center", wordWrap: { width: CARD_W - 64 } })
      .setOrigin(0.5, 0);
    this.body = scene.add
      .text(cx, cy - 50, "", { font: FONT_BODY, color: "#e8e0d4", align: "center", wordWrap: { width: CARD_W - 72 }, lineSpacing: 6 })
      .setOrigin(0.5, 0);
    this.cancel = new UiButton(scene, {
      x: cancelX,
      y: btnY,
      w: BTN_W,
      h: BTN_H,
      label: "CANCEL",
      style: "normal",
      depth: 86,
      onClick: () => {
        const fn = this.onCancel;
        this.hide();
        if (fn) fn();
      },
    });
    this.confirm = new UiButton(scene, {
      x: confirmX,
      y: btnY,
      w: BTN_W,
      h: BTN_H,
      label: "RESET",
      style: "danger",
      depth: 86,
      onClick: () => {
        const fn = this.onConfirm;
        this.hide();
        if (fn) fn();
      },
    });
    this.cancelRect = this.cancel.rect;
    this.confirmRect = this.confirm.rect;
    this.root = scene.add
      .container(0, 0, [dim, card, this.title, this.body, this.cancel.root, this.confirm.root])
      .setDepth(85)
      .setVisible(false);
    this.cancel.setVisible(false);
    this.confirm.setVisible(false);
    setTreeInput(this.root, false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(title: string, body: string, onConfirm: () => void, onCancel?: () => void): void {
    this.title.setText(title);
    this.body.setText(body);
    this.onConfirm = onConfirm;
    this.onCancel = onCancel ?? null;
    this.root.setVisible(true);
    this.cancel.setVisible(true);
    this.confirm.setVisible(true);
    setTreeInput(this.root, true);
  }

  hide(): void {
    this.onConfirm = null;
    this.onCancel = null;
    this.root.setVisible(false);
    this.cancel.setVisible(false);
    this.confirm.setVisible(false);
    setTreeInput(this.root, false);
  }

  handleTap(_x: number, _y: number): boolean {
    return this.root.visible;
  }
}
