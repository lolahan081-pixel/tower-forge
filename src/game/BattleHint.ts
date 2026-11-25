import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_TITLE, type UiRect } from "./ui";

const CARD_W = 640;
const CARD_H = 340;
const BTN_W = 240;

/** Short first-run coach card shown in the opening Breach. */
export class BattleHint {
  private readonly root: Phaser.GameObjects.Container;
  readonly okRect: UiRect;

  constructor(
    scene: Phaser.Scene,
    private readonly onDismiss: () => void,
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.72).setOrigin(0, 0);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 20;
    const card = scene.add.rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.gold);
    const title = scene.add.text(cx, cy - CARD_H / 2 + 32, "Hold the gate", { font: FONT_TITLE, color: "#e8c547" }).setOrigin(0.5, 0);
    const body = scene.add
      .text(
        cx,
        cy - 50,
        "Tap a stone cell beside the path to place a frame. It starts with a Sigil and will fire on its own.\n\nThen tap Start Wave to send the Hollow down the path.",
        { font: FONT_BODY, color: "#e8e0d4", align: "center", wordWrap: { width: CARD_W - 72 }, lineSpacing: 5 },
      )
      .setOrigin(0.5, 0);
    const btnY = cy + CARD_H / 2 - 28 - BTN_H / 2;
    const btn = scene.add.rectangle(cx, btnY, BTN_W, BTN_H, 0x2a2014, 1).setStrokeStyle(2, Palette.gold);
    const label = scene.add.text(cx, btnY, "OK", { font: FONT_BTN, color: "#e8c547" }).setOrigin(0.5);
    this.okRect = { x: cx - BTN_W / 2, y: btnY - BTN_H / 2, w: BTN_W, h: BTN_H };
    this.root = scene.add.container(0, 0, [dim, card, title, body, btn, label]).setDepth(55).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    this.root.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  handleTap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (containsRect(this.okRect, x, y)) {
      this.hide();
      this.onDismiss();
    }
    return true;
  }
}
