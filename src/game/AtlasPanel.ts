import Phaser from "phaser";
import {
  ATLAS_NODE_IDS,
  ATLAS_NODES,
  ATLAS_START_ID,
  getAtlasNode,
  isAtlasNodeCleared,
  isAtlasNodeUnlocked,
  type AtlasNodeDef,
} from "../data/atlas";
import { livesForDepth, pointsForClear } from "../data/depths";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { getMapLayout } from "../data/maps";
import { getProfile } from "../data/profile";
import { Palette } from "../palette";
import { applySprite } from "./sprites";
import { drawPathPreview } from "./drawMap";
import { UiButton } from "./UiButton";
import { BTN_H, FONT_BODY, FONT_BTN_SM, FONT_TITLE, setTreeInput, type UiRect } from "./ui";

const NODE_R = 48;

type NodeView = {
  def: AtlasNodeDef;
  rect: UiRect;
  zone: Phaser.GameObjects.Zone;
  disc: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image;
  caption: Phaser.GameObjects.Text;
};

/**
 * Simple Atlas: a data-driven graph of Breach nodes. Clearing a node unlocks
 * its neighbors. Depth rises farther from the Ash Gate.
 */
export class AtlasPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly lines: Phaser.GameObjects.Graphics;
  private readonly preview: Phaser.GameObjects.Graphics;
  private readonly infoTitle: Phaser.GameObjects.Text;
  private readonly infoBody: Phaser.GameObjects.Text;
  private readonly infoMeta: Phaser.GameObjects.Text;
  private readonly enter: UiButton;
  private readonly close: UiButton;
  private readonly views: NodeView[] = [];
  readonly nodeRects: Record<string, UiRect> = {};
  readonly enterRect: UiRect;
  readonly closeRect: UiRect;
  private selected = ATLAS_START_ID;

  constructor(
    scene: Phaser.Scene,
    private readonly onEnter: (nodeId: string) => void,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];
    children.push(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.88).setInteractive());
    children.push(
      scene.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 32, GAME_HEIGHT - 32, Palette.panel, 0.98)
        .setStrokeStyle(2, Palette.goldDim),
    );
    children.push(
      scene.add.text(GAME_WIDTH / 2, 28, "The Ember Atlas", { font: FONT_TITLE, color: "#e8c547" }).setOrigin(0.5, 0),
    );
    children.push(
      scene.add
        .text(GAME_WIDTH / 2, 64, "Clear a node to open the roads beside it. Depth rises the farther you go.", {
          font: FONT_BTN_SM,
          color: "#8a8490",
        })
        .setOrigin(0.5, 0),
    );

    this.lines = scene.add.graphics();
    children.push(this.lines);

    for (const id of ATLAS_NODE_IDS) {
      const def = ATLAS_NODES[id];
      if (!def) continue;
      const rect = { x: def.x - NODE_R, y: def.y - NODE_R, w: NODE_R * 2, h: NODE_R * 2 };
      this.nodeRects[id] = rect;
      const disc = scene.add.circle(def.x, def.y, 28, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight);
      const ring = scene.add.circle(def.x, def.y, 34, 0, 0).setStrokeStyle(3, Palette.gold).setVisible(false);
      const label = scene.add
        .text(def.x, def.y, String(def.depth), { font: FONT_TITLE, color: "#e8e0d4" })
        .setOrigin(0.5);
      const lock = scene.add.image(def.x, def.y, "ui-lock").setVisible(false);
      applySprite(lock, "ui-lock", 24);
      const caption = scene.add
        .text(def.x, def.y + 40, def.name, {
          font: FONT_BTN_SM,
          color: "#e8e0d4",
          align: "center",
          wordWrap: { width: 120 },
        })
        .setOrigin(0.5, 0);
      const zone = scene.add.zone(def.x, def.y, NODE_R * 2, NODE_R * 2).setInteractive({ useHandCursor: true });
      zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.select(def.id);
      });
      zone.on("pointerover", () => disc.setStrokeStyle(3, Palette.gold));
      zone.on("pointerout", () => this.refresh());
      this.views.push({ def, rect, zone, disc, ring, label, lock, caption });
      children.push(disc, ring, label, lock, caption, zone);
    }

    this.preview = scene.add.graphics();
    children.push(this.preview);
    this.infoTitle = scene.add.text(24, 540, "", { font: FONT_TITLE, color: "#e8c547" }).setOrigin(0, 0);
    this.infoBody = scene.add
      .text(24, 578, "", { font: FONT_BODY, color: "#e8e0d4", wordWrap: { width: 520 }, lineSpacing: 4 })
      .setOrigin(0, 0);
    this.infoMeta = scene.add.text(24, 700, "", { font: FONT_BTN_SM, color: "#c9a227" }).setOrigin(0, 0);
    children.push(this.infoTitle, this.infoBody, this.infoMeta);

    this.enter = new UiButton(scene, {
      x: GAME_WIDTH - 24 - 280,
      y: GAME_HEIGHT - 24 - BTN_H,
      w: 280,
      h: BTN_H,
      label: "ENTER BREACH",
      style: "emph",
      depth: 56,
      onClick: () => this.tryEnter(),
    });
    this.enterRect = this.enter.rect;
    this.close = new UiButton(scene, {
      x: GAME_WIDTH - 24 - 140,
      y: 24,
      w: 140,
      h: 56,
      label: "CLOSE",
      style: "normal",
      depth: 56,
      font: FONT_BTN_SM,
      onClick: () => this.hide(),
    });
    this.closeRect = this.close.rect;
    children.push(this.enter.root, this.close.root);

    this.root = scene.add.container(0, 0, children).setDepth(55).setVisible(false);
    this.enter.setVisible(false);
    this.close.setVisible(false);
    setTreeInput(this.root, false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  get selectedId(): string {
    return this.selected;
  }

  show(): void {
    const cleared = getProfile().clearedAtlasNodes;
    if (!isAtlasNodeUnlocked(this.selected, cleared)) this.selected = ATLAS_START_ID;
    this.root.setVisible(true);
    this.enter.setVisible(true);
    this.close.setVisible(true);
    setTreeInput(this.root, true);
    this.refresh();
  }

  hide(): void {
    this.root.setVisible(false);
    this.enter.setVisible(false);
    this.close.setVisible(false);
    setTreeInput(this.root, false);
  }

  handleTap(_x: number, _y: number): void {
    // Node, Enter, and Close use their own hit areas. Swallow other taps.
  }

  private select(id: string): void {
    this.selected = id;
    this.refresh();
  }

  private tryEnter(): void {
    const cleared = getProfile().clearedAtlasNodes;
    if (!isAtlasNodeUnlocked(this.selected, cleared)) return;
    const id = this.selected;
    this.hide();
    this.onEnter(id);
  }

  private refresh(): void {
    const cleared = getProfile().clearedAtlasNodes;
    this.lines.clear();
    const drawn = new Set<string>();
    for (const id of ATLAS_NODE_IDS) {
      const a = ATLAS_NODES[id];
      if (!a) continue;
      for (const nid of a.neighbors) {
        const key = a.id < nid ? `${a.id}|${nid}` : `${nid}|${a.id}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const b = ATLAS_NODES[nid];
        if (!b) continue;
        const open = isAtlasNodeUnlocked(a.id, cleared) && isAtlasNodeUnlocked(b.id, cleared);
        this.lines.lineStyle(open ? 3 : 2, open ? Palette.goldDim : Palette.stone, open ? 0.85 : 0.45);
        this.lines.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    for (const view of this.views) {
      const open = isAtlasNodeUnlocked(view.def.id, cleared);
      const done = isAtlasNodeCleared(view.def.id, cleared);
      const on = this.selected === view.def.id;
      view.disc.setFillStyle(done ? 0x2a2014 : open ? 0x1a161c : 0x121014, 1);
      view.disc.setStrokeStyle(2, done ? Palette.gold : open ? Palette.stoneLight : Palette.stone);
      view.label.setColor(open ? (done ? "#e8c547" : "#e8e0d4") : "#5a5660");
      view.caption.setColor(open ? "#e8e0d4" : "#5a5660");
      view.lock.setVisible(!open);
      view.label.setVisible(open);
      view.ring.setVisible(on);
      if (view.zone.input) view.zone.input.cursor = "pointer";
    }

    const def = getAtlasNode(this.selected);
    const layout = getMapLayout(def.layoutId);
    const open = isAtlasNodeUnlocked(def.id, cleared);
    const done = isAtlasNodeCleared(def.id, cleared);
    const pts = pointsForClear(def.depth);
    this.infoTitle.setText(open ? def.name : "Locked road");
    this.infoBody.setText(
      open
        ? `${def.flavor}\n${layout.name}  ·  ${layout.flavor}`
        : "Clear a neighboring node to open this road.",
    );
    this.infoMeta.setText(
      open
        ? `Depth ${def.depth}    ·    Lives ${livesForDepth(def.depth)}    ·    Clear grants ${pts} lattice point${pts === 1 ? "" : "s"}${done ? "    ·    Cleared" : ""}`
        : `Depth ${def.depth}  ·  locked`,
    );
    drawPathPreview(this.preview, layout, 560, 540, 200, 140);
    this.preview.setVisible(open);
    this.enter.setEnabled(open);
  }
}
