import Phaser from "phaser";
import { isDepthUnlocked, livesForDepth, MAX_DEPTH, pointsForClear } from "../data/depths";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { getProfile } from "../data/profile";
import { Palette } from "../palette";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_BTN_SM, FONT_TITLE, type UiRect } from "./ui";

export class DepthSelect {
  private readonly root: Phaser.GameObjects.Container;
  private readonly marks: Phaser.GameObjects.Rectangle[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly boxes: Phaser.GameObjects.Rectangle[] = [];
  private readonly info: Phaser.GameObjects.Text;
  readonly depthRects: UiRect[] = [];
  readonly enterRect: UiRect;
  readonly closeRect: UiRect;
  private selected = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly onEnter: (depth: number) => void,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];
    children.push(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.overlay, 0.82));
    const w = 760;
    const h = 560;
    children.push(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, w, h, Palette.panel, 0.98).setStrokeStyle(2, Palette.goldDim));
    const left = (GAME_WIDTH - w) / 2;
    const top = (GAME_HEIGHT - h) / 2;
    children.push(scene.add.text(GAME_WIDTH / 2, top + 20, "Choose a Depth", { font: FONT_TITLE, color: "#e8c547" }).setOrigin(0.5, 0));
    this.info = scene.add.text(GAME_WIDTH / 2, top + 64, "", { font: FONT_BODY, color: "#e8e0d4" }).setOrigin(0.5, 0);
    children.push(this.info);

    const btnW = 128;
    const btnH = BTN_H;
    const gap = 12;
    const gridW = 5 * btnW + 4 * gap;
    const gx = (GAME_WIDTH - gridW) / 2;
    const gy = top + 120;
    for (let i = 0; i < MAX_DEPTH; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = gx + col * (btnW + gap);
      const y = gy + row * (btnH + gap);
      const rect = { x, y, w: btnW, h: btnH };
      this.depthRects.push(rect);
      const box = scene.add.rectangle(x + btnW / 2, y + btnH / 2, btnW, btnH, 0x1a161c, 1).setStrokeStyle(2, Palette.stoneLight);
      const label = scene.add.text(x + btnW / 2, y + btnH / 2, `Depth ${i + 1}`, { font: FONT_BTN_SM, color: "#e8e0d4" }).setOrigin(0.5);
      const mark = scene.add.rectangle(x + btnW / 2, y + btnH / 2, btnW, btnH).setStrokeStyle(3, Palette.gold).setFillStyle(0, 0).setVisible(false);
      this.boxes.push(box);
      this.labels.push(label);
      this.marks.push(mark);
      children.push(box, label, mark);
    }

    const enterW = 280;
    this.enterRect = { x: GAME_WIDTH / 2 - enterW / 2, y: top + h - 24 - BTN_H, w: enterW, h: BTN_H };
    children.push(
      scene.add.rectangle(GAME_WIDTH / 2, this.enterRect.y + BTN_H / 2, enterW, BTN_H, 0x2a2014, 1).setStrokeStyle(2, Palette.gold),
      scene.add.text(GAME_WIDTH / 2, this.enterRect.y + BTN_H / 2, "ENTER BREACH", { font: FONT_BTN, color: "#e8c547" }).setOrigin(0.5),
    );
    this.closeRect = { x: left + w - 16 - 140, y: top + 16, w: 140, h: 56 };
    children.push(
      scene.add.rectangle(this.closeRect.x + 70, this.closeRect.y + 28, 140, 56, 0x1a161c, 1).setStrokeStyle(2, Palette.goldDim),
      scene.add.text(this.closeRect.x + 70, this.closeRect.y + 28, "CLOSE", { font: FONT_BTN, color: "#e8c547" }).setOrigin(0.5),
    );
    this.root = scene.add.container(0, 0, children).setDepth(55).setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    const cleared = getProfile().highestDepthCleared;
    this.selected = Math.min(MAX_DEPTH, cleared + 1);
    this.root.setVisible(true);
    this.refresh();
  }

  hide(): void {
    this.root.setVisible(false);
  }

  handleTap(x: number, y: number): void {
    if (!this.root.visible) return;
    if (containsRect(this.closeRect, x, y)) {
      this.hide();
      return;
    }
    const cleared = getProfile().highestDepthCleared;
    for (let i = 0; i < this.depthRects.length; i++) {
      const r = this.depthRects[i];
      if (r && containsRect(r, x, y) && isDepthUnlocked(i + 1, cleared)) {
        this.selected = i + 1;
        this.refresh();
        return;
      }
    }
    if (containsRect(this.enterRect, x, y) && isDepthUnlocked(this.selected, cleared)) {
      this.hide();
      this.onEnter(this.selected);
    }
  }

  private refresh(): void {
    const cleared = getProfile().highestDepthCleared;
    this.info.setText(`Highest cleared  ${cleared}    ·    Lives ${livesForDepth(this.selected)}    ·    Clear grants ${pointsForClear(this.selected)} lattice point${pointsForClear(this.selected) === 1 ? "" : "s"}`);
    for (let i = 0; i < MAX_DEPTH; i++) {
      const open = isDepthUnlocked(i + 1, cleared);
      const on = this.selected === i + 1;
      this.boxes[i]?.setFillStyle(open ? 0x1a161c : 0x121014, 1).setStrokeStyle(2, open ? Palette.stoneLight : Palette.stone);
      this.labels[i]?.setColor(open ? "#e8e0d4" : "#5a5660").setText(open ? `Depth ${i + 1}` : "Locked");
      this.marks[i]?.setVisible(on);
    }
  }
}
