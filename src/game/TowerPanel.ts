import Phaser from "phaser";
import { makeGem, type GemInstance } from "../data/items";
import { isRuneId, RUNES } from "../data/runes";
import { isSigilId, SIGILS } from "../data/sigils";
import { runeMatchesSigil, type ResolvedAttack } from "../data/stats";
import { TOWERS } from "../data/towers";
import { Palette } from "../palette";
import type { PlacedTower } from "./towerState";

const FONT = '14px Georgia, "Times New Roman", serif';
const FONT_SMALL = '12px Georgia, "Times New Roman", serif';
const FONT_TINY = '11px Georgia, "Times New Roman", serif';

const PANEL_W = 268;
const PANEL_H = 424;
const PANEL_X = 528;
const PANEL_Y = 120;
const MAX_SOCKETS = 6;
const MAX_INV = 12;

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
};

type InvView = {
  box: Phaser.GameObjects.Rectangle;
  chip: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class TowerPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly socketViews: SocketView[] = [];
  private readonly invViews: InvView[] = [];
  private tower: PlacedTower | null = null;
  private selectedUid: string | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly handlers: PanelHandlers,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];

    const bg = scene.add
      .rectangle(0, 0, PANEL_W, PANEL_H, Palette.panel, 0.94)
      .setStrokeStyle(1, Palette.panelEdge)
      .setOrigin(0, 0)
      .setInteractive();
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
    });
    children.push(bg);

    this.title = scene.add.text(12, 10, "", { font: FONT, color: "#e8c547" });
    children.push(this.title);

    const close = scene.add
      .text(PANEL_W - 22, 8, "×", { font: FONT, color: "#8a8490" })
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.hide();
    });
    children.push(close);

    children.push(scene.add.text(12, 32, "Inscription", { font: FONT_TINY, color: "#8a8490" }));

    for (let i = 0; i < MAX_SOCKETS; i++) {
      const x = 14 + (i % 3) * 82;
      const y = 50 + Math.floor(i / 3) * 56;
      const box = scene.add
        .rectangle(x, y, 76, 50, 0x1a161c, 1)
        .setStrokeStyle(1, Palette.stoneLight)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const chip = scene.add.rectangle(x + 14, y + 25, 12, 12, Palette.muted, 1).setVisible(false);
      const label = scene.add.text(x + 26, y + 8, "", { font: FONT_TINY, color: "#e8e0d4", wordWrap: { width: 48 } });
      const slot = i;
      box.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.onSocketClick(slot);
      });
      this.socketViews.push({ box, chip, label });
      children.push(box, chip, label);
    }

    this.statsText = scene.add.text(12, 168, "", { font: FONT_SMALL, color: "#e8e0d4", lineSpacing: 2 });
    children.push(this.statsText);

    children.push(scene.add.text(12, 236, "Inventory", { font: FONT_TINY, color: "#8a8490" }));

    for (let i = 0; i < MAX_INV; i++) {
      const y = 252 + i * 16;
      const box = scene.add
        .rectangle(12, y, PANEL_W - 24, 15, 0x161418, 1)
        .setStrokeStyle(1, Palette.stone)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      const chip = scene.add.rectangle(22, y + 7, 8, 8, Palette.muted, 1).setVisible(false);
      const label = scene.add.text(34, y + 1, "", { font: FONT_TINY, color: "#e8e0d4" }).setVisible(false);
      const index = i;
      box.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.onInvClick(index);
      });
      this.invViews.push({ box, chip, label });
      children.push(box, chip, label);
    }

    children.push(
      scene.add.text(12, PANEL_H - 18, "Click a gem, then a socket. Click a socket to unsocket.", {
        font: FONT_TINY,
        color: "#8a8490",
      }),
    );

    this.root = scene.add.container(PANEL_X, PANEL_Y, children);
    this.root.setDepth(30).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  get openTower(): PlacedTower | null {
    return this.tower;
  }

  contains(worldX: number, worldY: number): boolean {
    if (!this.root.visible) return false;
    return worldX >= PANEL_X && worldX <= PANEL_X + PANEL_W && worldY >= PANEL_Y && worldY <= PANEL_Y + PANEL_H;
  }

  show(tower: PlacedTower): void {
    this.tower = tower;
    this.selectedUid = null;
    this.root.setVisible(true);
    this.refresh();
  }

  hide(): void {
    this.tower = null;
    this.selectedUid = null;
    this.root.setVisible(false);
  }

  refresh(): void {
    if (!this.root.visible || !this.tower) return;
    const tower = this.tower;
    const def = TOWERS[tower.id];
    this.title.setText(def.name);
    this.drawSockets(tower, def.sockets);
    this.drawStats(tower.resolved);
    this.drawInventory();
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
      view.box.setStrokeStyle(1, this.selectedUid && gem?.uid === this.selectedUid ? Palette.gold : Palette.stoneLight);
      if (!gem) {
        view.chip.setVisible(false);
        view.label.setVisible(true).setColor("#8a8490").setText("empty");
        continue;
      }
      const runeTags = gem.kind === "rune" && isRuneId(gem.defId) ? RUNES[gem.defId].tags : [];
      const mismatch = gem.kind === "rune" && sigilDef ? !runeMatchesSigil(sigilDef.tags, runeTags) : false;
      view.chip.setVisible(true).setFillStyle(gemColor(gem), 1);
      view.label
        .setVisible(true)
        .setColor(mismatch ? "#8a8490" : "#e8e0d4")
        .setText(`${gemName(gem)}\nL${gem.level}${mismatch ? " off" : ""}`);
    }
  }

  private drawStats(resolved: ResolvedAttack): void {
    if (resolved.behaviour === "none") {
      this.statsText.setText("No Sigil — this frame is inert.");
      return;
    }
    const lines = [
      `Damage  ${formatNum(resolved.damage)}    Rate  ${formatNum(resolved.attackRate)}/s    Range  ${resolved.range}`,
      `Projectiles  ${resolved.projectileCount}    Chain  ${resolved.chainCount}    Pierce  ${resolved.pierceCount}`,
    ];
    if (resolved.behaviour === "nova") lines.push(`Nova radius  ${resolved.novaRadius}`);
    if (resolved.convertToCold > 0) lines.push(`Cold conversion  ${Math.round(resolved.convertToCold * 100)}%`);
    this.statsText.setText(lines.join("\n"));
  }

  private drawInventory(): void {
    const items = this.handlers.inventory();
    for (let i = 0; i < MAX_INV; i++) {
      const view = this.invViews[i];
      const gem = items[i];
      if (!view) continue;
      if (!gem) {
        view.box.setVisible(false);
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      const selected = gem.uid === this.selectedUid;
      view.box.setVisible(true).setStrokeStyle(1, selected ? Palette.gold : Palette.stone);
      view.chip.setVisible(true).setFillStyle(gemColor(gem), 1);
      const kind = gem.kind === "sigil" ? "Sigil" : "Rune";
      view.label.setVisible(true).setText(`${gemName(gem)}  ${kind}  L${gem.level}  ${gem.xp} xp`);
    }
  }

  private onSocketClick(slot: number): void {
    const tower = this.tower;
    if (!tower || slot >= tower.sockets.length) return;
    if (this.selectedUid) {
      this.handlers.socket(tower, slot, this.selectedUid);
      this.selectedUid = null;
      this.refresh();
      return;
    }
    const gem = tower.sockets[slot];
    if (gem) {
      this.handlers.unsocket(tower, slot);
      this.refresh();
    }
  }

  private onInvClick(index: number): void {
    const items = this.handlers.inventory();
    const gem = items[index];
    if (!gem) return;
    this.selectedUid = this.selectedUid === gem.uid ? null : gem.uid;
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
