import Phaser from "phaser";
import { CURRENCIES } from "../data/currency";
import type { SpoilsItem } from "../data/drops";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../data/map";
import { relicDisplayName } from "../data/relics";
import { Palette } from "../palette";
import { collectSpoils } from "../data/profile";
import { gemName } from "./gems";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_HUD, type UiRect } from "./ui";

function labelOf(item: SpoilsItem): string {
  if (item.kind === "currency") return `${item.qty}× ${CURRENCIES[item.id].name}`;
  if (item.kind === "relic") return `${relicDisplayName(item.item)}  (${item.item.rarity})`;
  return `${gemName(item.item)}  (${item.kind})`;
}

export class SpoilsOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly list: Phaser.GameObjects.Text;
  private readonly takeBtn: Phaser.GameObjects.Rectangle;
  private readonly takeLabel: Phaser.GameObjects.Text;
  readonly takeRect: UiRect;
  private items: SpoilsItem[] = [];

  constructor(scene: Phaser.Scene, private readonly onTaken: () => void) {
    const w = 520;
    const h = 360;
    const cx = GAME_WIDTH / 2;
    const cy = (GAME_HEIGHT - HUD_HEIGHT) / 2 - 20;
    const children: Phaser.GameObjects.GameObject[] = [];
    children.push(
      scene.add.rectangle(cx, cy, w, h, Palette.panel, 0.98).setStrokeStyle(2, Palette.goldDim),
    );
    this.title = scene.add
      .text(cx, cy - h / 2 + 20, "Spoils of the Breach", { font: FONT_HUD, color: "#e8c547" })
      .setOrigin(0.5, 0);
    children.push(this.title);
    this.list = scene.add
      .text(cx, cy - h / 2 + 64, "", {
        font: FONT_BODY,
        color: "#e8e0d4",
        align: "center",
        wordWrap: { width: w - 48 },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    children.push(this.list);
    const btnW = 280;
    const btnX = cx - btnW / 2;
    const btnY = cy + h / 2 - 16 - BTN_H;
    this.takeRect = { x: btnX, y: btnY, w: btnW, h: BTN_H };
    this.takeBtn = scene.add
      .rectangle(cx, btnY + BTN_H / 2, btnW, BTN_H, 0x2a2014, 1)
      .setStrokeStyle(2, Palette.gold)
      .setInteractive({ useHandCursor: true });
    this.takeLabel = scene.add
      .text(cx, btnY + BTN_H / 2, "TAKE SPOILS", { font: FONT_BTN, color: "#e8c547" })
      .setOrigin(0.5);
    children.push(this.takeBtn, this.takeLabel);
    this.root = scene.add.container(0, 0, children).setDepth(45).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  get pending(): SpoilsItem[] {
    return this.items;
  }

  show(items: SpoilsItem[]): void {
    this.items = items.slice();
    if (this.items.length === 0) {
      this.hide();
      return;
    }
    const lines = this.items.slice(0, 8).map((it) => labelOf(it));
    if (this.items.length > 8) lines.push(`+${this.items.length - 8} more`);
    this.list.setText(lines.join("\n"));
    this.root.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  handleTap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (containsRect(this.takeRect, x, y)) {
      this.take();
      return true;
    }
    return true; // swallow taps while open
  }

  take(): void {
    if (this.items.length > 0) collectSpoils(this.items);
    this.items = [];
    this.hide();
    this.onTaken();
  }
}

export function spoilsSummary(items: readonly SpoilsItem[]): { relics: number; gems: number; currency: number } {
  let relics = 0;
  let gems = 0;
  let currency = 0;
  for (const it of items) {
    if (it.kind === "relic") relics += 1;
    else if (it.kind === "currency") currency += it.qty;
    else gems += 1;
  }
  return { relics, gems, currency };
}
