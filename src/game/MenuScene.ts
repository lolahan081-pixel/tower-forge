import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { getProfile, markHasStarted, markUnlockSeen, persistProfile, resetProfile } from "../data/profile";
import { pendingUnlocks } from "../data/unlocks";
import { Palette } from "../palette";
import { ConfirmDialog } from "./ConfirmDialog";
import { HelpOverlay } from "./HelpOverlay";
import { generateTextures } from "./textures";
import { UnlockPopup } from "./UnlockPopup";
import { containsRect, FONT_BTN, FONT_TITLE, type UiRect } from "./ui";

type Ember = { dot: Phaser.GameObjects.Arc; vy: number; life: number; max: number; x: number };

const BTN_W = 420;
/** Taller than the shared 88 so iPhone 12 landscape (FIT ≈ 0.49) still has ≥44px targets. */
const MENU_BTN_H = 96;
const EMBER_COUNT = 18;

export class MenuScene extends Phaser.Scene {
  private startRect!: UiRect;
  private bastionRect!: UiRect;
  private howRect!: UiRect;
  private settingsRect!: UiRect;
  private startLabel!: Phaser.GameObjects.Text;
  private help!: HelpOverlay;
  private confirm!: ConfirmDialog;
  private unlocks!: UnlockPopup;
  private embers: Ember[] = [];

  constructor() {
    super("menu");
  }

  create(): void {
    generateTextures(this);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.ground, 1);
    const grid = this.add.graphics();
    grid.fillStyle(Palette.groundAlt, 1);
    const cell = 48;
    for (let row = 0; row < Math.ceil(GAME_HEIGHT / cell); row++) {
      for (let col = 0; col < Math.ceil(GAME_WIDTH / cell); col++) {
        if (((col + row) & 1) === 0) grid.fillRect(col * cell, row * cell, cell, cell);
      }
    }

    this.drawGate();
    this.spawnEmbers();

    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, 88, "Tower Forge", { font: '52px Georgia, "Times New Roman", serif', color: "#e8c547" })
      .setOrigin(0.5, 0);
    this.add
      .text(cx, 156, "The Ashen Bastion", { font: FONT_TITLE, color: "#c9a227" })
      .setOrigin(0.5, 0);

    const firstY = 280;
    const gap = 16;
    this.startRect = { x: cx - BTN_W / 2, y: firstY, w: BTN_W, h: MENU_BTN_H };
    this.bastionRect = { x: cx - BTN_W / 2, y: firstY + MENU_BTN_H + gap, w: BTN_W, h: MENU_BTN_H };
    this.howRect = { x: cx - BTN_W / 2, y: firstY + 2 * (MENU_BTN_H + gap), w: BTN_W, h: MENU_BTN_H };
    this.settingsRect = { x: cx - BTN_W / 2, y: firstY + 3 * (MENU_BTN_H + gap), w: BTN_W, h: MENU_BTN_H };

    this.startLabel = this.makeButton(this.startRect, this.startLabelText(), true);
    this.makeButton(this.bastionRect, "BASTION", false);
    this.makeButton(this.howRect, "HOW TO PLAY", false);
    this.makeButton(this.settingsRect, "SETTINGS", false);

    this.help = new HelpOverlay(this, () => undefined, "menu");
    this.help.hide();
    this.confirm = new ConfirmDialog(this);
    this.unlocks = new UnlockPopup(this, (id) => {
      markUnlockSeen(id);
      this.maybeShowUnlock();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.handleTap(pointer.worldX, pointer.worldY);
    });

    this.exposeDebug();
    this.maybeShowUnlock();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta * 0.001);
    for (let i = 0; i < this.embers.length; i++) {
      const e = this.embers[i];
      if (!e) continue;
      e.life += dt;
      e.dot.y -= e.vy * dt;
      e.dot.x = e.x + Math.sin(e.life * 2.1) * 10;
      const t = e.life / e.max;
      e.dot.setAlpha(t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.8));
      if (e.life >= e.max) this.resetEmber(e);
    }
  }

  private drawGate(): void {
    const g = this.add.graphics();
    const cx = GAME_WIDTH / 2;
    const baseY = GAME_HEIGHT - 40;
    g.fillStyle(Palette.stone, 1);
    g.fillRect(cx - 220, baseY - 260, 80, 260);
    g.fillRect(cx + 140, baseY - 260, 80, 260);
    g.fillStyle(Palette.stoneLight, 1);
    g.fillRect(cx - 240, baseY - 280, 480, 28);
    g.fillStyle(0x0e0c10, 1);
    g.fillRect(cx - 140, baseY - 232, 280, 232);
    g.lineStyle(3, Palette.goldDim, 0.7);
    g.strokeRect(cx - 140, baseY - 232, 280, 232);
    g.lineStyle(2, Palette.ember, 0.45);
    g.strokeCircle(cx, baseY - 140, 36);
    g.fillStyle(Palette.ember, 0.25);
    g.fillCircle(cx, baseY - 140, 16);
  }

  private spawnEmbers(): void {
    for (let i = 0; i < EMBER_COUNT; i++) {
      const dot = this.add.circle(0, 0, 3, Palette.emberHot, 1).setDepth(2);
      const ember: Ember = { dot, vy: 0, life: 0, max: 1, x: 0 };
      this.resetEmber(ember);
      ember.life = Math.random() * ember.max;
      this.embers.push(ember);
    }
  }

  private resetEmber(e: Ember): void {
    e.x = 80 + Math.random() * (GAME_WIDTH - 160);
    e.dot.setPosition(e.x, 200 + Math.random() * (GAME_HEIGHT - 260));
    e.vy = 18 + Math.random() * 28;
    e.max = 2.4 + Math.random() * 2.8;
    e.life = 0;
    e.dot.setRadius(2 + Math.random() * 3);
    e.dot.setFillStyle(Math.random() < 0.35 ? Palette.goldBright : Palette.emberHot, 1);
    e.dot.setAlpha(0);
  }

  private makeButton(rect: UiRect, label: string, emph: boolean): Phaser.GameObjects.Text {
    const box = this.add
      .rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, emph ? 0x2a2014 : 0x1a161c, 1)
      .setStrokeStyle(2, emph ? Palette.gold : Palette.stoneLight)
      .setDepth(4)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(rect.x + rect.w / 2, rect.y + rect.h / 2, label, { font: FONT_BTN, color: emph ? "#e8c547" : "#e8e0d4" })
      .setOrigin(0.5)
      .setDepth(5);
    box.on("pointerover", () => box.setStrokeStyle(3, Palette.gold));
    box.on("pointerout", () => box.setStrokeStyle(2, emph ? Palette.gold : Palette.stoneLight));
    return text;
  }

  private startLabelText(): string {
    return getProfile().hasStarted ? "CONTINUE" : "START";
  }

  private handleTap(x: number, y: number): void {
    if (this.confirm.visible) {
      this.confirm.handleTap(x, y);
      return;
    }
    if (this.unlocks.visible) {
      this.unlocks.handleTap(x, y);
      return;
    }
    if (this.help.visible) {
      this.help.handleTap(x, y);
      return;
    }
    if (containsRect(this.startRect, x, y)) {
      markHasStarted();
      persistProfile();
      if (getProfile().highestDepthCleared <= 0 && !getProfile().seenBattleHint) {
        this.scene.start("game", { depth: 1 });
      } else {
        this.scene.start("bastion");
      }
      return;
    }
    if (containsRect(this.bastionRect, x, y)) {
      markHasStarted();
      persistProfile();
      this.scene.start("bastion");
      return;
    }
    if (containsRect(this.howRect, x, y)) {
      this.help.show();
      return;
    }
    if (containsRect(this.settingsRect, x, y)) {
      this.confirm.show(
        "Reset progress?",
        "This erases your stash, loadout, Lattice, and Depth progress. This cannot be undone.",
        () => {
          resetProfile();
          this.startLabel.setText(this.startLabelText());
        },
      );
    }
  }

  private maybeShowUnlock(): void {
    const profile = getProfile();
    const pending = pendingUnlocks(profile.highestDepthCleared, profile.seenUnlocks);
    const next = pending[0];
    if (next) this.unlocks.show(next);
  }

  private exposeDebug(): void {
    window.__towerForge = {
      ready: true,
      scene: "menu",
      placeTower: () => false,
      startWave: () => false,
      getState: () => ({ ready: true, scene: "menu", hasStarted: getProfile().hasStarted, preview: undefined }),
      firstBuildableNearPath: () => ({ col: 3, row: 5 }),
      stress: () => ({ spawned: 0, fps: 0 }),
      enemyPositions: () => [],
      openPanel: () => false,
      closePanel: () => undefined,
      dismissHelp: () => this.help.dismiss(),
      getUiRects: () => ({
        game: { w: GAME_WIDTH, h: GAME_HEIGHT },
        scene: "menu",
        helpVisible: this.help.visible,
        helpDismiss: this.help.dismissRect(),
        startWave: { x: 0, y: 0, w: 0, h: 0 },
        inscribe: { x: 0, y: 0, w: 0, h: 0 },
        towers: {},
        returnToBastion: null,
        panel: null,
        menuStart: this.startRect,
        menuBastion: this.bastionRect,
        menuHowToPlay: this.howRect,
        menuSettings: this.settingsRect,
        settingsCancel: this.confirm.visible ? this.confirm.cancelRect : null,
        settingsConfirm: this.confirm.visible ? this.confirm.confirmRect : null,
        unlockOk: this.unlocks.visible ? this.unlocks.okRect : null,
      }),
      socketByDef: () => false,
      getProfile: () => getProfile(),
      forceOutcome: () => undefined,
      resetProfile: () => {
        resetProfile();
        this.startLabel.setText(this.startLabelText());
      },
    };
  }
}
