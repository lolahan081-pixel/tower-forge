import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../data/map";
import { makeGem, type GemInstance } from "../data/items";
import { isRuneId, RUNES } from "../data/runes";
import { isSigilId, SIGILS } from "../data/sigils";
import { runeMatchesSigil, type ResolvedAttack } from "../data/stats";
import { TOWERS } from "../data/towers";
import { Palette } from "../palette";
import type { PlacedTower } from "./towerState";
import { BTN_H, FONT_BODY, FONT_BTN, FONT_BTN_SM, FONT_HUD, type UiRect } from "./ui";

const PANEL_W = 520;
const PANEL_H = GAME_HEIGHT - HUD_HEIGHT - 16;
const PANEL_X = Math.round((GAME_WIDTH - PANEL_W) / 2);
const PANEL_Y = 8;
const MAX_SOCKETS = 6;
const INV_PAGE = 4;
const SLOT_W = 154;
const SLOT_H = 88;
const INV_H = 88;

export function gemName(g: GemInstance): string {
  if (g.kind === "sigil" && isSigilId(g.defId)) return SIGILS[g.defId].name;
  if (g.kind === "rune" && isRuneId(g.defId)) return RUNES[g.defId].name;
  return g.defId;
}

export function gemColor(g: GemInstance): number {
  if (g.kind === "sigil" && isSigilId(g.defId)) return SIGILS[g.defId].accent;
  if (g.kind === "rune" && isRuneId(g.defId)) return RUNES[g.defId].color;
  return Palette.muted;
}

export function createStarterInventory(): GemInstance[] {
  return [
    makeGem("sigil", "cinder-orb"),
    makeGem("sigil", "forked-spark"),
    makeGem("sigil", "hoarfrost-burst"),
    makeGem("sigil", "crimson-spike"),
    makeGem("rune", "split-volley"),
    makeGem("rune", "linked-arc"),
    makeGem("rune", "through-flesh"),
    makeGem("rune", "rime-touch"),
    makeGem("rune", "quickening"),
  ];
}

type PanelHandlers = {
  inventory: () => GemInstance[];
  socket: (tower: PlacedTower, slot: number, uid: string) => boolean;
  unsocket: (tower: PlacedTower, slot: number) => boolean;
};

type SocketView = {
  box: Phaser.GameObjects.Rectangle;
  chip: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  rect: UiRect;
};

type InvView = {
  box: Phaser.GameObjects.Rectangle;
  chip: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  rect: UiRect;
};

export class TowerPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dimmer: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly invLabel: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly unsocketBtn: Phaser.GameObjects.Rectangle;
  private readonly unsocketLabel: Phaser.GameObjects.Text;
  private readonly closeBtn: Phaser.GameObjects.Rectangle;
  private readonly unsocketRect: UiRect;
  private readonly socketViews: SocketView[] = [];
  private readonly invViews: InvView[] = [];
  private tower: PlacedTower | null = null;
  private selectedUid: string | null = null;
  private selectedSlot: number | null = null;
  private invPage = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly handlers: PanelHandlers,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];

    this.dimmer = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.55)
      .setDepth(29)
      .setVisible(false);

    const bg = scene.add
      .rectangle(0, 0, PANEL_W, PANEL_H, Palette.panel, 0.97)
      .setStrokeStyle(2, Palette.panelEdge)
      .setOrigin(0, 0);
    children.push(bg);

    this.title = scene.add.text(16, 26, "", { font: FONT_HUD, color: "#e8c547" });
    children.push(this.title);

    const closeW = 128;
    const closeH = BTN_H;
    const closeX = PANEL_W - 16 - closeW;
    const closeY = 8;
    this.closeBtn = scene.add
      .rectangle(closeX + closeW / 2, closeY + closeH / 2, closeW, closeH, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.goldDim)
      .setInteractive({ useHandCursor: true });
    const closeLabel = scene.add
      .text(closeX + closeW / 2, closeY + closeH / 2, "CLOSE", { font: FONT_BTN, color: "#e8c547" })
      .setOrigin(0.5);
    this.closeBtn.on("pointerover", () => this.closeBtn.setStrokeStyle(3, Palette.gold));
    this.closeBtn.on("pointerout", () => this.closeBtn.setStrokeStyle(2, Palette.goldDim));
    children.push(this.closeBtn, closeLabel);

    children.push(scene.add.text(16, 100, "Inscription", { font: FONT_BTN_SM, color: "#8a8490" }));

    for (let i = 0; i < MAX_SOCKETS; i++) {
      const x = 16 + (i % 3) * (SLOT_W + 10);
      const y = 124 + Math.floor(i / 3) * (SLOT_H + 8);
      const box = scene.add
        .rectangle(x, y, SLOT_W, SLOT_H, 0x1a161c, 1)
        .setStrokeStyle(2, Palette.stoneLight)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const chip = scene.add.rectangle(x + 18, y + SLOT_H / 2, 18, 18, Palette.muted, 1).setVisible(false);
      const label = scene.add.text(x + 34, y + 18, "", {
        font: FONT_BTN_SM,
        color: "#e8e0d4",
        wordWrap: { width: SLOT_W - 42 },
      });
      const slot = i;

      box.on("pointerover", () => {
        if (box.visible) box.setStrokeStyle(2, Palette.gold);
      });
      box.on("pointerout", () => this.refreshSocketStroke(slot));
      this.socketViews.push({
        box,
        chip,
        label,
        rect: { x: PANEL_X + x, y: PANEL_Y + y, w: SLOT_W, h: SLOT_H },
      });
      children.push(box, chip, label);
    }

    const unsocketW = 150;
    const unsocketX = closeX - 12 - unsocketW;
    const unsocketY = 8;
    this.unsocketRect = { x: PANEL_X + unsocketX, y: PANEL_Y + unsocketY, w: unsocketW, h: BTN_H };
    this.unsocketBtn = scene.add
      .rectangle(unsocketX + unsocketW / 2, unsocketY + BTN_H / 2, unsocketW, BTN_H, 0x2a1818, 1)
      .setStrokeStyle(2, Palette.danger)
      .setInteractive({ useHandCursor: true });
    this.unsocketLabel = scene.add
      .text(unsocketX + unsocketW / 2, unsocketY + BTN_H / 2, "UNSOCKET", { font: FONT_BTN_SM, color: "#e8e0d4" })
      .setOrigin(0.5);
    children.push(this.unsocketBtn, this.unsocketLabel);

    this.statsText = scene.add.text(16, 230, "", { font: FONT_BTN_SM, color: "#e8e0d4", lineSpacing: 4 });
    children.push(this.statsText);

    this.invLabel = scene.add.text(16, 280, "Inventory", { font: FONT_BTN_SM, color: "#8a8490" });
    children.push(this.invLabel);

    this.hintText = scene.add.text(150, 280, "Tap a gem, then a socket", { font: FONT_BODY, color: "#c9a227" });
    children.push(this.hintText);

    const invW = (PANEL_W - 32 - 10) / 2;
    for (let i = 0; i < INV_PAGE; i++) {
      const box = scene.add
        .rectangle(16, 310, invW, INV_H, 0x161418, 1)
        .setStrokeStyle(2, Palette.stone)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      const chip = scene.add.rectangle(34, 354, 18, 18, Palette.muted, 1).setVisible(false);
      const label = scene.add.text(52, 332, "", { font: FONT_BTN_SM, color: "#e8e0d4", wordWrap: { width: invW - 48 } }).setVisible(false);
      const index = i;

      box.on("pointerover", () => {
        if (box.visible) box.setStrokeStyle(2, Palette.gold);
      });
      box.on("pointerout", () => this.refreshInvStroke(index));
      this.invViews.push({
        box,
        chip,
        label,
        rect: { x: 0, y: 0, w: invW, h: INV_H },
      });
      children.push(box, chip, label);
    }

    const prev = scene.add
      .rectangle(16 + 80, 520, 160, BTN_H, 0x161418, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setInteractive({ useHandCursor: true });
    const prevL = scene.add.text(16 + 80, 520, "PREV", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5);
    const next = scene.add
      .rectangle(PANEL_W - 16 - 80, 520, 160, BTN_H, 0x161418, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setInteractive({ useHandCursor: true });
    const nextL = scene.add.text(PANEL_W - 16 - 80, 520, "NEXT", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5);


    children.push(prev, prevL, next, nextL);
    this.prevBtn = prev;
    this.nextBtn = next;
    this.prevLabel = prevL;
    this.nextLabel = nextL;
    this.prevRect = { x: 0, y: 0, w: 160, h: BTN_H };
    this.nextRect = { x: 0, y: 0, w: 160, h: BTN_H };

    for (const child of children) {
      const obj = child as Phaser.GameObjects.GameObject & { x: number; y: number };
      if (typeof obj.x === "number" && typeof obj.y === "number") {
        obj.x += PANEL_X;
        obj.y += PANEL_Y;
      }
    }
    this.root = scene.add.container(0, 0, children);
    this.root.setDepth(50).setVisible(false);
    this.dimmer.setDepth(48);
    for (const child of children) {
      const obj = child as Phaser.GameObjects.GameObject & { setDepth: (d: number) => void };
      if (typeof obj.setDepth === "function") obj.setDepth(50);
    }
    this.closeBtn.setDepth(54);
    this.unsocketBtn.setDepth(54);
  }

  private inPanelCard(x: number, y: number): boolean {
    return x >= PANEL_X && x <= PANEL_X + PANEL_W && y >= PANEL_Y && y <= PANEL_Y + PANEL_H;
  }

  private readonly prevBtn: Phaser.GameObjects.Rectangle;
  private readonly nextBtn: Phaser.GameObjects.Rectangle;
  private readonly prevLabel: Phaser.GameObjects.Text;
  private readonly nextLabel: Phaser.GameObjects.Text;
  private readonly prevRect: UiRect;
  private readonly nextRect: UiRect;

  get visible(): boolean {
    return this.root.visible;
  }

  get openTower(): PlacedTower | null {
    return this.tower;
  }

  contains(_worldX: number, _worldY: number): boolean {
    if (!this.root.visible) return false;
    return true; // dimmer covers the whole game while the panel is open
  }

  /** Scene-level tap routing so container/depth stacking cannot swallow clicks. */
  handleTap(worldX: number, worldY: number): void {
    if (!this.root.visible) return;
    if (inRect(this.closeBtnBounds(), worldX, worldY)) {
      this.hide();
      return;
    }
    if (inRect(this.unsocketRect, worldX, worldY)) {
      this.onUnsocket();
      return;
    }
    if (this.tower) {
      for (let i = 0; i < this.tower.sockets.length; i++) {
        const view = this.socketViews[i];
        if (view && inRect(view.rect, worldX, worldY)) {
          this.onSocketClick(i);
          return;
        }
      }
    }
    const items = this.handlers.inventory();
    const start = this.invPage * INV_PAGE;
    for (let i = 0; i < INV_PAGE; i++) {
      const view = this.invViews[i];
      const gem = items[start + i];
      if (view && gem && inRect(view.rect, worldX, worldY)) {
        this.onInvClick(i);
        return;
      }
    }
    if (items.length > INV_PAGE) {
      if (inRect(this.prevRect, worldX, worldY) && this.invPage > 0) {
        this.invPage -= 1;
        this.refresh();
        return;
      }
      const maxPage = Math.max(0, Math.ceil(items.length / INV_PAGE) - 1);
      if (inRect(this.nextRect, worldX, worldY) && this.invPage < maxPage) {
        this.invPage += 1;
        this.refresh();
        return;
      }
    }
    if (!this.inPanelCard(worldX, worldY)) this.hide();
  }

  private closeBtnBounds(): UiRect {
    return {
      x: this.closeBtn.x - this.closeBtn.width / 2,
      y: this.closeBtn.y - this.closeBtn.height / 2,
      w: this.closeBtn.width,
      h: this.closeBtn.height,
    };
  }

  show(tower: PlacedTower): void {
    this.tower = tower;
    this.selectedUid = null;
    this.selectedSlot = null;
    this.invPage = 0;
    this.root.setVisible(true);
    this.dimmer.setVisible(true);
    this.setChildrenInput(true);
    this.refresh();
  }

  hide(): void {
    this.tower = null;
    this.selectedUid = null;
    this.selectedSlot = null;
    this.setChildrenInput(false);
    this.root.setVisible(false);
    this.dimmer.setVisible(false);
  }

  private setChildrenInput(enabled: boolean): void {
    this.root.iterate((child: Phaser.GameObjects.GameObject) => {
      if (child.input) child.input.enabled = enabled;
    });
    if (this.dimmer.input) this.dimmer.input.enabled = enabled;
  }

  refresh(): void {
    if (!this.root.visible || !this.tower) return;
    const tower = this.tower;
    const def = TOWERS[tower.id];
    this.title.setText(def.name);
    this.layoutForSockets(def.sockets);
    this.drawSockets(tower, def.sockets);
    this.drawUnsocket();
    this.drawStats(tower.resolved);
    this.drawInventory();
    this.hintText.setText(
      this.selectedUid ? "Tap a socket to link this gem" : "Tap a gem, then a socket",
    );
  }

  rects(): {
    invPage: number;
    invPageSize: number;
    close: UiRect;
    unsocket: UiRect;
    sockets: UiRect[];
    inventory: UiRect[];
    prev: UiRect;
    next: UiRect;
  } {
    const inv: UiRect[] = [];
    const items = this.handlers.inventory();
    const start = this.invPage * INV_PAGE;
    for (let i = 0; i < INV_PAGE; i++) {
      const view = this.invViews[i];
      const gem = items[start + i];
      if (view && gem) inv.push(view.rect);
    }
    const socks: UiRect[] = [];
    if (this.tower) {
      for (let i = 0; i < this.tower.sockets.length; i++) {
        const v = this.socketViews[i];
        if (v) socks.push(v.rect);
      }
    }
    return {
      invPage: this.invPage,
      invPageSize: INV_PAGE,
      close: {
        x: this.closeBtn.x - this.closeBtn.width / 2,
        y: this.closeBtn.y - this.closeBtn.height / 2,
        w: this.closeBtn.width,
        h: this.closeBtn.height,
      },
      unsocket: this.unsocketRect,
      sockets: socks,
      inventory: inv,
      prev: this.prevRect,
      next: this.nextRect,
    };
  }


  private layoutForSockets(count: number): void {
    const rows = Math.max(1, Math.ceil(count / 3));
    const socketsBottom = PANEL_Y + 124 + rows * SLOT_H + (rows - 1) * 8;
    const statsY = socketsBottom + 10;
    this.statsText.setPosition(PANEL_X + 16, statsY);
    const invLabelY = statsY + 44;
    this.invLabel.setPosition(PANEL_X + 16, invLabelY);
    this.hintText.setPosition(PANEL_X + 210, invLabelY);
    const invTop = invLabelY + 24;
    const w = (PANEL_W - 32 - 10) / 2;
    for (let i = 0; i < INV_PAGE; i++) {
      const view = this.invViews[i];
      if (!view) continue;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = PANEL_X + 16 + col * ((PANEL_W - 32 + 10) / 2);
      const y = invTop + row * (INV_H + 8);
      view.box.setPosition(x, y);
      view.chip.setPosition(x + 18, y + INV_H / 2);
      view.label.setPosition(x + 36, y + 22);
      view.rect.x = x;
      view.rect.y = y;
      view.rect.w = w;
      view.rect.h = INV_H;
    }
    const pageY = invTop + 2 * (INV_H + 8) + 6;
    this.prevBtn.setPosition(PANEL_X + 16 + 80, pageY + BTN_H / 2);
    this.prevLabel.setPosition(PANEL_X + 16 + 80, pageY + BTN_H / 2);
    this.nextBtn.setPosition(PANEL_X + PANEL_W - 16 - 80, pageY + BTN_H / 2);
    this.nextLabel.setPosition(PANEL_X + PANEL_W - 16 - 80, pageY + BTN_H / 2);
    this.prevRect.x = PANEL_X + 16;
    this.prevRect.y = pageY;
    this.prevRect.w = 160;
    this.prevRect.h = BTN_H;
    this.nextRect.x = PANEL_X + PANEL_W - 16 - 160;
    this.nextRect.y = pageY;
    this.nextRect.w = 160;
    this.nextRect.h = BTN_H;
  }

  private drawSockets(tower: PlacedTower, count: number): void {
    const sigil = firstSigil(tower.sockets);
    const sigilDef = sigil && isSigilId(sigil.defId) ? SIGILS[sigil.defId] : null;
    for (let i = 0; i < MAX_SOCKETS; i++) {
      const view = this.socketViews[i];
      if (!view) continue;
      const used = i < count;
      view.box.setVisible(used);
      if (!used) {
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      const gem = tower.sockets[i] ?? null;
      this.refreshSocketStroke(i);
      if (!gem) {
        view.chip.setVisible(false);
        view.label.setVisible(true).setColor("#8a8490").setText("Empty socket");
        continue;
      }
      const runeTags = gem.kind === "rune" && isRuneId(gem.defId) ? RUNES[gem.defId].tags : [];
      const mismatch = gem.kind === "rune" && sigilDef ? !runeMatchesSigil(sigilDef.tags, runeTags) : false;
      view.chip.setVisible(true).setFillStyle(gemColor(gem), 1);
      const kind = gem.kind === "sigil" ? "Sigil" : "Rune";
      view.label
        .setVisible(true)
        .setColor(mismatch ? "#8a8490" : "#e8e0d4")
        .setText(`${gemName(gem)}\n${kind}  L${gem.level}${mismatch ? "  off" : ""}`);
    }
  }

  private refreshSocketStroke(slot: number): void {
    const view = this.socketViews[slot];
    if (!view || !view.box.visible) return;
    const gem = this.tower?.sockets[slot] ?? null;
    const selected = this.selectedSlot === slot || (gem !== null && gem.uid === this.selectedUid);
    view.box.setStrokeStyle(selected ? 3 : 2, selected ? Palette.gold : Palette.stoneLight);
  }

  private drawUnsocket(): void {
    const can = this.selectedSlot !== null && this.tower !== null && this.tower.sockets[this.selectedSlot] !== null;
    this.unsocketBtn.setVisible(true).setFillStyle(can ? 0x3a1a1a : 0x1a1414);
    this.unsocketBtn.setStrokeStyle(2, can ? Palette.danger : Palette.stone);
    this.unsocketLabel.setColor(can ? "#e8e0d4" : "#8a8490");
  }

  private drawStats(resolved: ResolvedAttack): void {
    if (resolved.behaviour === "none") {
      this.statsText.setText("No Sigil — this frame is inert and will not fire.");
      return;
    }
    const lines = [
      `Damage  ${formatNum(resolved.damage)}    Rate  ${formatNum(resolved.attackRate)}/s    Range  ${resolved.range}`,
      `Projectiles  ${resolved.projectileCount}    Chain  ${resolved.chainCount}    Pierce  ${resolved.pierceCount}` +
        (resolved.convertToCold > 0 ? `    Cold  ${Math.round(resolved.convertToCold * 100)}%` : ""),
    ];
    this.statsText.setText(lines.join("\n"));
  }

  private drawInventory(): void {
    const items = this.handlers.inventory();
    const maxPage = Math.max(0, Math.ceil(items.length / INV_PAGE) - 1);
    if (this.invPage > maxPage) this.invPage = maxPage;
    const start = this.invPage * INV_PAGE;
    const showPager = items.length > INV_PAGE;
    this.prevBtn.setVisible(showPager);
    this.nextBtn.setVisible(showPager);
    this.prevLabel.setVisible(showPager);
    this.nextLabel.setVisible(showPager);
    this.prevBtn.setStrokeStyle(2, this.invPage > 0 ? Palette.goldDim : Palette.stone);
    this.nextBtn.setStrokeStyle(2, this.invPage < maxPage ? Palette.goldDim : Palette.stone);

    for (let i = 0; i < INV_PAGE; i++) {
      const view = this.invViews[i];
      const gem = items[start + i];
      if (!view) continue;
      if (!gem) {
        view.box.setVisible(false);
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      view.box.setVisible(true);
      this.refreshInvStroke(i);
      view.chip.setVisible(true).setFillStyle(gemColor(gem), 1);
      const kind = gem.kind === "sigil" ? "Sigil" : "Rune";
      view.label.setVisible(true).setText(`${gemName(gem)}\n${kind}  L${gem.level}  ${gem.xp} xp`);
    }
  }

  private refreshInvStroke(pageIndex: number): void {
    const view = this.invViews[pageIndex];
    if (!view || !view.box.visible) return;
    const items = this.handlers.inventory();
    const gem = items[this.invPage * INV_PAGE + pageIndex];
    const selected = !!gem && gem.uid === this.selectedUid;
    view.box.setStrokeStyle(selected ? 3 : 2, selected ? Palette.gold : Palette.stone);
  }

  private onSocketClick(slot: number): void {
    const tower = this.tower;
    if (!tower || slot >= tower.sockets.length) return;
    if (this.selectedUid) {
      this.handlers.socket(tower, slot, this.selectedUid);
      this.selectedUid = null;
      this.selectedSlot = null;
      this.refresh();
      return;
    }
    const gem = tower.sockets[slot];
    if (gem) {
      this.selectedSlot = this.selectedSlot === slot ? null : slot;
      this.refresh();
    } else {
      this.selectedSlot = null;
      this.refresh();
    }
  }

  private onUnsocket(): void {
    const tower = this.tower;
    if (!tower || this.selectedSlot === null) return;
    this.handlers.unsocket(tower, this.selectedSlot);
    this.selectedSlot = null;
    this.refresh();
  }

  private onInvClick(pageIndex: number): void {
    const items = this.handlers.inventory();
    const gem = items[this.invPage * INV_PAGE + pageIndex];
    if (!gem) return;
    this.selectedUid = this.selectedUid === gem.uid ? null : gem.uid;
    this.selectedSlot = null;
    this.refresh();
  }
}

function firstSigil(sockets: readonly (GemInstance | null)[]): GemInstance | null {
  for (let i = 0; i < sockets.length; i++) {
    const g = sockets[i];
    if (g && g.kind === "sigil") return g;
  }
  return null;
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function inRect(r: UiRect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

