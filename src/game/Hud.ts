import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, MAP_ROWS, TILE_SIZE, type GridPos } from "../data/map";
import { TOWERS, TOWER_IDS, type TowerId } from "../data/towers";
import { Palette } from "../palette";
import { BTN_H, FONT_BTN, FONT_BTN_SM, FONT_HUD, FONT_TITLE, type UiRect } from "./ui";

const HUD_Y = MAP_ROWS * TILE_SIZE;

export class Hud {
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly startBtn: Phaser.GameObjects.Rectangle;
  private readonly startLabel: Phaser.GameObjects.Text;
  private readonly inscribeBtn: Phaser.GameObjects.Rectangle;
  private readonly inscribeLabel: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly overlayText: Phaser.GameObjects.Text;
  private readonly returnBtn: Phaser.GameObjects.Rectangle;
  private readonly returnLabel: Phaser.GameObjects.Text;
  private readonly menuBtn: Phaser.GameObjects.Rectangle;
  private readonly menuEndBtn: Phaser.GameObjects.Rectangle;
  private readonly menuEndLabel: Phaser.GameObjects.Text;
  private readonly selectMarks: Phaser.GameObjects.Rectangle[] = [];
  private readonly towerRects: Record<string, UiRect> = {};
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
    this.menuBtn = scene.add
      .rectangle(16 + menuW / 2, 8 + BTN_H / 2, menuW, BTN_H, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    scene.add
      .text(16 + menuW / 2, 8 + BTN_H / 2, "MENU", { font: FONT_BTN, color: "#e8e0d4" })
      .setOrigin(0.5)
      .setDepth(31);
    this.menuBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onMenu();
    });
    this.menuBtn.on("pointerover", () => this.menuBtn.setStrokeStyle(3, Palette.gold));
    this.menuBtn.on("pointerout", () => this.menuBtn.setStrokeStyle(2, Palette.stoneLight));

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
      box.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        onSelect(id);
      });
      box.on("pointerover", () => box.setStrokeStyle(2, Palette.gold));
      box.on("pointerout", () => box.setStrokeStyle(2, Palette.stoneLight));
      x += towerW + gap;
    }

    const insX = x;
    this.inscribeRect = { x: insX, y: btnY, w: actW, h: BTN_H };
    this.inscribeBtn = scene.add
      .rectangle(insX + actW / 2, btnY + BTN_H / 2, actW, BTN_H, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.goldDim)
      .setDepth(19)
      .setInteractive({ useHandCursor: true });
    this.inscribeLabel = scene.add
      .text(insX + actW / 2, btnY + BTN_H / 2, "SIGIL", { font: FONT_BTN, color: "#e8c547" })
      .setOrigin(0.5)
      .setDepth(20);
    this.inscribeBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onInscribe();
    });
    this.inscribeBtn.on("pointerover", () => this.inscribeBtn.setStrokeStyle(3, Palette.gold));
    this.inscribeBtn.on("pointerout", () => this.inscribeBtn.setStrokeStyle(2, Palette.goldDim));

    const startX = GAME_WIDTH - 16 - actW;
    this.startRect = { x: startX, y: btnY, w: actW, h: BTN_H };
    this.startBtn = scene.add
      .rectangle(startX + actW / 2, btnY + BTN_H / 2, actW, BTN_H, 0x2a2014, 1)
      .setStrokeStyle(2, Palette.goldDim)
      .setDepth(19)
      .setInteractive({ useHandCursor: true });
    this.startLabel = scene.add
      .text(startX + actW / 2, btnY + BTN_H / 2, "START WAVE", { font: FONT_BTN, color: "#e8c547" })
      .setOrigin(0.5)
      .setDepth(20);
    this.startBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onStart();
    });
    this.startBtn.on("pointerover", () => this.startBtn.setStrokeStyle(3, Palette.gold));
    this.startBtn.on("pointerout", () => this.startBtn.setStrokeStyle(2, Palette.goldDim));

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
    this.returnBtn = scene.add
      .rectangle(retX + retW / 2, retY + BTN_H / 2, retW, BTN_H, 0x2a2014, 1)
      .setStrokeStyle(2, Palette.gold)
      .setDepth(42)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.returnLabel = scene.add
      .text(retX + retW / 2, retY + BTN_H / 2, "RETURN TO BASTION", { font: FONT_BTN, color: "#e8c547" })
      .setOrigin(0.5)
      .setDepth(43)
      .setVisible(false);
    this.returnBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onReturn();
    });
    this.returnBtn.on("pointerover", () => this.returnBtn.setStrokeStyle(3, Palette.goldBright));
    this.returnBtn.on("pointerout", () => this.returnBtn.setStrokeStyle(2, Palette.gold));

    const menuEndY = retY + BTN_H + 12;
    this.menuEndRect = { x: retX, y: menuEndY, w: retW, h: BTN_H };
    this.menuEndBtn = scene.add
      .rectangle(retX + retW / 2, menuEndY + BTN_H / 2, retW, BTN_H, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setDepth(42)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.menuEndLabel = scene.add
      .text(retX + retW / 2, menuEndY + BTN_H / 2, "MAIN MENU", { font: FONT_BTN, color: "#e8e0d4" })
      .setOrigin(0.5)
      .setDepth(43)
      .setVisible(false);
    this.menuEndBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onMenu();
    });
    this.menuEndBtn.on("pointerover", () => this.menuEndBtn.setStrokeStyle(3, Palette.gold));
    this.menuEndBtn.on("pointerout", () => this.menuEndBtn.setStrokeStyle(2, Palette.stoneLight));
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
    this.startBtn.setFillStyle(can ? 0x2a2014 : 0x161416);
    this.startBtn.setStrokeStyle(2, can ? Palette.gold : Palette.stone);
    this.startLabel.setColor(can ? "#e8c547" : "#8a8490");
    this.startLabel.setText(args.waveActive ? "INCOMING" : args.waveNumber >= args.waveTotal ? "ENDED" : "START WAVE");

    this.inscribeBtn.setFillStyle(args.canInscribe ? 0x1a161c : 0x141216);
    this.inscribeBtn.setStrokeStyle(2, args.canInscribe ? Palette.goldDim : Palette.stone);
    this.inscribeLabel.setColor(args.canInscribe ? "#e8c547" : "#8a8490");

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
    this.returnLabel.setVisible(ended);
    this.menuEndBtn.setVisible(ended);
    this.menuEndLabel.setVisible(ended);
  }

  isOverHud(worldY: number): boolean {
    return worldY >= HUD_Y;
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
