import Phaser from "phaser";
import { CURRENCIES, CURRENCY_IDS } from "../data/currency";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { getProfile } from "../data/profile";
import { relicDisplayName, relicRarityLabel } from "../data/relics";
import { Palette } from "../palette";
import { gemColor, gemName, itemColor } from "./gems";
import { BTN_H, containsRect, FONT_BTN, FONT_BTN_SM, FONT_HUD, type UiRect } from "./ui";

const TOP = 16 + BTN_H + 16 + BTN_H + 20;
type Filter = "all" | "gems" | "relics" | "currency";
type Slot = { box: Phaser.GameObjects.Rectangle; chip: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; rect: UiRect };

export class StashPanel {
  readonly root: Phaser.GameObjects.Container;
  private readonly rows: Slot[] = [];
  private readonly summary: Phaser.GameObjects.Text;
  private readonly filterRects: Record<Filter, UiRect>;
  private readonly filterMarks: Record<Filter, Phaser.GameObjects.Rectangle>;
  private filter: Filter = "all";
  private page = 0;
  readonly prevRect: UiRect;
  readonly nextRect: UiRect;
  private readonly PAGE = 8;

  constructor(scene: Phaser.Scene) {
    const children: Phaser.GameObjects.GameObject[] = [];
    children.push(
      scene.add.rectangle(24, TOP, GAME_WIDTH - 48, GAME_HEIGHT - TOP - 24, Palette.panel, 0.96).setStrokeStyle(2, Palette.panelEdge).setOrigin(0, 0),
    );
    children.push(scene.add.text(44, TOP + 16, "Stash", { font: FONT_HUD, color: "#e8c547" }));
    this.summary = scene.add.text(160, TOP + 22, "", { font: FONT_BTN_SM, color: "#8a8490" });
    children.push(this.summary);

    const filters: Filter[] = ["all", "gems", "relics", "currency"];
    this.filterRects = {} as Record<Filter, UiRect>;
    this.filterMarks = {} as Record<Filter, Phaser.GameObjects.Rectangle>;
    let x = 44;
    const fy = TOP + 56;
    const fw = 150;
    for (const f of filters) {
      const rect = { x, y: fy, w: fw, h: 56 };
      this.filterRects[f] = rect;
      const box = scene.add.rectangle(x + fw / 2, fy + 28, fw, 56, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight);
      children.push(box, scene.add.text(x + fw / 2, fy + 28, f.toUpperCase(), { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5));
      const mark = scene.add.rectangle(x + fw / 2, fy + 28, fw, 56).setStrokeStyle(3, Palette.gold).setFillStyle(0, 0).setVisible(f === "all");
      this.filterMarks[f] = mark;
      children.push(mark);
      x += fw + 10;
    }

    const rowY = fy + 56 + 16;
    for (let i = 0; i < this.PAGE; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rx = 44 + col * 450;
      const ry = rowY + row * 68;
      const box = scene.add.rectangle(rx, ry, 430, 60, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight).setOrigin(0, 0);
      const chip = scene.add.rectangle(rx + 18, ry + 30, 14, 14, Palette.muted, 1);
      const label = scene.add.text(rx + 36, ry + 30, "", { font: FONT_BTN_SM, color: "#e8e0d4" }).setOrigin(0, 0.5);
      children.push(box, chip, label);
      this.rows.push({ box, chip, label, rect: { x: rx, y: ry, w: 430, h: 60 } });
    }

    this.prevRect = { x: 44, y: GAME_HEIGHT - 24 - 16 - BTN_H, w: 180, h: BTN_H };
    this.nextRect = { x: 44 + 200, y: this.prevRect.y, w: 180, h: BTN_H };
    children.push(
      scene.add.rectangle(this.prevRect.x + 90, this.prevRect.y + 44, 180, BTN_H, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight),
      scene.add.text(this.prevRect.x + 90, this.prevRect.y + 44, "PREV", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5),
      scene.add.rectangle(this.nextRect.x + 90, this.nextRect.y + 44, 180, BTN_H, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight),
      scene.add.text(this.nextRect.x + 90, this.nextRect.y + 44, "NEXT", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5),
    );
    this.root = scene.add.container(0, 0, children).setVisible(false);
  }

  handleTap(x: number, y: number): void {
    for (const [f, r] of Object.entries(this.filterRects) as [Filter, UiRect][]) {
      if (containsRect(r, x, y)) {
        this.filter = f;
        this.page = 0;
        this.refresh();
        return;
      }
    }
    const items = this.items();
    const maxPage = Math.max(0, Math.ceil(items.length / this.PAGE) - 1);
    if (containsRect(this.prevRect, x, y) && this.page > 0) {
      this.page -= 1;
      this.refresh();
    } else if (containsRect(this.nextRect, x, y) && this.page < maxPage) {
      this.page += 1;
      this.refresh();
    }
  }

  refresh(): void {
    const items = this.items();
    this.summary.setText(`${items.length} entries`);
    for (const f of Object.keys(this.filterMarks) as Filter[]) this.filterMarks[f].setVisible(f === this.filter);
    const start = this.page * this.PAGE;
    for (let i = 0; i < this.PAGE; i++) {
      const view = this.rows[i];
      const item = items[start + i];
      if (!view) continue;
      if (!item) {
        view.box.setVisible(false);
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      view.box.setVisible(true);
      view.chip.setVisible(true).setFillStyle(item.color, 1);
      view.label.setVisible(true).setText(item.label);
    }
  }

  private items(): { label: string; color: number }[] {
    const p = getProfile();
    const out: { label: string; color: number }[] = [];
    if (this.filter === "all" || this.filter === "gems") {
      for (const g of p.sigilInventory) out.push({ label: `${gemName(g)}  ·  Sigil L${g.level}`, color: gemColor(g) });
      for (const g of p.runeInventory) out.push({ label: `${gemName(g)}  ·  Rune L${g.level}`, color: gemColor(g) });
    }
    if (this.filter === "all" || this.filter === "relics") {
      for (const r of p.relicInventory) out.push({ label: `${relicDisplayName(r)}  ·  ${relicRarityLabel(r.rarity)}`, color: itemColor(r) });
    }
    if (this.filter === "all" || this.filter === "currency") {
      for (const id of CURRENCY_IDS) {
        const qty = p.currency[id] ?? 0;
        if (qty <= 0) continue;
        out.push({ label: `${CURRENCIES[id].name}  ×${qty}`, color: CURRENCIES[id].color });
      }
    }
    return out;
  }
}
