import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, MAP_ROWS, TILE_SIZE, type GridPos } from "../data/map";
import { TOWERS, TOWER_IDS, type TowerId } from "../data/towers";
import { Palette } from "../palette";
import { applySprite } from "./sprites";
import { UiButton } from "./UiButton";
import { BTN_H, FONT_BTN, FONT_BTN_SM, FONT_HUD, FONT_TITLE, MENU_BTN_H, MENU_BTN_W, type UiRect } from "./ui";

const HUD_Y = MAP_ROWS * TILE_SIZE;

type TowerCard = {
  id: TowerId;
  box: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  reason: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Rectangle;
  rect: UiRect;
  available: boolean;
};

export class Hud {
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly depthText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly startBtn: UiButton;
  private readonly cancelBtn: UiButton;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly overlayText: Phaser.GameObjects.Text;
  private readonly returnBtn: UiButton;
  private readonly menuEndBtn: UiButton;
  private readonly cards: TowerCard[] = [];
  private readonly towerRects: Record<string, UiRect> = {};
  readonly startRect: UiRect;
  readonly inscribeRect: UiRect = { x: 0, y: 0, w: 0, h: 0 };
  readonly returnRect: UiRect;
  readonly nextRect: UiRect;
  readonly menuRect: UiRect;
  readonly menuEndRect: UiRect;
  readonly cancelRect: UiRect;
  private readonly nextBtn: UiButton;

  constructor(
    scene: Phaser.Scene,
    onSelect: (id: TowerId) => void,
    onStart: () => void,
    onCancel: () => void,
    onReturn: () => void,
    onMenu: () => void,
    onNext: () => void,
  ) {
    const style = { font: FONT_HUD, color: "#e8e0d4" };
    this.goldText = scene.add.text(16, HUD_Y + 6, "", style).setDepth(20);
    this.livesText = scene.add.text(200, HUD_Y + 6, "", style).setDepth(20);
    this.depthText = scene.add.text(390, HUD_Y + 6, "", style).setDepth(20);
    this.waveText = scene.add.text(620, HUD_Y + 6, "", style).setDepth(20);

    this.menuRect = { x: 16, y: 2, w: MENU_BTN_W, h: MENU_BTN_H };
    new UiButton(scene, {
      x: 16,
      y: 2,
      w: MENU_BTN_W,
      h: MENU_BTN_H,
      label: "MENU",
      depth: 30,
      onClick: onMenu,
    });

    const btnY = HUD_Y + 26;
    const cardH = 90;
    const cardW = 250;
    const gap = 10;
    const actW = 180;
    let x = 16;
    for (const id of TOWER_IDS) {
      const def = TOWERS[id];
      const cx = x + cardW / 2;
      const cy = btnY + cardH / 2;
      const box = scene.add
        .rectangle(cx, cy, cardW, cardH, 0x161418, 1)
        .setStrokeStyle(2, Palette.stoneLight)
        .setDepth(19)
        .setInteractive({ useHandCursor: true });
      const icon = scene.add.image(x + 36, cy, id).setDepth(20);
      applySprite(icon, def.sprite, 48);
      const name = scene.add.text(x + 68, cy - 26, def.name, { font: FONT_BTN, color: "#e8e0d4" }).setDepth(20);
      const cost = scene.add.text(x + 68, cy + 2, `${def.cost} gold`, { font: FONT_BTN_SM, color: "#c9a227" }).setDepth(20);
      const reason = scene.add
        .text(x + 68, cy + 22, "", { font: FONT_BTN_SM, color: "#8a8490" })
        .setDepth(20)
        .setVisible(false);
      const mark = scene.add
        .rectangle(cx, cy, cardW, cardH)
        .setStrokeStyle(3, Palette.goldBright)
        .setFillStyle(0, 0)
        .setDepth(21)
        .setVisible(false);
      const rect: UiRect = { x, y: btnY, w: cardW, h: cardH };
      const card: TowerCard = { id, box, icon, name, cost, reason, mark, rect, available: true };
      this.cards.push(card);
      this.towerRects[id] = rect;
      box.on("pointerover", () => {
        if (card.available) box.setStrokeStyle(3, Palette.gold);
      });
      box.on("pointerout", () => this.paintCard(card, false));
      box.on("pointerdown", () => {
        if (!card.available) return;
        box.setFillStyle(0x3a2a18, 1).setStrokeStyle(3, Palette.goldBright);
      });
      box.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown() || !card.available) return;
        this.paintCard(card, false);
        onSelect(id);
      });
      x += cardW + gap;
    }

    const actY = btnY + (cardH - BTN_H) / 2;
    this.cancelRect = { x: x + 8, y: actY, w: 160, h: BTN_H };
    this.cancelBtn = new UiButton(scene, {
      x: this.cancelRect.x,
      y: actY,
      w: 160,
      h: BTN_H,
      label: "CANCEL",
      depth: 19,
      onClick: onCancel,
    });
    this.cancelBtn.setVisible(false);

    const startX = GAME_WIDTH - 16 - actW;
    this.startRect = { x: startX, y: actY, w: actW, h: BTN_H };
    this.startBtn = new UiButton(scene, {
      x: startX,
      y: actY,
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

    const btnW = 280;
    const endGap = 16;
    const rowW = btnW * 2 + endGap;
    const rowX = (GAME_WIDTH - rowW) / 2;
    const rowY = (GAME_HEIGHT - HUD_HEIGHT) / 2 + 50;
    this.nextRect = { x: rowX, y: rowY, w: btnW, h: BTN_H };
    this.nextBtn = new UiButton(scene, {
      x: rowX,
      y: rowY,
      w: btnW,
      h: BTN_H,
      label: "NEXT",
      style: "emph",
      depth: 42,
      onClick: onNext,
    });
    this.nextBtn.setVisible(false);

    this.returnRect = { x: rowX + btnW + endGap, y: rowY, w: btnW, h: BTN_H };
    this.returnBtn = new UiButton(scene, {
      x: this.returnRect.x,
      y: rowY,
      w: btnW,
      h: BTN_H,
      label: "BASTION",
      style: "emph",
      depth: 42,
      onClick: onReturn,
    });
    this.returnBtn.setVisible(false);

    const endMenuW = 280;
    const menuEndY = rowY + BTN_H + 12;
    this.menuEndRect = { x: (GAME_WIDTH - endMenuW) / 2, y: menuEndY, w: endMenuW, h: BTN_H };
    this.menuEndBtn = new UiButton(scene, {
      x: this.menuEndRect.x,
      y: menuEndY,
      w: endMenuW,
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
    selected: TowerId | null;
    placing: boolean;
    outcome: "playing" | "won" | "lost";
    canStart: boolean;
    depth: number;
    difficulty: string;
    pips: string;
    canNext: boolean;
  }): void {
    this.goldText.setText(`Gold  ${args.gold}`);
    this.livesText.setText(`Lives  ${args.lives}`);
    this.depthText.setText(`Depth ${args.depth}  ${args.pips}  ${args.difficulty}`);
    const waveLabel = args.waveNumber <= 0 ? `Wave  —  / ${args.waveTotal}` : `Wave  ${args.waveNumber}  / ${args.waveTotal}`;
    this.waveText.setText(waveLabel);

    for (const card of this.cards) {
      const def = TOWERS[card.id];
      const need = def.cost - args.gold;
      const selected = args.selected === card.id;
      card.available = need <= 0 && args.outcome === "playing";
      card.cost.setText(`${def.cost} gold`);
      if (need > 0) {
        card.cost.setColor("#8a8490");
        card.reason.setVisible(true).setColor("#d4544a").setText(`Need ${need} more gold`);
        card.icon.setAlpha(0.45);
        card.name.setColor("#8a8490");
      } else {
        card.cost.setColor("#c9a227");
        card.reason.setVisible(false);
        card.icon.setAlpha(1);
        card.name.setColor("#e8e0d4");
      }
      card.mark.setVisible(selected);
      this.paintCard(card, selected);
    }

    this.cancelBtn.setVisible(args.placing && args.outcome === "playing");

    const can = args.canStart && args.outcome === "playing";
    this.startBtn.setLabel(args.waveActive ? "INCOMING" : args.waveNumber >= args.waveTotal ? "ENDED" : "START WAVE");
    this.startBtn.setEnabled(can);

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
    const showNext = args.outcome === "won" && args.canNext;
    this.nextBtn.setVisible(showNext);
    this.returnBtn.setVisible(ended);
    this.returnBtn.setLabel(showNext ? "BASTION" : "RETURN TO BASTION");
    const returnX = showNext ? this.nextRect.x + this.nextRect.w + 16 : (GAME_WIDTH - this.returnRect.w) / 2;
    this.returnBtn.root.setX(returnX);
    this.returnRect.x = returnX;
    this.menuEndBtn.setVisible(ended);
  }

  isOverHud(worldY: number): boolean {
    return worldY >= HUD_Y;
  }

  isOverMenu(x: number, y: number): boolean {
    const r = this.menuRect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  rects(): {
    startWave: UiRect;
    inscribe: UiRect;
    towers: Record<string, UiRect>;
    returnToBastion: UiRect;
    next: UiRect | null;
    menuButton: UiRect;
    menuEnd: UiRect;
    cancelPlace: UiRect | null;
  } {
    return {
      startWave: this.startRect,
      inscribe: this.inscribeRect,
      towers: this.towerRects,
      returnToBastion: this.returnRect,
      next: this.nextBtn.root.visible ? this.nextRect : null,
      menuButton: this.menuRect,
      menuEnd: this.menuEndRect,
      cancelPlace: this.cancelBtn.visible ? this.cancelRect : null,
    };
  }

  private paintCard(card: TowerCard, selected: boolean): void {
    if (!card.available) {
      card.box.setFillStyle(0x121014, 1).setStrokeStyle(2, Palette.stone);
      return;
    }
    if (selected) {
      card.box.setFillStyle(0x2a2014, 1).setStrokeStyle(3, Palette.goldBright);
      return;
    }
    card.box.setFillStyle(0x161418, 1).setStrokeStyle(2, Palette.stoneLight);
  }
}

export function pointerToCell(x: number, y: number): GridPos {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}
