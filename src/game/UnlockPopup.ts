import Phaser from "phaser";
import type { FeatureDef } from "../data/unlocks";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_TITLE, type UiRect } from "./ui";

const CARD_W = 620;
const CARD_H = 360;
const BTN_W = 240;

/** One-time feature unlock card with a single OK button. */
export class UnlockPopup {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  readonly okRect: UiRect;
  private current: FeatureDef | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly onAccepted: (id: string) => void,
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.82).setOrigin(0, 0);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const card = scene.add.rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.gold);
    this.title = scene.add
      .text(cx, cy - CARD_H / 2 + 36, "", { font: FONT_TITLE, color: "#e8c547", align: "center", wordWrap: { width: CARD_W - 64 } })
      .setOrigin(0.5, 0);
    this.body = scene.add
      .text(cx, cy - 40, "", { font: FONT_BODY, color: "#e8e0d4", align: "center", wordWrap: { width: CARD_W - 72 }, lineSpacing: 6 })
      .setOrigin(0.5, 0);
    const btnY = cy + CARD_H / 2 - 28 - BTN_H / 2;
    const btn = scene.add.rectangle(cx, btnY, BTN_W, BTN_H, 0x2a2014, 1).setStrokeStyle(2, Palette.gold);
    const label = scene.add.text(cx, btnY, "OK", { font: FONT_BTN, color: "#e8c547" }).setOrigin(0.5);
    this.okRect = { x: cx - BTN_W / 2, y: btnY - BTN_H / 2, w: BTN_W, h: BTN_H };
    this.root = scene.add.container(0, 0, [dim, card, this.title, this.body, btn, label]).setDepth(80).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(def: FeatureDef): void {
    this.current = def;
    this.title.setText(def.title);
    this.body.setText(def.body);
    this.root.setVisible(true);
  }

  hide(): void {
    this.current = null;
    this.root.setVisible(false);
  }

  handleTap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (containsRect(this.okRect, x, y) && this.current) {
      const id = this.current.id;
      this.hide();
      this.onAccepted(id);
    }
    return true;
  }
}
