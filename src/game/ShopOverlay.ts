import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../data/map";
import { getProfile, persistProfile } from "../data/profile";
import type { ShopOffer } from "../data/shop";
import { Palette } from "../palette";
import { gemColor, gemName } from "./gems";
import { UiButton } from "./UiButton";
import { FONT_BTN_SM, FONT_HUD, setTreeInput, type UiRect } from "./ui";

const PANEL_W = 680;
const ROW_H = 72;
const BUY_W = 160;

export type ShopInfo = {
  owned: string;
  equipped: string;
  runesUnlocked: boolean;
};

export class ShopOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly helpText: Phaser.GameObjects.Text;
  private readonly bagText: Phaser.GameObjects.Text;
  private readonly equippedText: Phaser.GameObjects.Text;
  private readonly closeBtn: UiButton;
  readonly closeRect: UiRect;
  private readonly offerRects: UiRect[] = [];
  private readonly offerLabels: Phaser.GameObjects.Text[] = [];
  private readonly offerChips: Phaser.GameObjects.Rectangle[] = [];
  private readonly buyBtns: UiButton[] = [];
  private readonly offerRows: Phaser.GameObjects.Rectangle[] = [];
  private offers: ShopOffer[] = [];
  private gold = 0;
  private info: ShopInfo = { owned: "", equipped: "", runesUnlocked: false };

  constructor(
    scene: Phaser.Scene,
    private readonly getGold: () => number,
    private readonly spend: (amount: number) => boolean,
    private readonly onClose: () => void,
  ) {
    const cx = GAME_WIDTH / 2;
    const cy = (GAME_HEIGHT - HUD_HEIGHT) / 2;
    const panelH = 28 + 36 + 70 + 40 + 4 * (ROW_H + 6) + 88 + 20;
    const top = cy - panelH / 2;
    const children: Phaser.GameObjects.GameObject[] = [];
    children.push(
      scene.add.rectangle(cx, cy, PANEL_W, panelH, Palette.panel, 0.98).setStrokeStyle(2, Palette.goldDim),
    );
    children.push(
      scene.add.text(cx, top + 12, "Ashen Peddler", { font: FONT_HUD, color: "#e8c547" }).setOrigin(0.5, 0),
    );
    this.goldText = scene.add.text(cx, top + 40, "", { font: FONT_BTN_SM, color: "#c9a227" }).setOrigin(0.5, 0);
    children.push(this.goldText);
    this.helpText = scene.add
      .text(cx, top + 64, "", {
        font: FONT_BTN_SM,
        color: "#e8e0d4",
        align: "center",
        wordWrap: { width: PANEL_W - 48 },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    children.push(this.helpText);
    this.bagText = scene.add
      .text(cx, top + 128, "", { font: FONT_BTN_SM, color: "#c9a227", align: "center", wordWrap: { width: PANEL_W - 48 } })
      .setOrigin(0.5, 0);
    this.equippedText = scene.add
      .text(cx, top + 150, "", { font: FONT_BTN_SM, color: "#c9a227", align: "center", wordWrap: { width: PANEL_W - 48 } })
      .setOrigin(0.5, 0);
    children.push(this.bagText, this.equippedText);

    const rowY0 = top + 176;
    const rowW = PANEL_W - 48;
    const rowX = cx - rowW / 2;
    for (let i = 0; i < 4; i++) {
      const y = rowY0 + i * (ROW_H + 6);
      const box = scene.add.rectangle(rowX, y, rowW, ROW_H, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight).setOrigin(0, 0);
      const chip = scene.add.rectangle(rowX + 22, y + ROW_H / 2, 16, 16, Palette.muted, 1);
      const label = scene.add.text(rowX + 40, y + ROW_H / 2, "", { font: FONT_BTN_SM, color: "#e8e0d4" }).setOrigin(0, 0.5);
      const buyX = rowX + rowW - 12 - BUY_W;
      const index = i;
      const buy = new UiButton(scene, {
        x: buyX,
        y: y + 8,
        w: BUY_W,
        h: ROW_H - 16,
        label: "BUY",
        style: "emph",
        depth: 45,
        font: FONT_BTN_SM,
        onClick: () => {
          this.buy(index);
        },
      });
      this.offerRects.push({ x: buyX, y, w: BUY_W, h: ROW_H });
      this.offerLabels.push(label);
      this.offerChips.push(chip);
      this.buyBtns.push(buy);
      this.offerRows.push(box);
      children.push(box, chip, label, buy.root);
    }

    const closeW = 240;
    const closeY = top + panelH - 16 - 88;
    this.closeBtn = new UiButton(scene, {
      x: cx - closeW / 2,
      y: closeY,
      w: closeW,
      h: 88,
      label: "CONTINUE",
      style: "emph",
      depth: 45,
      onClick: () => {
        this.hide();
        this.onClose();
      },
    });
    this.closeRect = this.closeBtn.rect;
    children.push(this.closeBtn.root);

    this.root = scene.add.container(0, 0, children).setDepth(44).setVisible(false);
    this.closeBtn.setVisible(false);
    for (const b of this.buyBtns) b.setVisible(false);
    setTreeInput(this.root, false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  get currentOffers(): ShopOffer[] {
    return this.offers;
  }

  get offerBuyRects(): UiRect[] {
    return this.offerRects;
  }

  show(offers: ShopOffer[], info?: ShopInfo): void {
    this.offers = offers;
    this.gold = this.getGold();
    if (info) this.info = info;
    this.redraw();
    this.root.setVisible(true);
    this.closeBtn.setVisible(true);
    setTreeInput(this.root, true);
  }

  hide(): void {
    this.root.setVisible(false);
    this.closeBtn.setVisible(false);
    for (const b of this.buyBtns) b.setVisible(false);
    setTreeInput(this.root, false);
  }

  handleTap(_x: number, _y: number): boolean {
    return this.root.visible;
  }

  buy(index: number): boolean {
    const offer = this.offers[index];
    if (!offer || offer.sold) return false;
    if (!this.spend(offer.price)) return false;
    const profile = getProfile();
    if (offer.gem.kind === "rune") profile.runeInventory.push(offer.gem);
    else profile.sigilInventory.push(offer.gem);
    persistProfile();
    offer.sold = true;
    this.gold = this.getGold();
    const name = gemName(offer.gem);
    if (offer.gem.kind !== "rune") {
      this.info = {
        ...this.info,
        owned: this.info.owned.includes(name) ? this.info.owned : appendName(this.info.owned, name),
      };
    }
    this.redraw();
    return true;
  }

  private redraw(): void {
    const hasRunes = this.info.runesUnlocked || this.offers.some((o) => o.gem.kind === "rune");
    this.goldText.setText(`Gold  ${this.gold}`);
    this.helpText.setText(
      hasRunes
        ? "A stall between waves. Gold from kills and waves buys level-1 Sigils and basic Runes. Bought Sigils go to your bag — swap them onto a frame with the SIGIL button. Socket Runes in the Bastion."
        : "A stall between waves. Gold from kills and waves buys level-1 Sigils. Bought Sigils go to your bag; swap them onto a frame with the SIGIL button.",
    );
    this.bagText.setText(this.info.owned ? `In your bag:  ${this.info.owned}` : "In your bag:  none yet beyond your starting Sigils.");
    this.equippedText.setText(this.info.equipped ? `On your frames:  ${this.info.equipped}` : "On your frames:  none placed.");
    for (let i = 0; i < 4; i++) {
      const offer = this.offers[i];
      const label = this.offerLabels[i];
      const chip = this.offerChips[i];
      const buy = this.buyBtns[i];
      const row = this.offerRows[i];
      if (!label || !chip || !buy) continue;
      if (!offer) {
        label.setVisible(false);
        chip.setVisible(false);
        buy.setVisible(false);
        row?.setVisible(false);
        continue;
      }
      label.setVisible(true);
      chip.setVisible(true);
      buy.setVisible(true);
      row?.setVisible(true);
      chip.setFillStyle(gemColor(offer.gem), 1);
      const kind = offer.gem.kind === "sigil" ? "Sigil" : "Rune";
      label.setText(`${gemName(offer.gem)}  ·  ${kind} L1`);
      if (offer.sold) {
        buy.setLabel("SOLD");
        buy.setEnabled(false);
      } else if (this.gold < offer.price) {
        buy.setLabel(`${offer.price}g`);
        buy.setEnabled(false);
      } else {
        buy.setLabel(`${offer.price}g`);
        buy.setEnabled(true);
      }
    }
  }
}

function appendName(list: string, name: string): string {
  if (!list) return name;
  return `${list}, ${name}`;
}
