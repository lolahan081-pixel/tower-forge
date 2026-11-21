import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, MAP_ROWS, TILE_SIZE, type GridPos } from "../data/map";
import { TOWERS, TOWER_IDS, type TowerId } from "../data/towers";
import { WAVES } from "../data/waves";
import { Palette } from "../palette";

const HUD_Y = MAP_ROWS * TILE_SIZE;
const FONT = '16px Georgia, "Times New Roman", serif';
const FONT_SMALL = '13px Georgia, "Times New Roman", serif';
const FONT_TITLE = '22px Georgia, "Times New Roman", serif';

export class Hud {
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly startBtn: Phaser.GameObjects.Rectangle;
  private readonly startLabel: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly overlayText: Phaser.GameObjects.Text;
  private readonly selectMarks: Phaser.GameObjects.Rectangle[] = [];
  readonly towerHit: { id: TowerId; x: number; y: number; w: number; h: number }[] = [];
  readonly startHit: { x: number; y: number; w: number; h: number };

  constructor(
    scene: Phaser.Scene,
    onSelect: (id: TowerId) => void,
    onStart: () => void,
  ) {
    const style = { font: FONT, color: "#e8e0d4" };
    this.goldText = scene.add.text(16, HUD_Y + 12, "", style).setDepth(20);
    this.livesText = scene.add.text(170, HUD_Y + 12, "", style).setDepth(20);
    this.waveText = scene.add.text(310, HUD_Y + 12, "", style).setDepth(20);
    scene.add
      .text(16, HUD_Y + 42, "1 Ember Spire   2 Blood Font   SPACE start wave   Click a frame to inscribe", {
        font: FONT_SMALL,
        color: "#8a8490",
      })
      .setDepth(20);

    let x = 500;
    for (const id of TOWER_IDS) {
      const def = TOWERS[id];
      const box = scene.add.rectangle(x + 70, HUD_Y + 36, 140, 52, 0x161418, 1).setStrokeStyle(1, Palette.stoneLight).setDepth(19).setInteractive({ useHandCursor: true });
      scene.add.image(x + 24, HUD_Y + 36, id).setDepth(20);
      scene.add
        .text(x + 44, HUD_Y + 18, `${id === "ember-spire" ? "1  " : "2  "}${def.name}`, { font: FONT_SMALL, color: "#e8e0d4" })
        .setDepth(20);
      scene.add
        .text(x + 44, HUD_Y + 36, `${def.cost} gold`, { font: FONT_SMALL, color: "#c9a227" })
        .setDepth(20);
      const mark = scene.add.rectangle(x + 70, HUD_Y + 36, 140, 52).setStrokeStyle(2, Palette.gold).setFillStyle(0, 0).setDepth(21).setVisible(false);
      this.selectMarks.push(mark);
      this.towerHit.push({ id, x, y: HUD_Y + 10, w: 140, h: 52 });
      box.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        onSelect(id);
      });
      x += 150;
    }

    this.startBtn = scene.add
      .rectangle(GAME_WIDTH - 90, HUD_Y + 36, 140, 44, 0x2a2014, 1)
      .setStrokeStyle(1, Palette.goldDim)
      .setDepth(19)
      .setInteractive({ useHandCursor: true });
    this.startLabel = scene.add
      .text(GAME_WIDTH - 90, HUD_Y + 36, "START WAVE", {
        font: FONT,
        color: "#e8c547",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.startHit = { x: GAME_WIDTH - 160, y: HUD_Y + 14, w: 140, h: 44 };
    this.startBtn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onStart();
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
  }

  refresh(args: {
    gold: number;
    lives: number;
    waveNumber: number;
    waveActive: boolean;
    selected: TowerId;
    outcome: "playing" | "won" | "lost";
    canStart: boolean;
  }): void {
    this.goldText.setText(`Gold  ${args.gold}`);
    this.livesText.setText(`Lives  ${args.lives}`);
    const waveLabel = args.waveNumber <= 0 ? `Wave  —  / ${WAVES.length}` : `Wave  ${args.waveNumber}  / ${WAVES.length}`;
    this.waveText.setText(waveLabel);

    for (let i = 0; i < TOWER_IDS.length; i++) {
      const mark = this.selectMarks[i];
      if (mark) mark.setVisible(TOWER_IDS[i] === args.selected);
    }

    const can = args.canStart && args.outcome === "playing";
    this.startBtn.setFillStyle(can ? 0x2a2014 : 0x161416);
    this.startBtn.setStrokeStyle(1, can ? Palette.gold : Palette.stone);
    this.startLabel.setColor(can ? "#e8c547" : "#8a8490");
    this.startLabel.setText(args.waveActive ? "INCOMING" : args.waveNumber >= WAVES.length ? "ENDED" : "START WAVE");

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
  }

  isOverHud(worldY: number): boolean {
    return worldY >= HUD_Y;
  }
}

export function pointerToCell(x: number, y: number): GridPos {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}
