import Phaser from "phaser";
import type { GemInstance } from "../data/items";
import { GAME_WIDTH, MAP_ROWS, TILE_SIZE } from "../data/map";
import { isSigilId, SIGILS } from "../data/sigils";
import { sigilFitsFrame } from "../data/stats";
import { sellRefund, TOWERS } from "../data/towers";
import { Palette } from "../palette";
import { gemColor, gemIcon, gemName } from "./gems";
import { addIcon, setIcon } from "./sprites";
import type { PlacedTower } from "./towerState";
import { UiButton } from "./UiButton";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_BTN_SM, FONT_HUD, MENU_BTN_H, popIn, type UiRect } from "./ui";

const PANEL_W = 320;
const PANEL_H = 400;
const PICK_W = 400;
const PICK_H = 460;
const CLOSE_W = 96;
const CLOSE_H = 90;
const MARGIN = 8;
const BOARD_H = MAP_ROWS * TILE_SIZE;
const INV_MAX = 6;

type Handlers = {
  inventory: () => GemInstance[];
  swap: (tower: PlacedTower, uid: string) => boolean;
  unsocket: (tower: PlacedTower) => boolean;
  sell: (tower: PlacedTower) => boolean;
};

type PickCell = {
  box: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
  rect: UiRect;
};

export class TowerPanel {
  private readonly scene: Phaser.Scene;
  private readonly inspect: Phaser.GameObjects.Container;
  private readonly picker: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sigilHit: Phaser.GameObjects.Rectangle;
  private readonly sigilIcon: Phaser.GameObjects.Image;
  private readonly sigilName: Phaser.GameObjects.Text;
  private readonly sigilHint: Phaser.GameObjects.Text;
  private readonly statLabels: Phaser.GameObjects.Text;
  private readonly statValues: Phaser.GameObjects.Text;
  private readonly changeBtn: UiButton;
  private readonly sellBtn: UiButton;
  private readonly closeBtn: UiButton;
  private readonly pickClose: UiButton;
  private readonly removeBtn: UiButton;
  private readonly pickCells: PickCell[] = [];
  private readonly changeRect: UiRect = { x: 14, y: PANEL_H - 12 - BTN_H, w: 142, h: BTN_H };
  private readonly sellLocal: UiRect = { x: 164, y: PANEL_H - 12 - BTN_H, w: 142, h: BTN_H };
  private readonly closeLocal: UiRect = { x: PANEL_W - 12 - CLOSE_W, y: 10, w: CLOSE_W, h: CLOSE_H };
  private readonly sigilLocal: UiRect = { x: 14, y: 110, w: PANEL_W - 28, h: 64 };
  private readonly pickCloseLocal: UiRect = { x: PICK_W - 12 - CLOSE_W, y: 10, w: CLOSE_W, h: CLOSE_H };
  private readonly removeLocal: UiRect = { x: 14, y: PICK_H - 12 - BTN_H, w: PICK_W - 28, h: BTN_H };
  private px = 0;
  private py = 0;
  private pickX = 0;
  private pickY = 0;
  private tower: PlacedTower | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly handlers: Handlers,
  ) {
    this.scene = scene;

    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, Palette.panel, 0.97).setStrokeStyle(2, Palette.goldDim).setOrigin(0, 0);
    this.title = scene.add.text(14, 36, "", { font: FONT_HUD, color: "#e8c547" });
    this.closeBtn = new UiButton(scene, {
      x: this.closeLocal.x,
      y: this.closeLocal.y,
      w: this.closeLocal.w,
      h: this.closeLocal.h,
      label: "X",
      depth: 51,
      font: FONT_BTN,
      onClick: () => this.hide(),
    });
    this.sigilHit = scene.add
      .rectangle(this.sigilLocal.x, this.sigilLocal.y, this.sigilLocal.w, this.sigilLocal.h, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.sigilIcon = addIcon(scene, this.sigilLocal.x + 28, this.sigilLocal.y + this.sigilLocal.h / 2, "gem-chip", 28);
    this.sigilName = scene.add.text(this.sigilLocal.x + 52, this.sigilLocal.y + 10, "", { font: FONT_BTN, color: "#e8e0d4" });
    this.sigilHint = scene.add.text(this.sigilLocal.x + 52, this.sigilLocal.y + 34, "", { font: FONT_BTN_SM, color: "#c9a227" });
    this.sigilHit.on("pointerover", () => this.sigilHit.setStrokeStyle(2, Palette.gold));
    this.sigilHit.on("pointerout", () => this.sigilHit.setStrokeStyle(2, Palette.stoneLight));
    this.statLabels = scene.add.text(16, 190, "Damage per second\nRange\nAttacks per second", {
      font: FONT_BODY,
      color: "#8a8490",
      lineSpacing: 8,
    });
    this.statValues = scene.add
      .text(PANEL_W - 16, 190, "", { font: FONT_BODY, color: "#e8e0d4", align: "right", lineSpacing: 8 })
      .setOrigin(1, 0);
    this.changeBtn = new UiButton(scene, {
      x: this.changeRect.x,
      y: this.changeRect.y,
      w: this.changeRect.w,
      h: this.changeRect.h,
      label: "CHANGE",
      depth: 51,
      onClick: () => this.openPicker(),
    });
    this.sellBtn = new UiButton(scene, {
      x: this.sellLocal.x,
      y: this.sellLocal.y,
      w: this.sellLocal.w,
      h: this.sellLocal.h,
      label: "SELL",
      style: "danger",
      depth: 51,
      onClick: () => {
        if (this.tower) this.handlers.sell(this.tower);
      },
    });
    this.inspect = scene.add
      .container(0, 0, [bg, this.title, this.closeBtn.root, this.sigilHit, this.sigilIcon, this.sigilName, this.sigilHint, this.statLabels, this.statValues, this.changeBtn.root, this.sellBtn.root])
      .setDepth(50)
      .setVisible(false);

    const pbg = scene.add.rectangle(0, 0, PICK_W, PICK_H, Palette.panel, 0.98).setStrokeStyle(2, Palette.gold).setOrigin(0, 0);
    const ptitle = scene.add.text(14, 36, "Choose a Sigil", { font: FONT_HUD, color: "#e8c547" });
    this.pickClose = new UiButton(scene, {
      x: this.pickCloseLocal.x,
      y: this.pickCloseLocal.y,
      w: this.pickCloseLocal.w,
      h: this.pickCloseLocal.h,
      label: "X",
      depth: 61,
      onClick: () => this.closePicker(),
    });
    const cellW = (PICK_W - 28 - 10) / 2;
    const cellH = 64;
    const gridTop = 110;
    for (let i = 0; i < INV_MAX; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 14 + col * (cellW + 10);
      const y = gridTop + row * (cellH + 8);
      const box = scene.add.rectangle(x, y, cellW, cellH, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const icon = addIcon(scene, x + 22, y + cellH / 2, "gem-chip", 24).setVisible(false);
      const label = scene.add.text(x + 42, y + 16, "", { font: FONT_BTN_SM, color: "#e8e0d4", wordWrap: { width: cellW - 50 } });
      const mark = scene.add.text(x + 42, y + 42, "", { font: FONT_BTN_SM, color: "#e8c547" });
      box.on("pointerover", () => {
        if (box.visible) box.setStrokeStyle(2, Palette.gold);
      });
      box.on("pointerout", () => box.setStrokeStyle(2, Palette.stoneLight));
      this.pickCells.push({ box, icon, label, mark, rect: { x, y, w: cellW, h: cellH } });
    }
    this.removeBtn = new UiButton(scene, {
      x: this.removeLocal.x,
      y: this.removeLocal.y,
      w: this.removeLocal.w,
      h: this.removeLocal.h,
      label: "REMOVE SIGIL",
      style: "danger",
      depth: 61,
      onClick: () => {
        if (this.tower) this.handlers.unsocket(this.tower);
        this.closePicker();
      },
    });
    const pickKids: Phaser.GameObjects.GameObject[] = [pbg, ptitle, this.pickClose.root];
    for (const c of this.pickCells) pickKids.push(c.box, c.icon, c.label, c.mark);
    pickKids.push(this.removeBtn.root);
    this.picker = scene.add.container(0, 0, pickKids).setDepth(60).setVisible(false);
    this.setInspectInput(false);
    this.setPickerInput(false);
  }

  get visible(): boolean {
    return this.inspect.visible || this.picker.visible;
  }

  get openTower(): PlacedTower | null {
    return this.tower;
  }

  contains(worldX: number, worldY: number): boolean {
    if (this.picker.visible && this.inPicker(worldX, worldY)) return true;
    if (this.inspect.visible && this.inInspect(worldX, worldY)) return true;
    return false;
  }

  handleTap(worldX: number, worldY: number): void {
    if (!this.visible) return;
    if (this.picker.visible) {
      if (containsRect(this.world(this.pickX, this.pickY, this.pickCloseLocal), worldX, worldY)) {
        this.closePicker();
        return;
      }
      if (this.removeBtn.visible && containsRect(this.world(this.pickX, this.pickY, this.removeLocal), worldX, worldY)) {
        if (this.tower) this.handlers.unsocket(this.tower);
        this.closePicker();
        return;
      }
      const items = this.handlers.inventory();
      for (let i = 0; i < this.pickCells.length; i++) {
        const cell = this.pickCells[i];
        const gem = items[i];
        if (!cell || !gem || !cell.box.visible) continue;
        if (containsRect(this.world(this.pickX, this.pickY, cell.rect), worldX, worldY) && this.tower) {
          this.handlers.swap(this.tower, gem.uid);
          this.closePicker();
          return;
        }
      }
      if (!this.inPicker(worldX, worldY)) this.closePicker();
      return;
    }
    if (containsRect(this.world(this.px, this.py, this.closeLocal), worldX, worldY)) {
      this.hide();
      return;
    }
    if (containsRect(this.world(this.px, this.py, this.changeRect), worldX, worldY) || containsRect(this.world(this.px, this.py, this.sigilLocal), worldX, worldY)) {
      this.openPicker();
      return;
    }
    if (containsRect(this.world(this.px, this.py, this.sellLocal), worldX, worldY)) {
      if (this.tower) this.handlers.sell(this.tower);
      return;
    }
    if (!this.inInspect(worldX, worldY)) this.hide();
  }

  show(tower: PlacedTower): void {
    this.tower = tower;
    this.picker.setVisible(false);
    this.setPickerInput(false);
    this.layoutAround(tower);
    this.inspect.setVisible(true);
    this.setInspectInput(true);
    popIn(this.scene, this.inspect, this.px, this.py);
    this.refresh();
  }

  hide(): void {
    this.tower = null;
    this.inspect.setVisible(false);
    this.picker.setVisible(false);
    this.setInspectInput(false);
    this.setPickerInput(false);
  }

  refresh(): void {
    if (!this.tower || !this.inspect.visible) return;
    const tower = this.tower;
    const def = TOWERS[tower.id];
    this.title.setText(def.name);
    const refund = sellRefund(def.cost);
    this.sellBtn.setLabel(`SELL  ${refund}`);
    const sigil = tower.sockets[0] && tower.sockets[0].kind === "sigil" ? tower.sockets[0] : null;
    if (sigil) {
      this.sigilIcon.setVisible(true);
      setIcon(this.sigilIcon, gemIcon(sigil), gemColor(sigil), 28);
      this.sigilName.setColor("#e8e0d4").setText(gemName(sigil));
      this.sigilHint.setColor("#8a8490").setText(`Level ${sigil.level}  ·  Tap to change`);
    } else {
      this.sigilIcon.setVisible(false);
      this.sigilName.setColor("#e8c547").setText("Tap to choose a Sigil");
      this.sigilHint.setColor("#c9a227").setText("This frame will not fire until it has one.");
    }
    const r = tower.resolved;
    const dps = Math.round(r.damage * r.attackRate * 10) / 10;
    const rate = Math.round(r.attackRate * 100) / 100;
    if (r.behaviour === "none") this.statValues.setText("—\n—\n—");
    else this.statValues.setText(`${dps}\n${r.range}\n${rate}`);
    if (this.picker.visible) this.refreshPicker();
  }

  rects(): {
    close: UiRect;
    unsocket: UiRect;
    currentSigil: UiRect;
    inventory: UiRect[];
    runes: UiRect[];
    changeSigil: UiRect;
    sell: UiRect;
    picker: { close: UiRect; remove: UiRect | null; cells: UiRect[] } | null;
  } {
    const items = this.handlers.inventory();
    const cells: UiRect[] = [];
    if (this.picker.visible) {
      for (let i = 0; i < this.pickCells.length; i++) {
        const cell = this.pickCells[i];
        if (cell && items[i] && cell.box.visible) cells.push(this.world(this.pickX, this.pickY, cell.rect));
      }
    }
    return {
      close: this.world(this.px, this.py, this.closeLocal),
      unsocket: this.picker.visible ? this.world(this.pickX, this.pickY, this.removeLocal) : { x: 0, y: 0, w: 0, h: 0 },
      currentSigil: this.world(this.px, this.py, this.sigilLocal),
      inventory: cells,
      runes: [],
      changeSigil: this.world(this.px, this.py, this.changeRect),
      sell: this.world(this.px, this.py, this.sellLocal),
      picker: this.picker.visible
        ? {
            close: this.world(this.pickX, this.pickY, this.pickCloseLocal),
            remove: this.removeBtn.visible ? this.world(this.pickX, this.pickY, this.removeLocal) : null,
            cells,
          }
        : null,
    };
  }

  private openPicker(): void {
    if (!this.tower) return;
    this.inspect.setVisible(false);
    this.setInspectInput(false);
    this.pickX = Math.round((GAME_WIDTH - PICK_W) / 2);
    this.pickY = Math.max(MENU_BTN_H + MARGIN, Math.round((BOARD_H - PICK_H) / 2));
    this.picker.setVisible(true);
    this.setPickerInput(true);
    popIn(this.scene, this.picker, this.pickX, this.pickY);
    this.refreshPicker();
  }

  private closePicker(): void {
    this.picker.setVisible(false);
    this.setPickerInput(false);
    if (!this.tower) return;
    this.layoutAround(this.tower);
    this.inspect.setVisible(true);
    this.setInspectInput(true);
    this.refresh();
  }

  private refreshPicker(): void {
    if (!this.tower) return;
    const tower = this.tower;
    const frameTags = TOWERS[tower.id].tags;
    const equipped = tower.sockets[0];
    const items = this.handlers.inventory();
    for (let i = 0; i < this.pickCells.length; i++) {
      const cell = this.pickCells[i];
      if (!cell) continue;
      const gem = items[i];
      if (!gem) {
        cell.box.setVisible(false);
        cell.icon.setVisible(false);
        cell.label.setVisible(false);
        cell.mark.setVisible(false);
        continue;
      }
      const fit = gem.kind === "sigil" && isSigilId(gem.defId) && sigilFitsFrame(SIGILS[gem.defId].tags, frameTags);
      const eq = equipped != null && equipped.uid === gem.uid;
      cell.box.setVisible(true).setStrokeStyle(2, eq ? Palette.gold : Palette.stoneLight).setAlpha(fit ? 1 : 0.55);
      cell.icon.setVisible(true);
      setIcon(cell.icon, gemIcon(gem), gemColor(gem), 24);
      cell.label.setVisible(true).setColor(fit ? "#e8e0d4" : "#8a8490").setText(gemName(gem));
      cell.mark.setVisible(true).setColor(eq ? "#e8c547" : fit ? "#8a8490" : "#8a8490").setText(eq ? "Equipped" : fit ? `Level ${gem.level}` : "Won't fit");
    }
    const has = !!(equipped && equipped.kind === "sigil");
    this.removeBtn.setVisible(has);
    this.removeBtn.setEnabled(has);
  }

  private layoutAround(tower: PlacedTower): void {
    let x = Math.round(tower.x + 36);
    let y = Math.round(tower.y - PANEL_H / 2);
    if (x + PANEL_W > GAME_WIDTH - MARGIN) x = Math.round(tower.x - 36 - PANEL_W);
    if (x < MARGIN) x = MARGIN;
    const top = MENU_BTN_H + MARGIN;
    const bottom = BOARD_H - MARGIN;
    if (y < top) y = top;
    if (y + PANEL_H > bottom) y = bottom - PANEL_H;
    this.px = x;
    this.py = y;
    this.inspect.setPosition(x, y);
  }

  private world(ox: number, oy: number, r: UiRect): UiRect {
    return { x: ox + r.x, y: oy + r.y, w: r.w, h: r.h };
  }

  private inInspect(x: number, y: number): boolean {
    return x >= this.px && x <= this.px + PANEL_W && y >= this.py && y <= this.py + PANEL_H;
  }

  private inPicker(x: number, y: number): boolean {
    return x >= this.pickX && x <= this.pickX + PICK_W && y >= this.pickY && y <= this.pickY + PICK_H;
  }

  private setInspectInput(on: boolean): void {
    this.closeBtn.setVisible(on);
    this.changeBtn.setVisible(on);
    this.sellBtn.setVisible(on);
    if (this.sigilHit.input) this.sigilHit.input.enabled = on;
  }

  private setPickerInput(on: boolean): void {
    this.pickClose.setVisible(on);
    if (!on) this.removeBtn.setVisible(false);
    for (const c of this.pickCells) {
      if (c.box.input) c.box.input.enabled = on;
    }
  }
}
