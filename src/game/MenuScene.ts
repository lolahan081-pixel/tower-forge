import Phaser from "phaser";
import { ATLAS_START_ID, getAtlasNode } from "../data/atlas";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import { getProfile, markHasStarted, markUnlockSeen, persistProfile, resetProfile } from "../data/profile";
import { pendingUnlocks } from "../data/unlocks";
import { Palette } from "../palette";
import { ConfirmDialog } from "./ConfirmDialog";
import { HelpOverlay } from "./HelpOverlay";
import { generateTextures } from "./textures";
import { UiButton } from "./UiButton";
import { UnlockPopup } from "./UnlockPopup";
import { FONT_TITLE, pointerWorld, prepareSceneInput, startScene } from "./ui";

type Ember = { dot: Phaser.GameObjects.Arc; vy: number; life: number; max: number; x: number };

const BTN_W = 420;
/** Taller than the shared 88 so iPhone 12 landscape (FIT ≈ 0.49) still has ≥44px targets. */
const MENU_BTN_H = 96;
const EMBER_COUNT = 18;

export class MenuScene extends Phaser.Scene {
  private startBtn!: UiButton;
  private bastionBtn!: UiButton;
  private howBtn!: UiButton;
  private settingsBtn!: UiButton;
  private help!: HelpOverlay;
  private confirm!: ConfirmDialog;
  private unlocks!: UnlockPopup;
  private embers: Ember[] = [];

  constructor() {
    super("menu");
  }

  create(): void {
    generateTextures(this);
    prepareSceneInput(this);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.ground, 1);
    const grid = this.add.graphics();
    grid.fillStyle(Palette.groundAlt, 1);
    const cell = 48;
    for (let row = 0; row < Math.ceil(GAME_HEIGHT / cell); row++) {
      for (let col = 0; col < Math.ceil(GAME_WIDTH / cell); col++) {
        if (((col + row) & 1) === 0) grid.fillRect(col * cell, row * cell, cell, cell);
      }
    }

    this.embers = [];
    this.drawGate();
    this.spawnEmbers();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.embers = [];
    });

    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, 88, "Tower Forge", { font: '52px Georgia, "Times New Roman", serif', color: "#e8c547" })
      .setOrigin(0.5, 0);
    this.add
      .text(cx, 156, "The Ashen Bastion", { font: FONT_TITLE, color: "#c9a227" })
      .setOrigin(0.5, 0);

    const firstY = 280;
    const gap = 16;
    const x = cx - BTN_W / 2;
    this.startBtn = new UiButton(this, {
      x,
      y: firstY,
      w: BTN_W,
      h: MENU_BTN_H,
      label: this.startLabelText(),
      style: "emph",
      onClick: () => this.onStart(),
    });
    this.bastionBtn = new UiButton(this, {
      x,
      y: firstY + MENU_BTN_H + gap,
      w: BTN_W,
      h: MENU_BTN_H,
      label: "BASTION",
      onClick: () => this.goBastion(),
    });
    this.howBtn = new UiButton(this, {
      x,
      y: firstY + 2 * (MENU_BTN_H + gap),
      w: BTN_W,
      h: MENU_BTN_H,
      label: "HOW TO PLAY",
      onClick: () => {
        this.setMenuLive(false);
        this.help.show();
      },
    });
    this.settingsBtn = new UiButton(this, {
      x,
      y: firstY + 3 * (MENU_BTN_H + gap),
      w: BTN_W,
      h: MENU_BTN_H,
      label: "SETTINGS",
      onClick: () => {
        this.setMenuLive(false);
        this.confirm.show(
          "Reset progress?",
          "This erases your stash, loadout, Lattice, Atlas, and Depth progress. This cannot be undone.",
          () => {
            resetProfile();
            this.startBtn.setLabel(this.startLabelText());
            this.setMenuLive(true);
          },
          () => this.setMenuLive(true),
        );
      },
    });

    this.help = new HelpOverlay(this, () => this.setMenuLive(true), "menu");
    this.confirm = new ConfirmDialog(this);
    this.unlocks = new UnlockPopup(this, (id) => {
      markUnlockSeen(id);
      this.maybeShowUnlock();
    });

    this.exposeDebug();
    this.maybeShowUnlock();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      const pt = pointerWorld(this, pointer);
      if (this.unlocks.visible) {
        this.unlocks.handleTap(pt.x, pt.y);
        return;
      }
      if (this.help.visible) {
        this.help.handleTap(pt.x, pt.y);
        return;
      }
    });
  }

  update(_time: number, delta: number): void {
    try {
      this.stepEmbers(delta);
    } catch (err) {
      console.error("Tower Forge: MenuScene update failed", err);
    }
  }

  private stepEmbers(delta: number): void {
    const dt = Math.min(0.05, delta * 0.001);
    for (let i = 0; i < this.embers.length; i++) {
      const e = this.embers[i];
      if (!e) continue;
      e.life += dt;
      if (!e.dot.active) continue;
      e.dot.y -= e.vy * dt;
      e.dot.x = e.x + Math.sin(e.life * 2.1) * 10;
      const fade = e.life / e.max;
      e.dot.setAlpha(fade < 0.2 ? fade / 0.2 : Math.max(0, 1 - (fade - 0.2) / 0.8));
      if (e.life >= e.max) this.resetEmber(e);
    }
  }

  private setMenuLive(live: boolean): void {
    this.startBtn.setEnabled(live);
    this.bastionBtn.setEnabled(live);
    this.howBtn.setEnabled(live);
    this.settingsBtn.setEnabled(live);
  }

  private onStart(): void {
    markHasStarted();
    persistProfile();
    if (getProfile().highestDepthCleared <= 0 && !getProfile().seenBattleHint) {
      const node = getAtlasNode(ATLAS_START_ID);
      startScene(this, "game", { depth: node.depth, layoutId: node.layoutId, atlasNodeId: node.id });
    } else {
      startScene(this, "bastion");
    }
  }

  private goBastion(): void {
    markHasStarted();
    persistProfile();
    startScene(this, "bastion");
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

  private startLabelText(): string {
    return getProfile().hasStarted ? "CONTINUE" : "START";
  }

  private maybeShowUnlock(): void {
    const profile = getProfile();
    const pending = pendingUnlocks(profile.highestDepthCleared, profile.seenUnlocks);
    const next = pending[0];
    if (next) {
      this.setMenuLive(false);
      this.unlocks.show(next);
    } else {
      this.setMenuLive(true);
    }
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
        menuStart: this.startBtn.rect,
        menuBastion: this.bastionBtn.rect,
        menuHowToPlay: this.howBtn.rect,
        menuSettings: this.settingsBtn.rect,
        settingsCancel: this.confirm.visible ? this.confirm.cancelRect : null,
        settingsConfirm: this.confirm.visible ? this.confirm.confirmRect : null,
        unlockOk: this.unlocks.visible ? this.unlocks.okRect : null,
      }),
      socketByDef: () => false,
      getProfile: () => getProfile(),
      forceOutcome: () => undefined,
      resetProfile: () => {
        resetProfile();
        this.startBtn.setLabel(this.startLabelText());
      },
    };
  }
}
