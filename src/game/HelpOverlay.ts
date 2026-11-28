import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { Palette } from "../palette";
import { UiButton } from "./UiButton";
import { FONT_BODY, FONT_TITLE, setTreeInput, type UiRect } from "./ui";

const HELP_KEY = "tower-forge-help-seen";
const CARD_W = 640;
const CARD_H = 460;
const BTN_W = 280;
const BTN_H = 88;

export class HelpOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dismissBtn: UiButton;
  private readonly dismissRectValue: UiRect;

  constructor(
    scene: Phaser.Scene,
    private readonly onDismissCb: () => void,
    page: "bastion" | "battle" | "menu" = "battle",
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.82).setOrigin(0, 0).setInteractive();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const card = scene.add.rectangle(cx, cy, CARD_W, CARD_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.goldDim);
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
              "Enter Breach opens the Ember Atlas — a small map of roads. Clear a node to unlock the ones beside it.",
            ]
          : page === "bastion"
            ? [
                "Prepare — Socket what you have unlocked into a frame loadout. Every tower of that type uses this loadout in battle.",
                "Breach — Enter Breach opens the Ember Atlas. Pick an unlocked node, then hold the gate. In battle you can swap only the main Sigil.",
                "Hold the gate — After a win or loss, return to the Bastion or the main menu. New systems open as you clear Depths.",
              ]
            : [
                "Build — Pick a frame from the bar. Glowing cells can hold it; a ghost shows its reach. Tap to place, or Cancel / Esc to back out. On a phone, confirm the cell so it is not dropped by accident. A new frame starts with a starter Sigil and uses your Bastion loadout.",
                "Sigil — Tap a placed frame for a short panel: change the Sigil from your bag, or sell the frame for some of its gold. Bought Sigils from the Peddler go to your bag.",
                "Hold the gate — Tap Start Wave. Between waves the Ashen Peddler sells gems for gold. After a win or loss, return to the Bastion or the main menu.",
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

    const btnY = cy + CARD_H / 2 - 28 - BTN_H;
    this.dismissBtn = new UiButton(scene, {
      x: cx - BTN_W / 2,
      y: btnY,
      w: BTN_W,
      h: BTN_H,
      label: "GOT IT",
      style: "emph",
      depth: 61,
      onClick: () => this.dismiss(),
    });
    this.dismissRectValue = this.dismissBtn.rect;
    this.root = scene.add
      .container(0, 0, [dim, card, title, body, this.dismissBtn.root])
      .setDepth(60)
      .setVisible(false);
    this.dismissBtn.setVisible(false);
    setTreeInput(this.root, false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  dismissRect(): UiRect {
    return this.dismissRectValue;
  }

  show(): void {
    this.root.setVisible(true);
    this.dismissBtn.setVisible(true);
    setTreeInput(this.root, true);
  }

  hide(): void {
    this.root.setVisible(false);
    this.dismissBtn.setVisible(false);
    setTreeInput(this.root, false);
  }

  shouldShow(): boolean {
    try {
      return window.localStorage.getItem(HELP_KEY) !== "1";
    } catch {
      return true;
    }
  }

  handleTap(_worldX: number, _worldY: number): void {
    // The GOT IT button handles its own pointerup.
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
