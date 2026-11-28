import Phaser from "phaser";
import type { GemInstance } from "../data/items";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../data/map";
import { isRuneId, RUNES } from "../data/runes";
import { isSigilId, SIGILS } from "../data/sigils";
import { runeMatchesSigil } from "../data/stats";
import { TOWERS } from "../data/towers";
import { Palette } from "../palette";
import { gemColor, gemIcon, gemName } from "./gems";
import { addIcon, setIcon } from "./sprites";
import type { PlacedTower } from "./towerState";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_BTN_SM, FONT_HUD, type UiRect } from "./ui";

const PANEL_W = 560;
const PANEL_H = GAME_HEIGHT - HUD_HEIGHT - 16;
const PANEL_X = Math.round((GAME_WIDTH - PANEL_W) / 2);
const PANEL_Y = 8;
const INV_MAX = 6;

type Handlers = {
  inventory: () => GemInstance[];
  loadoutRunes: (tower: PlacedTower) => readonly (GemInstance | null)[];
  swap: (tower: PlacedTower, uid: string) => boolean;
  unsocket: (tower: PlacedTower) => boolean;
};

type SlotView = {
  box: Phaser.GameObjects.Rectangle;
  chip: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  rect: UiRect;
};

export class SigilPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dimmer: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly currentView: SlotView;
  private readonly unsocketBtn: Phaser.GameObjects.Rectangle;
  private readonly unsocketLabel: Phaser.GameObjects.Text;
  private readonly unsocketRect: UiRect;
  private readonly closeBtn: Phaser.GameObjects.Rectangle;
  private readonly invViews: SlotView[] = [];
  private readonly runeViews: SlotView[] = [];
  private tower: PlacedTower | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly handlers: Handlers,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];

    this.dimmer = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.55)
      .setDepth(48)
      .setVisible(false);

    const bg = scene.add
      .rectangle(0, 0, PANEL_W, PANEL_H, Palette.panel, 0.97)
      .setStrokeStyle(2, Palette.panelEdge)
      .setOrigin(0, 0);
    children.push(bg);

    this.title = scene.add.text(16, 28, "", { font: FONT_HUD, color: "#e8c547" });
    children.push(this.title);

    const closeW = 140;
    const closeX = PANEL_W - 16 - closeW;
    this.closeBtn = scene.add
      .rectangle(closeX + closeW / 2, 8 + BTN_H / 2, closeW, BTN_H, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.goldDim)
      .setInteractive({ useHandCursor: true });
    const closeLabel = scene.add
      .text(closeX + closeW / 2, 8 + BTN_H / 2, "CLOSE", { font: FONT_BTN, color: "#e8c547" })
      .setOrigin(0.5);
    this.closeBtn.on("pointerover", () => this.closeBtn.setStrokeStyle(3, Palette.gold));
    this.closeBtn.on("pointerout", () => this.closeBtn.setStrokeStyle(2, Palette.goldDim));
    children.push(this.closeBtn, closeLabel);

    children.push(scene.add.text(16, 108, "Sigil", { font: FONT_BTN_SM, color: "#8a8490" }));
    this.currentView = this.makeSlot(scene, 16, 132, 280, BTN_H);
    children.push(this.currentView.box, this.currentView.chip, this.currentView.label);

    const unX = 16 + 280 + 12;
    const unW = PANEL_W - unX - 16;
    this.unsocketRect = { x: PANEL_X + unX, y: PANEL_Y + 132, w: unW, h: BTN_H };
    this.unsocketBtn = scene.add
      .rectangle(unX + unW / 2, 132 + BTN_H / 2, unW, BTN_H, 0x2a1818, 1)
      .setStrokeStyle(2, Palette.danger)
      .setInteractive({ useHandCursor: true });
    this.unsocketLabel = scene.add
      .text(unX + unW / 2, 132 + BTN_H / 2, "UNSOCKET", { font: FONT_BTN, color: "#e8e0d4" })
      .setOrigin(0.5);
    children.push(this.unsocketBtn, this.unsocketLabel);

    this.statsText = scene.add.text(16, 132 + BTN_H + 12, "", { font: FONT_BTN_SM, color: "#e8e0d4", lineSpacing: 4 });
    children.push(this.statsText);

    const invLabelY = 132 + BTN_H + 56;
    children.push(scene.add.text(16, invLabelY, "Sigil inventory", { font: FONT_BTN_SM, color: "#8a8490" }));
    this.hintText = scene.add.text(230, invLabelY, "Tap a Sigil to swap", { font: FONT_BODY, color: "#c9a227" });
    children.push(this.hintText);

    const invTop = invLabelY + 24;
    const invW = (PANEL_W - 32 - 24) / 3;
    for (let i = 0; i < INV_MAX; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 16 + col * (invW + 12);
      const y = invTop + row * (BTN_H + 8);
      const view = this.makeSlot(scene, x, y, invW, BTN_H);
      this.invViews.push(view);
      children.push(view.box, view.chip, view.label);
    }

    const runeY = invTop + 2 * (BTN_H + 8) + 8;
    children.push(scene.add.text(16, runeY, "Loadout runes  (read-only)", { font: FONT_BTN_SM, color: "#8a8490" }));
    const runeW = (PANEL_W - 32 - 24) / 3;
    for (let i = 0; i < 3; i++) {
      const x = 16 + i * (runeW + 12);
      const y = runeY + 24;
      const view = this.makeSlot(scene, x, y, runeW, BTN_H);
      this.runeViews.push(view);
      children.push(view.box, view.chip, view.label);
    }

    for (const child of children) {
      const obj = child as Phaser.GameObjects.GameObject & { x: number; y: number };
      if (typeof obj.x === "number" && typeof obj.y === "number") {
        obj.x += PANEL_X;
        obj.y += PANEL_Y;
      }
    }
    this.currentView.rect.x += PANEL_X;
    this.currentView.rect.y += PANEL_Y;
    for (const v of this.invViews) {
      v.rect.x += PANEL_X;
      v.rect.y += PANEL_Y;
    }
    for (const v of this.runeViews) {
      v.rect.x += PANEL_X;
      v.rect.y += PANEL_Y;
    }

    this.root = scene.add.container(0, 0, children);
    this.root.setDepth(50).setVisible(false);
    this.dimmer.setDepth(48);
    this.closeBtn.setDepth(54);
    this.unsocketBtn.setDepth(54);
  }

  private makeSlot(scene: Phaser.Scene, x: number, y: number, w: number, h: number): SlotView {
    const box = scene.add
      .rectangle(x, y, w, h, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    const chip = addIcon(scene, x + 18, y + h / 2, "gem-chip", 16).setVisible(false);
    const label = scene.add.text(x + 34, y + h / 2 - 16, "", {
      font: FONT_BTN_SM,
      color: "#e8e0d4",
      wordWrap: { width: w - 44 },
    });
    box.on("pointerover", () => {
      if (box.visible) box.setStrokeStyle(2, Palette.gold);
    });
    box.on("pointerout", () => box.setStrokeStyle(2, Palette.stoneLight));
    return { box, chip, label, rect: { x, y, w, h } };
  }

  get visible(): boolean {
    return this.root.visible;
  }

  get openTower(): PlacedTower | null {
    return this.tower;
  }

  contains(_worldX: number, _worldY: number): boolean {
    return this.root.visible;
  }

  handleTap(worldX: number, worldY: number): void {
    if (!this.root.visible) return;
    if (containsRect(this.closeBounds(), worldX, worldY)) {
      this.hide();
      return;
    }
    if (containsRect(this.unsocketRect, worldX, worldY)) {
      if (this.tower) this.handlers.unsocket(this.tower);
      return;
    }
    const items = this.handlers.inventory();
    for (let i = 0; i < this.invViews.length; i++) {
      const view = this.invViews[i];
      const gem = items[i];
      if (view && gem && containsRect(view.rect, worldX, worldY) && this.tower) {
        this.handlers.swap(this.tower, gem.uid);
        return;
      }
    }
    if (!this.inPanel(worldX, worldY)) this.hide();
  }

  show(tower: PlacedTower): void {
    this.tower = tower;
    this.root.setVisible(true);
    this.dimmer.setVisible(true);
    this.refresh();
  }

  hide(): void {
    this.tower = null;
    this.root.setVisible(false);
    this.dimmer.setVisible(false);
  }

  refresh(): void {
    if (!this.root.visible || !this.tower) return;
    const tower = this.tower;
    const def = TOWERS[tower.id];
    this.title.setText(def.name);
    const sigil = tower.sockets[0] && tower.sockets[0].kind === "sigil" ? tower.sockets[0] : null;
    this.drawSlot(this.currentView, sigil, "Empty — this frame is inert", true);
    this.unsocketBtn.setFillStyle(sigil ? 0x3a1a1a : 0x1a1414);
    this.unsocketBtn.setStrokeStyle(2, sigil ? Palette.danger : Palette.stone);
    this.unsocketLabel.setColor(sigil ? "#e8e0d4" : "#8a8490");

    const r = tower.resolved;
    const dmg = Math.round(r.damage * 10) / 10;
    const rate = Math.round(r.attackRate * 100) / 100;
    this.statsText.setText(
      `Damage ${dmg}    Rate ${rate}/s    Range ${r.range}\nProjectiles ${r.projectileCount}    Chain ${r.chainCount}    Pierce ${r.pierceCount}`,
    );

    const items = this.handlers.inventory();
    for (let i = 0; i < this.invViews.length; i++) {
      const view = this.invViews[i];
      if (!view) continue;
      const gem = items[i];
      if (!gem) {
        view.box.setVisible(false);
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      const fit = isSigilId(gem.defId) && gem.kind === "sigil";
      this.drawSlot(view, gem, "", fit);
    }

    const runes = this.handlers.loadoutRunes(tower);
    const sigilTags = sigil && isSigilId(sigil.defId) ? SIGILS[sigil.defId].tags : [];
    for (let i = 0; i < this.runeViews.length; i++) {
      const view = this.runeViews[i];
      if (!view) continue;
      if (i >= runes.length) {
        view.box.setVisible(false);
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      const gem = runes[i];
      view.box.setVisible(true).setStrokeStyle(2, Palette.stone);
      if (!gem) {
        view.chip.setVisible(false);
        view.label.setVisible(true).setColor("#8a8490").setText("Empty");
        continue;
      }
      const tags = isRuneId(gem.defId) ? RUNES[gem.defId].tags : [];
      const ok = sigil !== null && runeMatchesSigil(sigilTags, tags);
      view.chip.setVisible(true);
      setIcon(view.chip, gemIcon(gem), gemColor(gem), 16);
      view.label
        .setVisible(true)
        .setColor(ok ? "#e8e0d4" : "#8a8490")
        .setText(`${gemName(gem)}\n${ok ? "Active" : "Inactive"}`);
    }
  }

  rects(): {
    close: UiRect;
    unsocket: UiRect;
    currentSigil: UiRect;
    inventory: UiRect[];
    runes: UiRect[];
  } {
    const inv: UiRect[] = [];
    const items = this.handlers.inventory();
    for (let i = 0; i < this.invViews.length; i++) {
      const view = this.invViews[i];
      if (view && items[i]) inv.push(view.rect);
    }
    const runes: UiRect[] = [];
    if (this.tower) {
      const list = this.handlers.loadoutRunes(this.tower);
      for (let i = 0; i < list.length; i++) {
        const v = this.runeViews[i];
        if (v) runes.push(v.rect);
      }
    }
    return {
      close: this.closeBounds(),
      unsocket: this.unsocketRect,
      currentSigil: this.currentView.rect,
      inventory: inv,
      runes,
    };
  }

  private drawSlot(view: SlotView, gem: GemInstance | null, empty: string, enabled: boolean): void {
    view.box.setVisible(true).setStrokeStyle(2, enabled ? Palette.stoneLight : Palette.stone);
    if (!gem) {
      view.chip.setVisible(false);
      view.label.setVisible(true).setColor("#8a8490").setText(empty);
      return;
    }
    view.chip.setVisible(true);
    setIcon(view.chip, gemIcon(gem), gemColor(gem), 16);
    const kind = gem.kind === "sigil" ? "Sigil" : "Rune";
    view.label
      .setVisible(true)
      .setColor(enabled ? "#e8e0d4" : "#8a8490")
      .setText(`${gemName(gem)}\n${kind}  L${gem.level}`);
  }

  private closeBounds(): UiRect {
    return {
      x: this.closeBtn.x - this.closeBtn.width / 2,
      y: this.closeBtn.y - this.closeBtn.height / 2,
      w: this.closeBtn.width,
      h: this.closeBtn.height,
    };
  }

  private inPanel(x: number, y: number): boolean {
    return x >= PANEL_X && x <= PANEL_X + PANEL_W && y >= PANEL_Y && y <= PANEL_Y + PANEL_H;
  }
}
