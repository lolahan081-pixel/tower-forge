import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../data/map";
import { getProfile, persistProfile } from "../data/profile";
import type { ShopOffer } from "../data/shop";
import { Palette } from "../palette";
import { gemColor, gemName } from "./gems";
import { BTN_H, containsRect, FONT_BTN, FONT_BTN_SM, FONT_HUD, type UiRect } from "./ui";

const PANEL_W = 600;
const ROW_H = BTN_H;

export class ShopOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly closeBtn: Phaser.GameObjects.Rectangle;
  readonly closeRect: UiRect;
  private readonly offerRects: UiRect[] = [];
  private readonly offerLabels: Phaser.GameObjects.Text[] = [];
  private readonly offerChips: Phaser.GameObjects.Rectangle[] = [];
  private readonly buyLabels: Phaser.GameObjects.Text[] = [];
  private readonly buyBoxes: Phaser.GameObjects.Rectangle[] = [];
  private readonly offerRows: Phaser.GameObjects.Rectangle[] = [];
  private offers: ShopOffer[] = [];
  private gold = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly getGold: () => number,
    private readonly spend: (amount: number) => boolean,
    private readonly onClose: () => void,
  ) {
    const cx = GAME_WIDTH / 2;
    const cy = (GAME_HEIGHT - HUD_HEIGHT) / 2;
    const panelH = 28 + 40 + 4 * (ROW_H + 8) + BTN_H + 24;
    const top = cy - panelH / 2;
    const children: Phaser.GameObjects.GameObject[] = [];
    children.push(
      scene.add.rectangle(cx, cy, PANEL_W, panelH, Palette.panel, 0.98).setStrokeStyle(2, Palette.goldDim),
    );
    children.push(
      scene.add.text(cx, top + 16, "Ashen Peddler", { font: FONT_HUD, color: "#e8c547" }).setOrigin(0.5, 0),
    );
    this.goldText = scene.add.text(cx, top + 46, "", { font: FONT_BTN_SM, color: "#c9a227" }).setOrigin(0.5, 0);
    children.push(this.goldText);

    const rowY0 = top + 78;
    const rowW = PANEL_W - 48;
    const rowX = cx - rowW / 2;
    for (let i = 0; i < 4; i++) {
      const y = rowY0 + i * (ROW_H + 8);
      const box = scene.add.rectangle(rowX, y, rowW, ROW_H, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight).setOrigin(0, 0);
      const chip = scene.add.rectangle(rowX + 22, y + ROW_H / 2, 16, 16, Palette.muted, 1);
      const label = scene.add.text(rowX + 40, y + ROW_H / 2, "", { font: FONT_BTN_SM, color: "#e8e0d4" }).setOrigin(0, 0.5);
      const buyW = 160;
      const buyX = rowX + rowW - 12 - buyW;
      const buy = scene.add
        .rectangle(buyX + buyW / 2, y + ROW_H / 2, buyW, ROW_H - 12, 0x2a2014, 1)
        .setStrokeStyle(2, Palette.goldDim);
      const buyLabel = scene.add.text(buyX + buyW / 2, y + ROW_H / 2, "BUY", { font: FONT_BTN, color: "#e8c547" }).setOrigin(0.5);
      this.offerRects.push({ x: buyX, y, w: buyW, h: ROW_H });
      this.offerLabels.push(label);
      this.offerChips.push(chip);
      this.buyLabels.push(buyLabel);
      this.buyBoxes.push(buy);
      this.offerRows.push(box);
      children.push(box, chip, label, buy, buyLabel);
    }

    const closeW = 240;
    const closeY = top + panelH - 16 - BTN_H;
    this.closeRect = { x: cx - closeW / 2, y: closeY, w: closeW, h: BTN_H };
    this.closeBtn = scene.add
      .rectangle(cx, closeY + BTN_H / 2, closeW, BTN_H, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.gold)
      .setInteractive({ useHandCursor: true });
    children.push(this.closeBtn, scene.add.text(cx, closeY + BTN_H / 2, "CONTINUE", { font: FONT_BTN, color: "#e8c547" }).setOrigin(0.5));

    this.root = scene.add.container(0, 0, children).setDepth(44).setVisible(false);
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

  show(offers: ShopOffer[]): void {
    this.offers = offers;
    this.gold = this.getGold();
    this.redraw();
    this.root.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  handleTap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (containsRect(this.closeRect, x, y)) {
      this.hide();
      this.onClose();
      return true;
    }
    for (let i = 0; i < this.offerRects.length; i++) {
      const r = this.offerRects[i];
      if (r && containsRect(r, x, y)) {
        this.buy(i);
        return true;
      }
    }
    return true;
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
    this.redraw();
    return true;
  }

  private redraw(): void {
    const hasRunes = this.offers.some((o) => o.gem.kind === "rune");
    this.goldText.setText(`Gold  ${this.gold}    ·    ${hasRunes ? "basic Runes and level-1 Sigils" : "level-1 Sigils"}`);
    for (let i = 0; i < 4; i++) {
      const offer = this.offers[i];
      const label = this.offerLabels[i];
      const chip = this.offerChips[i];
      const buy = this.buyLabels[i];
      const box = this.buyBoxes[i];
      const row = this.offerRows[i];
      if (!label || !chip || !buy || !box) continue;
      if (!offer) {
        label.setVisible(false);
        chip.setVisible(false);
        buy.setVisible(false);
        box.setVisible(false);
        row?.setVisible(false);
        continue;
      }
      label.setVisible(true);
      chip.setVisible(true);
      buy.setVisible(true);
      box.setVisible(true);
      row?.setVisible(true);
      chip.setFillStyle(gemColor(offer.gem), 1);
      const kind = offer.gem.kind === "sigil" ? "Sigil" : "Rune";
      label.setText(`${gemName(offer.gem)}  ·  ${kind} L1`);
      if (offer.sold) {
        buy.setText("SOLD").setColor("#8a8490");
        box.setFillStyle(0x161416, 1).setStrokeStyle(2, Palette.stone);
      } else {
        buy.setText(`${offer.price}g`).setColor(this.gold >= offer.price ? "#e8c547" : "#8a8490");
        box.setFillStyle(0x2a2014, 1).setStrokeStyle(2, this.gold >= offer.price ? Palette.gold : Palette.stone);
      }
    }
  }
}
