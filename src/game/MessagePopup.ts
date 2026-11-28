import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { UiButton } from "./UiButton";
import { BTN_H, containsRect, FONT_BODY, FONT_TITLE, setTreeInput, type UiRect } from "./ui";

const CARD_W = 640;
const CARD_H = 380;
const BTN_W = 240;

/** Short title + body card with an OK button. Used for unlocks and first-time hints. */
export class MessagePopup {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly ok: UiButton;
  readonly okRect: UiRect;
  private onOk: (() => void) | null = null;
  private readonly sceneRef: Phaser.Scene;
  private lockUntil = 0;

  constructor(scene: Phaser.Scene, depth = 90) {
    this.sceneRef = scene;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.82).setOrigin(0, 0).setInteractive();
    const card = scene.add.rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.gold);
    this.title = scene.add
      .text(cx, cy - CARD_H / 2 + 36, "", {
        font: FONT_TITLE,
        color: "#e8c547",
        align: "center",
        wordWrap: { width: CARD_W - 64 },
      })
      .setOrigin(0.5, 0);
    this.body = scene.add
      .text(cx, cy - 50, "", {
        font: FONT_BODY,
        color: "#e8e0d4",
        align: "center",
        wordWrap: { width: CARD_W - 72 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    const btnY = cy + CARD_H / 2 - 28 - BTN_H;
    this.ok = new UiButton(scene, {
      x: cx - BTN_W / 2,
      y: btnY,
      w: BTN_W,
      h: BTN_H,
      label: "OK",
      style: "emph",
      depth: depth + 1,
      onClick: () => this.accept(),
    });
    this.okRect = this.ok.rect;
    this.root = scene.add
      .container(0, 0, [dim, card, this.title, this.body, this.ok.root])
      .setDepth(depth)
      .setVisible(false);
    this.ok.root.setVisible(false);
    setTreeInput(this.root, false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(title: string, body: string, onOk?: () => void): void {
    this.title.setText(title);
    this.body.setText(body);
    this.onOk = onOk ?? null;
    this.root.setVisible(true);
    this.ok.setVisible(true);
    setTreeInput(this.root, true);
  }

  hide(): void {
    this.onOk = null;
    this.root.setVisible(false);
    this.ok.setVisible(false);
    setTreeInput(this.root, false);
  }

  handleTap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (containsRect(this.okRect, x, y)) this.accept();
    return true;
  }

  private accept(): void {
    if (!this.root.visible) return;
    const now = this.sceneRef.time.now;
    if (now < this.lockUntil) return;
    this.lockUntil = now + 220;
    const fn = this.onOk;
    this.hide();
    if (fn) fn();
  }
}
