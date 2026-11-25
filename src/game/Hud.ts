import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, MAP_ROWS, TILE_SIZE, type GridPos } from "../data/map";
import { TOWERS, TOWER_IDS, type TowerId } from "../data/towers";
import { Palette } from "../palette";
import { UiButton } from "./UiButton";
import { BTN_H, FONT_BTN, FONT_BTN_SM, FONT_HUD, FONT_TITLE, type UiRect } from "./ui";

const HUD_Y = MAP_ROWS * TILE_SIZE;

export class Hud {
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly startBtn: UiButton;
  private readonly inscribeBtn: UiButton;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly overlayText: Phaser.GameObjects.Text;
  private readonly returnBtn: UiButton;
  private readonly menuEndBtn: UiButton;
  private readonly selectMarks: Phaser.GameObjects.Rectangle[] = [];
  private readonly towerRects: Record<string, UiRect> = {};
  private readonly towerBoxes: Phaser.GameObjects.Rectangle[] = [];
  readonly startRect: UiRect;
  readonly inscribeRect: UiRect;
  readonly returnRect: UiRect;
  readonly menuRect: UiRect;
  readonly menuEndRect: UiRect;

  constructor(
    scene: Phaser.Scene,
    onSelect: (id: TowerId) => void,
    onStart: () => void,
    onInscribe: () => void,
    onReturn: () => void,
    onMenu: () => void,
  ) {
    const style = { font: FONT_HUD, color: "#e8e0d4" };
    this.goldText = scene.add.text(16, HUD_Y + 6, "", style).setDepth(20);
    this.livesText = scene.add.text(200, HUD_Y + 6, "", style).setDepth(20);
    this.waveText = scene.add.text(390, HUD_Y + 6, "", style).setDepth(20);

    const menuW = 160;
    this.menuRect = { x: 16, y: 8, w: menuW, h: BTN_H };
    new UiButton(scene, {
      x: 16,
      y: 8,
      w: menuW,
      h: BTN_H,
      label: "MENU",
      depth: 30,
      onClick: onMenu,
    });

    const btnY = HUD_Y + 28;
    const gap = 10;
    const towerW = 220;
    const actW = 180;
    let x = 16;
    for (const id of TOWER_IDS) {
      const def = TOWERS[id];
      const cx = x + towerW / 2;
      const cy = btnY + BTN_H / 2;
      const box = scene.add
        .rectangle(cx, cy, towerW, BTN_H, 0x161418, 1)
        .setStrokeStyle(2, Palette.stoneLight)
        .setDepth(19)
        .setInteractive({ useHandCursor: true });
      scene.add.image(x + 28, cy, id).setDepth(20);
      scene.add.text(x + 50, cy - 20, def.name, { font: FONT_BTN, color: "#e8e0d4" }).setDepth(20);
      scene.add.text(x + 50, cy + 8, `${def.cost} gold`, { font: FONT_BTN_SM, color: "#c9a227" }).setDepth(20);
      const mark = scene.add
        .rectangle(cx, cy, towerW, BTN_H)
        .setStrokeStyle(3, Palette.gold)
        .setFillStyle(0, 0)
        .setDepth(21)
        .setVisible(false);
      this.selectMarks.push(mark);
      this.towerRects[id] = { x, y: btnY, w: towerW, h: BTN_H };
      this.towerBoxes.push(box);
      box.on("pointerover", () => box.setStrokeStyle(3, Palette.gold));
      box.on("pointerout", () => box.setStrokeStyle(2, Palette.stoneLight).setFillStyle(0x161418, 1));
      box.on("pointerdown", () => box.setFillStyle(0x3a2a18, 1).setStrokeStyle(3, Palette.goldBright));
      box.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        box.setFillStyle(0x161418, 1).setStrokeStyle(3, Palette.gold);
        onSelect(id);
      });
      x += towerW + gap;
    }

    const insX = x;
    this.inscribeRect = { x: insX, y: btnY, w: actW, h: BTN_H };
    this.inscribeBtn = new UiButton(scene, {
      x: insX,
      y: btnY,
      w: actW,
      h: BTN_H,
      label: "SIGIL",
      depth: 19,
      onClick: onInscribe,
    });

    const startX = GAME_WIDTH - 16 - actW;
    this.startRect = { x: startX, y: btnY, w: actW, h: BTN_H };
    this.startBtn = new UiButton(scene, {
      x: startX,
      y: btnY,
      w: actW,
      h: BTN_H,
      label: "START WAVE",
      style: "emph",
      depth: 19,
      onClick: onStart,
    });

    this.overlay = scene.add
      .rectangle(GAME_WIDTH / 2, (GAME_HEIGHT - HUD_HEIGHT) / 2, GAME_WIDTH, MAP_ROWS * TILE_SIZE, Palette.overlay, 0.72)
      .setDepth(40)
      .setVisible(false);
    this.overlayText = scene.add
      .text(GAME_WIDTH / 2, (GAME_HEIGHT - HUD_HEIGHT) / 2, "", {
        font: FONT_TITLE,
        color: "#e8c547",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);

    const retW = 320;
    const retX = (GAME_WIDTH - retW) / 2;
    const retY = (GAME_HEIGHT - HUD_HEIGHT) / 2 + 80;
    this.returnRect = { x: retX, y: retY, w: retW, h: BTN_H };
    this.returnBtn = new UiButton(scene, {
      x: retX,
      y: retY,
      w: retW,
      h: BTN_H,
      label: "RETURN TO BASTION",
      style: "emph",
      depth: 42,
      onClick: onReturn,
    });
    this.returnBtn.setVisible(false);

    const menuEndY = retY + BTN_H + 12;
    this.menuEndRect = { x: retX, y: menuEndY, w: retW, h: BTN_H };
    this.menuEndBtn = new UiButton(scene, {
      x: retX,
      y: menuEndY,
      w: retW,
      h: BTN_H,
      label: "MAIN MENU",
      depth: 42,
      onClick: onMenu,
    });
    this.menuEndBtn.setVisible(false);
  }

  refresh(args: {
    gold: number;
    lives: number;
    waveNumber: number;
    waveTotal: number;
    waveActive: boolean;
    selected: TowerId;
    outcome: "playing" | "won" | "lost";
    canStart: boolean;
    canInscribe: boolean;
  }): void {
    this.goldText.setText(`Gold  ${args.gold}`);
    this.livesText.setText(`Lives  ${args.lives}`);
    const waveLabel = args.waveNumber <= 0 ? `Wave  —  / ${args.waveTotal}` : `Wave  ${args.waveNumber}  / ${args.waveTotal}`;
    this.waveText.setText(waveLabel);

    for (let i = 0; i < TOWER_IDS.length; i++) {
      const mark = this.selectMarks[i];
      if (mark) mark.setVisible(TOWER_IDS[i] === args.selected);
    }

    const can = args.canStart && args.outcome === "playing";
    this.startBtn.setLabel(args.waveActive ? "INCOMING" : args.waveNumber >= args.waveTotal ? "ENDED" : "START WAVE");
    this.startBtn.setEnabled(can);
    this.inscribeBtn.setEnabled(args.canInscribe);

    const ended = args.outcome === "won" || args.outcome === "lost";
    if (args.outcome === "won") {
      this.overlay.setVisible(true);
      this.overlayText.setVisible(true).setColor("#e8c547").setText("The path holds.\nYou win.");
    } else if (args.outcome === "lost") {
      this.overlay.setVisible(true);
      this.overlayText.setVisible(true).setColor("#d4544a").setText("The gate is overrun.\nYou lose.");
    } else {
      this.overlay.setVisible(false);
      this.overlayText.setVisible(false);
    }
    this.returnBtn.setVisible(ended);
    this.menuEndBtn.setVisible(ended);
  }

  isOverHud(worldY: number): boolean {
    return worldY >= HUD_Y;
  }

  isOverMenu(x: number, y: number): boolean {
    const r = this.menuRect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  rects(): { startWave: UiRect; inscribe: UiRect; towers: Record<string, UiRect>; returnToBastion: UiRect; menuButton: UiRect; menuEnd: UiRect } {
    return {
      startWave: this.startRect,
      inscribe: this.inscribeRect,
      towers: this.towerRects,
      returnToBastion: this.returnRect,
      menuButton: this.menuRect,
      menuEnd: this.menuEndRect,
    };
  }
}

export function pointerToCell(x: number, y: number): GridPos {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}
