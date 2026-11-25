import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { containsRect, FONT_BODY, FONT_BTN, FONT_TITLE, type UiRect } from "./ui";

const HELP_KEY = "tower-forge-help-seen";
const CARD_W = 640;
const CARD_H = 460;
const BTN_W = 280;
const BTN_H = 88;

export class HelpOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dismissRectValue: UiRect;

  constructor(
    scene: Phaser.Scene,
    private readonly onDismissCb: () => void,
    page: "bastion" | "battle" | "menu" = "battle",
  ) {
    const dim = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.82)
      .setOrigin(0, 0);


    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const card = scene.add
      .rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98)
      .setStrokeStyle(2, Palette.goldDim);

    const title = scene.add
      .text(cx, cy - CARD_H / 2 + 36, "The Ashen Bastion", { font: FONT_TITLE, color: "#e8c547" })
      .setOrigin(0.5, 0);

    const body = scene.add
      .text(
        cx,
        cy - 90,
        (page === "menu"
          ? [
              "Start a Breach from this menu, or open the Bastion to prepare. The first Depth only asks you to place frames and swap a Sigil.",
              "More of the Bastion opens as you clear Depths: Runes, Relics and the Stash, the Ember Forge, then the Ember Lattice.",
              "In battle, tap a stone cell beside the path to build, then tap Start Wave. You can return here from the Bastion or a Breach.",
            ]
          : page === "bastion"
            ? [
                "Prepare — Socket what you have unlocked into a frame loadout. Every tower of that type uses this loadout in battle.",
                "Breach — Enter Breach to hold the gate. Built frames start with a starter Sigil. In battle you can swap only the main Sigil.",
                "Hold the gate — After a win or loss, return to the Bastion or the main menu. New systems open as you clear Depths.",
              ]
            : [
                "Build — Choose a frame, then tap a stone cell beside the path. A new frame starts with a starter Sigil and uses your Bastion loadout.",
                "Sigil — Tap a frame, or Sigil, to swap the main skill gem.",
                "Hold the gate — Tap Start Wave. After a win or loss, return to the Bastion or the main menu.",
              ]
        ).join("\n\n"),
        {
          font: FONT_BODY,
          color: "#e8e0d4",
          align: "left",
          wordWrap: { width: CARD_W - 64 },
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5, 0);

    const btnX = cx;
    const btnY = cy + CARD_H / 2 - 28 - BTN_H / 2;
    const btn = scene.add
      .rectangle(btnX, btnY, BTN_W, BTN_H, 0x2a2014, 1)
      .setStrokeStyle(2, Palette.gold)
      .setInteractive({ useHandCursor: true });
    const btnLabel = scene.add.text(btnX, btnY, "GOT IT", { font: FONT_BTN, color: "#e8c547" }).setOrigin(0.5);

    btn.on("pointerover", () => btn.setStrokeStyle(3, Palette.goldBright));
    btn.on("pointerout", () => btn.setStrokeStyle(2, Palette.gold));

    this.dismissRectValue = { x: btnX - BTN_W / 2, y: btnY - BTN_H / 2, w: BTN_W, h: BTN_H };
    this.root = scene.add.container(0, 0, [dim, card, title, body, btn, btnLabel]).setDepth(60);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  dismissRect(): UiRect {
    return this.dismissRectValue;
  }

  show(): void {
    this.root.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  shouldShow(): boolean {
    try {
      return window.localStorage.getItem(HELP_KEY) !== "1";
    } catch {
      return true;
    }
  }

  handleTap(worldX: number, worldY: number): void {
    if (!this.root.visible) return;
    if (containsRect(this.dismissRectValue, worldX, worldY)) this.dismiss();
  }

  dismiss(): void {
    try {
      window.localStorage.setItem(HELP_KEY, "1");
    } catch {
      // ignore quota / private mode
    }
    this.hide();
    this.onDismissCb();
  }
}
