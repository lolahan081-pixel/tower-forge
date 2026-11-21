import Phaser from "phaser";
import {
  canAllocate,
  describeMods,
  LATTICE_EDGES,
  LATTICE_NODES,
  LATTICE_START,
  tryAllocate,
  type LatticeKind,
  type LatticeNodeDef,
} from "../data/lattice";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { getProfile } from "../data/profile";
import { Palette } from "../palette";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN_SM, FONT_HUD, type UiRect } from "./ui";

const TOP = 16 + BTN_H + 16 + BTN_H + 20;
const VIEW: UiRect = { x: 40, y: TOP + 88, w: GAME_WIDTH - 80, h: GAME_HEIGHT - TOP - 88 - 110 };

function nodeRadius(kind: LatticeKind): number {
  if (kind === "keystone") return 44;
  if (kind === "notable") return 38;
  return 34;
}

function regionFill(node: LatticeNodeDef, allocated: boolean): number {
  if (!allocated) return Palette.stone;
  switch (node.region) {
    case "spire":
      return Palette.ember;
    case "font":
      return Palette.blood;
    case "totem":
      return Palette.cold;
    case "economy":
      return Palette.goldDim;
    default:
      return Palette.gold;
  }
}

function regionStroke(node: LatticeNodeDef, allocated: boolean, allocatable: boolean): number {
  if (allocated) return Palette.goldBright;
  if (allocatable) return Palette.gold;
  if (node.kind === "keystone") return Palette.emberHot;
  if (node.kind === "notable") return Palette.goldDim;
  return Palette.stoneLight;
}

type NodeView = {
  def: LatticeNodeDef;
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

export class LatticePanel {
  readonly root: Phaser.GameObjects.Container;
  readonly viewRect = VIEW;
  private readonly graph: Phaser.GameObjects.Container;
  private readonly edges: Phaser.GameObjects.Graphics;
  private readonly pointsText: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly nodes: NodeView[] = [];
  private panX = 0;
  private panY = 40;
  private dragging = false;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private selected: string | null = LATTICE_START;

  constructor(scene: Phaser.Scene) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const panel = scene.add
      .rectangle(24, TOP, GAME_WIDTH - 48, GAME_HEIGHT - TOP - 24, Palette.panel, 0.96)
      .setStrokeStyle(2, Palette.panelEdge)
      .setOrigin(0, 0);
    children.push(panel);
    children.push(scene.add.text(44, TOP + 16, "Ember Lattice", { font: FONT_HUD, color: "#e8c547" }));
    this.pointsText = scene.add.text(GAME_WIDTH - 44, TOP + 20, "", { font: FONT_BTN_SM, color: "#e8e0d4" }).setOrigin(1, 0);
    children.push(this.pointsText);
    children.push(
      scene.add.text(44, TOP + 52, "Drag to pan. Tap an adjacent ember to bind it. Unbinding Tear refunds the Lattice.", {
        font: FONT_BTN_SM,
        color: "#8a8490",
        wordWrap: { width: GAME_WIDTH - 88 },
      }),
    );

    const maskShape = scene.add.rectangle(VIEW.x, VIEW.y, VIEW.w, VIEW.h, 0x000000, 0).setOrigin(0, 0);
    children.push(maskShape);
    const frame = scene.add
      .rectangle(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2, VIEW.w, VIEW.h)
      .setStrokeStyle(1, Palette.panelEdge)
      .setFillStyle(0x0a090c, 0.35);
    children.push(frame);

    this.edges = scene.add.graphics();
    this.graph = scene.add.container(this.originX, this.originY, [this.edges]);
    for (const def of Object.values(LATTICE_NODES)) {
      const r = nodeRadius(def.kind);
      const circle = scene.add.circle(def.x, def.y, r, Palette.stone, 1);
      const ring = scene.add.circle(def.x, def.y, r, 0, 0).setStrokeStyle(3, Palette.stoneLight);
      const label = scene.add
        .text(def.x, def.y + r + 4, def.name, {
          font: "11px sans-serif",
          color: "#8a8490",
          align: "center",
          wordWrap: { width: 120 },
        })
        .setOrigin(0.5, 0);
      this.graph.add([circle, ring, label]);
      this.nodes.push({ def, circle, ring, label });
    }
    this.graph.setMask(maskShape.createGeometryMask());
    children.push(this.graph);

    this.detail = scene.add.text(44, VIEW.y + VIEW.h + 10, "", {
      font: FONT_BTN_SM,
      color: "#e8e0d4",
      wordWrap: { width: GAME_WIDTH - 88 },
      lineSpacing: 3,
    });
    children.push(this.detail);
    this.message = scene.add.text(44, GAME_HEIGHT - 40, "", { font: FONT_BODY, color: "#c9a227" });
    children.push(this.message);

    this.root = scene.add.container(0, 0, children).setVisible(false);
    this.refresh();
  }

  private get originX(): number {
    return VIEW.x + VIEW.w / 2 + this.panX;
  }

  private get originY(): number {
    return VIEW.y + VIEW.h / 2 + this.panY;
  }

  handleDown(x: number, y: number): boolean {
    if (!this.root.visible || !containsRect(VIEW, x, y)) return false;
    this.dragging = true;
    this.moved = false;
    this.lastX = x;
    this.lastY = y;
    return true;
  }

  handleMove(x: number, y: number): boolean {
    if (!this.dragging) return false;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    if (!this.moved && dx * dx + dy * dy < 64) return true;
    this.moved = true;
    this.panX += dx;
    this.panY += dy;
    this.clampPan();
    this.lastX = x;
    this.lastY = y;
    this.graph.setPosition(this.originX, this.originY);
    return true;
  }

  handleUp(x: number, y: number): boolean {
    const wasDragging = this.dragging;
    const wasMoved = this.moved;
    this.dragging = false;
    this.moved = false;
    if (!this.root.visible || !containsRect(VIEW, x, y)) return wasDragging;
    if (wasMoved) return true;
    const hit = this.hitNode(x, y);
    if (!hit) return wasDragging;
    this.selected = hit.id;
    const profile = getProfile();
    if (canAllocate(hit.id, profile.allocatedNodes, profile.unspentPoints)) {
      const result = tryAllocate(hit.id);
      this.message.setText(result.ok ? `Bound  ${hit.name}.` : result.reason);
    } else if (profile.allocatedNodes.includes(hit.id)) {
      this.message.setText(`${hit.name}  is already bound.`);
    } else if (profile.unspentPoints <= 0) {
      this.message.setText("No unspent points. Clear a Depth or use an Unbinding Tear.");
    } else {
      this.message.setText("Bind an adjacent ember first.");
    }
    this.refresh();
    return true;
  }

  refresh(): void {
    const profile = getProfile();
    const allocated = profile.allocatedNodes;
    this.pointsText.setText(`${profile.unspentPoints} unspent    ·    ${allocated.length} bound`);
    this.edges.clear();
    this.edges.lineStyle(3, Palette.stoneLight, 0.7);
    for (const [a, b] of LATTICE_EDGES) {
      const na = LATTICE_NODES[a];
      const nb = LATTICE_NODES[b];
      if (!na || !nb) continue;
      const lit = allocated.includes(a) && allocated.includes(b);
      this.edges.lineStyle(lit ? 4 : 3, lit ? Palette.gold : Palette.stoneLight, lit ? 0.95 : 0.55);
      this.edges.lineBetween(na.x, na.y, nb.x, nb.y);
    }
    for (const view of this.nodes) {
      const alloc = allocated.includes(view.def.id);
      const open = canAllocate(view.def.id, allocated, profile.unspentPoints);
      const r = nodeRadius(view.def.kind);
      view.circle.setFillStyle(regionFill(view.def, alloc), 1);
      view.ring.setStrokeStyle(view.def.id === this.selected ? 4 : 3, regionStroke(view.def, alloc, open));
      view.ring.setRadius(r);
      view.label.setColor(alloc || open ? "#e8e0d4" : "#8a8490");
    }
    this.graph.setPosition(this.originX, this.originY);
    const node = (this.selected && LATTICE_NODES[this.selected]) || LATTICE_NODES[LATTICE_START];
    if (node) {
      const kind = node.kind === "small" ? "ember" : node.kind;
      const scope = node.tags.length > 0 ? `    ·    ${node.tags.join(", ")}` : "    ·    all frames";
      this.detail.setText(`${node.name}    ·    ${kind}${scope}\n${describeMods(node.mods)}    ·    ${node.blurb}`);
    }
  }

  nodeRects(): Record<string, UiRect> {
    const rects: Record<string, UiRect> = {};
    const ox = this.originX;
    const oy = this.originY;
    for (const view of this.nodes) {
      const r = nodeRadius(view.def.kind);
      rects[view.def.id] = { x: ox + view.def.x - r, y: oy + view.def.y - r, w: r * 2, h: r * 2 };
    }
    return rects;
  }

  private clampPan(): void {
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const def of Object.values(LATTICE_NODES)) {
      if (def.x < minX) minX = def.x;
      if (def.x > maxX) maxX = def.x;
      if (def.y < minY) minY = def.y;
      if (def.y > maxY) maxY = def.y;
    }
    const pad = 80;
    const maxPanX = -minX + VIEW.w / 2 - pad;
    const minPanX = -maxX - VIEW.w / 2 + pad;
    const maxPanY = -minY + VIEW.h / 2 - pad;
    const minPanY = -maxY - VIEW.h / 2 + pad;
    this.panX = Math.min(maxPanX, Math.max(minPanX, this.panX));
    this.panY = Math.min(maxPanY, Math.max(minPanY, this.panY));
  }

  private hitNode(x: number, y: number): LatticeNodeDef | null {
    const lx = x - this.originX;
    const ly = y - this.originY;
    let best: LatticeNodeDef | null = null;
    let bestD = Infinity;
    for (const view of this.nodes) {
      const r = nodeRadius(view.def.kind) + 8;
      const dx = lx - view.def.x;
      const dy = ly - view.def.y;
      const d = dx * dx + dy * dy;
      if (d <= r * r && d < bestD) {
        best = view.def;
        bestD = d;
      }
    }
    return best;
  }
}

