import Phaser from "phaser";
import { tryCraft } from "../data/craft";
import { CURRENCIES, CURRENCY_IDS, type CurrencyId } from "../data/currency";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { getProfile } from "../data/profile";
import { relicDisplayName, relicRarityLabel, type RelicInstance } from "../data/relics";
import { Palette } from "../palette";
import { itemColor } from "./gems";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_BTN_SM, FONT_HUD, type UiRect } from "./ui";

const TOP = 16 + BTN_H + 16 + BTN_H + 20;
const LIST = 6;

type Slot = { box: Phaser.GameObjects.Rectangle; chip: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; rect: UiRect };

export class ForgePanel {
  readonly root: Phaser.GameObjects.Container;
  private readonly relicViews: Slot[] = [];
  private readonly currViews: Slot[] = [];
  private readonly detail: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly applyBtn: Phaser.GameObjects.Rectangle;
  private readonly applyLabel: Phaser.GameObjects.Text;
  readonly applyRect: UiRect;
  private relicUid: string | null = null;
  private currencyId: CurrencyId | null = null;
  private relicPage = 0;

  constructor(scene: Phaser.Scene) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const panel = scene.add
      .rectangle(24, TOP, GAME_WIDTH - 48, GAME_HEIGHT - TOP - 24, Palette.panel, 0.96)
      .setStrokeStyle(2, Palette.panelEdge)
      .setOrigin(0, 0);
    children.push(panel);
    children.push(scene.add.text(44, TOP + 16, "The Ember Forge", { font: FONT_HUD, color: "#e8c547" }));
    children.push(scene.add.text(44, TOP + 48, "Relics", { font: FONT_BTN_SM, color: "#8a8490" }));
    children.push(scene.add.text(360, TOP + 48, "Currency", { font: FONT_BTN_SM, color: "#8a8490" }));

    const slotH = 56;
    for (let i = 0; i < LIST; i++) {
      this.relicViews.push(this.makeSlot(scene, children, 44, TOP + 72 + i * (slotH + 6), 300, slotH));
    }
    for (let i = 0; i < 8; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.currViews.push(this.makeSlot(scene, children, 360 + col * 280, TOP + 72 + row * (slotH + 6), 268, slotH));
    }

    this.detail = scene.add.text(44, TOP + 72 + LIST * (slotH + 6) + 8, "", {
      font: FONT_BTN_SM,
      color: "#e8e0d4",
      wordWrap: { width: 540 },
      lineSpacing: 3,
    });
    children.push(this.detail);
    this.message = scene.add.text(44, GAME_HEIGHT - 24 - BTN_H - 36, "", { font: FONT_BODY, color: "#c9a227" });
    children.push(this.message);

    const applyW = 240;
    this.applyRect = { x: GAME_WIDTH - 24 - 16 - applyW, y: GAME_HEIGHT - 24 - 16 - BTN_H, w: applyW, h: BTN_H };
    this.applyBtn = scene.add
      .rectangle(this.applyRect.x + applyW / 2, this.applyRect.y + BTN_H / 2, applyW, BTN_H, 0x2a2014, 1)
      .setStrokeStyle(2, Palette.gold);
    this.applyLabel = scene.add
      .text(this.applyRect.x + applyW / 2, this.applyRect.y + BTN_H / 2, "APPLY", { font: FONT_BTN, color: "#e8c547" })
      .setOrigin(0.5);
    children.push(this.applyBtn, this.applyLabel);

    this.root = scene.add.container(0, 0, children).setVisible(false);
  }

  private makeSlot(scene: Phaser.Scene, children: Phaser.GameObjects.GameObject[], x: number, y: number, w: number, h: number): Slot {
    const box = scene.add.rectangle(x, y, w, h, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight).setOrigin(0, 0);
    const chip = scene.add.rectangle(x + 16, y + h / 2, 14, 14, Palette.muted, 1);
    const label = scene.add.text(x + 30, y + h / 2, "", { font: FONT_BTN_SM, color: "#e8e0d4", wordWrap: { width: w - 40 } }).setOrigin(0, 0.5);
    children.push(box, chip, label);
    return { box, chip, label, rect: { x, y, w, h } };
  }

  handleTap(x: number, y: number): void {
    const relics = getProfile().relicInventory;
    for (let i = 0; i < this.relicViews.length; i++) {
      const view = this.relicViews[i];
      const relic = relics[this.relicPage * LIST + i];
      if (view && relic && containsRect(view.rect, x, y)) {
        this.relicUid = relic.uid;
        this.refresh();
        return;
      }
    }
    const ids = CURRENCY_IDS;
    for (let i = 0; i < this.currViews.length; i++) {
      const view = this.currViews[i];
      const id = ids[i];
      if (view && id && containsRect(view.rect, x, y)) {
        this.currencyId = id;
        this.refresh();
        return;
      }
    }
    if (containsRect(this.applyRect, x, y)) {
      if (!this.currencyId) {
        this.message.setText("Select a currency first.").setColor("#d4544a");
        return;
      }
      const result = tryCraft(this.relicUid, this.currencyId);
      this.message.setText(result.message).setColor(result.ok ? "#c9a227" : "#d4544a");
      this.refresh();
    }
  }

  refresh(): void {
    const profile = getProfile();
    const relics = profile.relicInventory;
    for (let i = 0; i < this.relicViews.length; i++) {
      const view = this.relicViews[i];
      const relic = relics[this.relicPage * LIST + i];
      if (!view) continue;
      if (!relic) {
        view.box.setVisible(false);
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      const on = relic.uid === this.relicUid;
      view.box.setVisible(true).setStrokeStyle(on ? 3 : 2, on ? Palette.gold : Palette.stoneLight);
      view.chip.setVisible(true).setFillStyle(itemColor(relic), 1);
      view.label.setVisible(true).setText(`${relicDisplayName(relic)}\n${relicRarityLabel(relic.rarity)}${relic.corrupted ? "  locked" : ""}`);
    }
    for (let i = 0; i < this.currViews.length; i++) {
      const view = this.currViews[i];
      const id = CURRENCY_IDS[i];
      if (!view || !id) continue;
      const def = CURRENCIES[id];
      const qty = profile.currency[id] ?? 0;
      const on = this.currencyId === id;
      view.box.setVisible(true).setStrokeStyle(on ? 3 : 2, on ? Palette.gold : Palette.stoneLight);
      view.chip.setVisible(true).setFillStyle(def.color, 1);
      view.label.setVisible(true).setColor(qty > 0 ? "#e8e0d4" : "#8a8490").setText(`${def.name}  ×${qty}`);
    }
    const relic = relics.find((r) => r.uid === this.relicUid) ?? null;
    this.detail.setText(relic ? describe(relic) : "Select a Relic in your bag, then a currency, then Apply.");
  }

  relicRects(): UiRect[] {
    const relics = getProfile().relicInventory;
    const out: UiRect[] = [];
    for (let i = 0; i < this.relicViews.length; i++) {
      if (this.relicViews[i] && relics[this.relicPage * LIST + i]) out.push(this.relicViews[i]!.rect);
    }
    return out;
  }

  currencyRects(): UiRect[] {
    return this.currViews.map((v) => v.rect);
  }

  selectedRelic(): string | null {
    return this.relicUid;
  }
}

function describe(relic: RelicInstance): string {
  const bits = [`${relicDisplayName(relic)}  ·  ${relicRarityLabel(relic.rarity)}  ·  ilvl ${relic.itemLevel}`];
  if (relic.corrupted) bits.push("Corrupted — locked from further crafting.");
  bits.push(`${relic.affixes.length} affix${relic.affixes.length === 1 ? "" : "es"}`);
  return bits.join("\n");
}
