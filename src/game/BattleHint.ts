import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { UiButton } from "./UiButton";
import { BTN_H, FONT_BODY, FONT_TITLE, setTreeInput, type UiRect } from "./ui";

const CARD_W = 640;
const CARD_H = 380;
const BTN_W = 240;

/** Short first-run coach card shown in the opening Breach. */
export class BattleHint {
  private readonly root: Phaser.GameObjects.Container;
  private readonly ok: UiButton;
  readonly okRect: UiRect;

  constructor(
    scene: Phaser.Scene,
    private readonly onDismiss: () => void,
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.72).setOrigin(0, 0).setInteractive();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 20;
    const card = scene.add.rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.gold);
    const title = scene.add.text(cx, cy - CARD_H / 2 + 32, "Hold the gate", { font: FONT_TITLE, color: "#e8c547" }).setOrigin(0.5, 0);
    const body = scene.add
      .text(
        cx,
        cy - 50,
        "Pick a frame from the bar below. Glowing cells can hold it, and a ghost shows how far it can reach. Tap a cell to place it, or Cancel to back out.\n\nOn a phone, confirm the cell so it is not dropped by accident. Tap a placed frame to change its Sigil or sell it, then start the wave.",
        { font: FONT_BODY, color: "#e8e0d4", align: "center", wordWrap: { width: CARD_W - 72 }, lineSpacing: 5 },
      )
      .setOrigin(0.5, 0);
    const btnY = cy + CARD_H / 2 - 28 - BTN_H;
    this.ok = new UiButton(scene, {
      x: cx - BTN_W / 2,
      y: btnY,
      w: BTN_W,
      h: BTN_H,
      label: "OK",
      style: "emph",
      depth: 56,
      onClick: () => {
        this.hide();
        this.onDismiss();
      },
    });
    this.okRect = this.ok.rect;
    this.root = scene.add.container(0, 0, [dim, card, title, body, this.ok.root]).setDepth(55).setVisible(false);
    this.ok.setVisible(false);
    setTreeInput(this.root, false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    this.root.setVisible(true);
    this.ok.setVisible(true);
    setTreeInput(this.root, true);
  }

  hide(): void {
    this.root.setVisible(false);
    this.ok.setVisible(false);
    setTreeInput(this.root, false);
  }

  handleTap(_x: number, _y: number): boolean {
    return this.root.visible;
  }
}
