import Phaser from "phaser";
import { makeGem } from "../data/items";
import { GAME_HEIGHT, GAME_WIDTH } from "../data/map";
import {
  getProfile,
  persistProfile,
  runeSlotCount,
  socketRelic,
  socketRune,
  unsocketRelic,
  unsocketRune,
} from "../data/profile";
import { makeRelic, relicDisplayName, relicRarityLabel, type RelicRarity } from "../data/relics";
import { isRuneId, RUNES } from "../data/runes";
import { SIGILS } from "../data/sigils";
import { resolveLoadout, runeMatchesSigil, type ResolvedAttack } from "../data/stats";
import { TOWERS, TOWER_IDS, type TowerId } from "../data/towers";
import { Palette } from "../palette";
import type { HubSnapshot, UiRects } from "../debug";
import { HelpOverlay } from "./HelpOverlay";
import { gemColor, gemName, itemColor } from "./gems";
import { generateTextures } from "./textures";
import { BTN_H, containsRect, FONT_BODY, FONT_BTN, FONT_BTN_SM, FONT_HUD, FONT_TITLE, type UiRect } from "./ui";

type Tab = "loadout" | "lattice";

type SlotView = { box: Phaser.GameObjects.Rectangle; chip: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; rect: UiRect };
type InvView = SlotView;

export class BastionScene extends Phaser.Scene {
  private tab: Tab = "loadout";
  private selected: TowerId = "ember-spire";
  private selectedUid: string | null = null;
  private selectedSlot: number | null = null;
  private selectedKind: "rune" | "relic" = "rune";
  private invMode: "rune" | "relic" = "rune";
  private help!: HelpOverlay;

  private loadoutRoot!: Phaser.GameObjects.Container;
  private latticeRoot!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private sigilLabel!: Phaser.GameObjects.Text;
  private towerMarks: Phaser.GameObjects.Rectangle[] = [];
  private tabMarks: { loadout: Phaser.GameObjects.Rectangle; lattice: Phaser.GameObjects.Rectangle } | null = null;
  private runeViews: SlotView[] = [];
  private relicViews: SlotView[] = [];
  private invViews: InvView[] = [];
  private unsocketBtn!: Phaser.GameObjects.Rectangle;
  private unsocketLabel!: Phaser.GameObjects.Text;

  private enterRect!: UiRect;
  private tabLoadoutRect!: UiRect;
  private tabLatticeRect!: UiRect;
  private unsocketRect!: UiRect;
  private towerRects: Record<string, UiRect> = {};
  private invRunesRect!: UiRect;
  private invRelicsRect!: UiRect;
  private invRunesMark!: Phaser.GameObjects.Rectangle;
  private invRelicsMark!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("bastion");
  }

  create(): void {
    generateTextures(this);
    getProfile();

    this.tab = "loadout";
    this.selected = "ember-spire";
    this.selectedUid = null;
    this.selectedSlot = null;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.ground, 1);
    // Subtle checker so the hub feels like the same world as the board.
    const grid = this.add.graphics();
    grid.fillStyle(Palette.groundAlt, 1);
    const cell = 48;
    for (let row = 0; row < Math.ceil(GAME_HEIGHT / cell); row++) {
      for (let col = 0; col < Math.ceil(GAME_WIDTH / cell); col++) {
        if (((col + row) & 1) === 0) grid.fillRect(col * cell, row * cell, cell, cell);
      }
    }

    this.add.text(24, 28, "The Ashen Bastion", { font: FONT_TITLE, color: "#e8c547" });

    const enterW = 280;
    const enterX = GAME_WIDTH - 24 - enterW;
    const enterY = 16;
    this.enterRect = { x: enterX, y: enterY, w: enterW, h: BTN_H };
    this.makeButton(enterX, enterY, enterW, BTN_H, "ENTER BREACH", true);

    const tabY = 16 + BTN_H + 16;
    const tabW = 240;
    this.tabLoadoutRect = { x: 24, y: tabY, w: tabW, h: BTN_H };
    this.tabLatticeRect = { x: 24 + tabW + 12, y: tabY, w: tabW, h: BTN_H };
    this.makeButton(this.tabLoadoutRect.x, tabY, tabW, BTN_H, "LOADOUT", false);
    this.makeButton(this.tabLatticeRect.x, tabY, tabW, BTN_H, "EMBER LATTICE", false);
    this.tabMarks = {
      loadout: this.add
        .rectangle(this.tabLoadoutRect.x + tabW / 2, tabY + BTN_H / 2, tabW, BTN_H)
        .setStrokeStyle(3, Palette.gold)
        .setFillStyle(0, 0)
        .setDepth(6),
      lattice: this.add
        .rectangle(this.tabLatticeRect.x + tabW / 2, tabY + BTN_H / 2, tabW, BTN_H)
        .setStrokeStyle(3, Palette.gold)
        .setFillStyle(0, 0)
        .setDepth(6)
        .setVisible(false),
    };

    this.buildLoadout();
    this.buildLattice();

    this.help = new HelpOverlay(this, () => undefined, "bastion");
    if (this.help.shouldShow()) this.help.show();
    else this.help.hide();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.handleTap(pointer.worldX, pointer.worldY);
    });

    this.refresh();
    this.exposeDebug();
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, emph: boolean): void {
    const box = this.add
      .rectangle(x + w / 2, y + h / 2, w, h, emph ? 0x2a2014 : 0x1a161c, 1)
      .setStrokeStyle(2, emph ? Palette.gold : Palette.stoneLight)
      .setDepth(4)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x + w / 2, y + h / 2, label, { font: FONT_BTN, color: emph ? "#e8c547" : "#e8e0d4" })
      .setOrigin(0.5)
      .setDepth(5);
    box.on("pointerover", () => box.setStrokeStyle(3, Palette.gold));
    box.on("pointerout", () => box.setStrokeStyle(2, emph ? Palette.gold : Palette.stoneLight));
  }

  private buildLoadout(): void {
    const children: Phaser.GameObjects.GameObject[] = [];
    const top = 16 + BTN_H + 16 + BTN_H + 20;

    const typeW = 240;
    let typeY = top;
    this.towerMarks = [];
    this.towerRects = {};
    for (const id of TOWER_IDS) {
      const def = TOWERS[id];
      const rect = { x: 24, y: typeY, w: typeW, h: BTN_H };
      this.towerRects[id] = rect;
      const box = this.add
        .rectangle(rect.x + typeW / 2, rect.y + BTN_H / 2, typeW, BTN_H, 0x161418, 1)
        .setStrokeStyle(2, Palette.stoneLight)
        .setInteractive({ useHandCursor: true });
      const icon = this.add.image(rect.x + 28, rect.y + BTN_H / 2, id);
      const name = this.add.text(rect.x + 52, rect.y + 18, def.name, { font: FONT_BTN, color: "#e8e0d4" });
      const sub = this.add.text(rect.x + 52, rect.y + 48, `${runeSlotCount(id)} rune sockets`, {
        font: FONT_BTN_SM,
        color: "#8a8490",
      });
      const mark = this.add
        .rectangle(rect.x + typeW / 2, rect.y + BTN_H / 2, typeW, BTN_H)
        .setStrokeStyle(3, Palette.gold)
        .setFillStyle(0, 0)
        .setVisible(id === this.selected);
      this.towerMarks.push(mark);
      box.on("pointerover", () => box.setStrokeStyle(2, Palette.gold));
      box.on("pointerout", () => box.setStrokeStyle(2, Palette.stoneLight));
      children.push(box, icon, name, sub, mark);
      typeY += BTN_H + 12;
    }

    typeY += 12;
    this.invRunesRect = { x: 24, y: typeY, w: typeW, h: BTN_H };
    const runesBtn = this.add
      .rectangle(24 + typeW / 2, typeY + BTN_H / 2, typeW, BTN_H, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.goldDim)
      .setInteractive({ useHandCursor: true });
    this.add.text(24 + typeW / 2, typeY + BTN_H / 2, "RUNES", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5);
    children.push(runesBtn);
    typeY += BTN_H + 12;
    this.invRelicsRect = { x: 24, y: typeY, w: typeW, h: BTN_H };
    const relicsBtn = this.add
      .rectangle(24 + typeW / 2, typeY + BTN_H / 2, typeW, BTN_H, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setInteractive({ useHandCursor: true });
    this.add.text(24 + typeW / 2, typeY + BTN_H / 2, "RELICS", { font: FONT_BTN, color: "#e8e0d4" }).setOrigin(0.5);
    children.push(relicsBtn);
    this.invRunesMark = this.add
      .rectangle(this.invRunesRect.x + typeW / 2, this.invRunesRect.y + BTN_H / 2, typeW, BTN_H)
      .setStrokeStyle(3, Palette.gold)
      .setFillStyle(0, 0);
    this.invRelicsMark = this.add
      .rectangle(this.invRelicsRect.x + typeW / 2, this.invRelicsRect.y + BTN_H / 2, typeW, BTN_H)
      .setStrokeStyle(3, Palette.gold)
      .setFillStyle(0, 0)
      .setVisible(false);
    children.push(this.invRunesMark, this.invRelicsMark);

    const panelX = 24 + typeW + 20;
    const panelW = GAME_WIDTH - panelX - 24;
    const panelH = GAME_HEIGHT - top - 24;
    const panel = this.add
      .rectangle(panelX, top, panelW, panelH, Palette.panel, 0.96)
      .setStrokeStyle(2, Palette.panelEdge)
      .setOrigin(0, 0);
    children.push(panel);

    this.sigilLabel = this.add.text(panelX + 20, top + 16, "", { font: FONT_HUD, color: "#e8c547" });
    children.push(this.sigilLabel);

    this.statsText = this.add.text(panelX + 20, top + 48, "", {
      font: FONT_BTN_SM,
      color: "#e8e0d4",
      lineSpacing: 4,
    });
    children.push(this.statsText);

    const runeY = top + 88;
    children.push(this.add.text(panelX + 20, runeY, "Rune sockets", { font: FONT_BTN_SM, color: "#8a8490" }));
    this.runeViews = [];
    const slotH = BTN_H;
    const runeSlotW = (panelW - 40 - 24) / 3;
    for (let i = 0; i < 4; i++) {
      const x = panelX + 20 + i * (runeSlotW + 12);
      const y = runeY + 24;
      const view = this.makeSlot(x, y, runeSlotW, slotH);
      this.runeViews.push(view);
      children.push(view.box, view.chip, view.label);
    }

    const relicY = runeY + 24 + slotH + 12;
    children.push(this.add.text(panelX + 20, relicY, "Relic slots", { font: FONT_BTN_SM, color: "#8a8490" }));
    this.relicViews = [];
    const rowInner = panelW - 40;
    const rowGap = 12;
    const relicRowW = (rowInner - rowGap * 2) / 3;
    for (let i = 0; i < 2; i++) {
      const x = panelX + 20 + i * (relicRowW + rowGap);
      const y = relicY + 24;
      const view = this.makeSlot(x, y, relicRowW, slotH);
      this.relicViews.push(view);
      children.push(view.box, view.chip, view.label);
    }

    const unW = relicRowW;
    const unX = panelX + 20 + 2 * (relicRowW + rowGap);
    const unY = relicY + 24;
    this.unsocketRect = { x: unX, y: unY, w: unW, h: BTN_H };
    this.unsocketBtn = this.add
      .rectangle(unX + unW / 2, unY + BTN_H / 2, unW, BTN_H, 0x2a1818, 1)
      .setStrokeStyle(2, Palette.danger)
      .setInteractive({ useHandCursor: true });
    this.unsocketLabel = this.add
      .text(unX + unW / 2, unY + BTN_H / 2, "UNSOCKET", { font: FONT_BTN, color: "#e8e0d4" })
      .setOrigin(0.5);
    children.push(this.unsocketBtn, this.unsocketLabel);

    const invY = unY + BTN_H + 14;
    children.push(this.add.text(panelX + 20, invY, "Rune inventory", { font: FONT_BTN_SM, color: "#8a8490" }));
    this.hint = this.add.text(panelX + 220, invY, "Tap a rune, then a socket", { font: FONT_BODY, color: "#c9a227" });
    children.push(this.hint);

    this.invViews = [];
    const invW = (panelW - 40 - 24) / 3;
    const invTop = invY + 24;
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = panelX + 20 + col * (invW + 12);
      const y = invTop + row * (BTN_H + 8);
      const view = this.makeSlot(x, y, invW, BTN_H);
      this.invViews.push(view);
      children.push(view.box, view.chip, view.label);
    }

    this.loadoutRoot = this.add.container(0, 0, children);
  }

  private makeSlot(x: number, y: number, w: number, h: number): SlotView {
    const box = this.add
      .rectangle(x, y, w, h, 0x1a161c, 1)
      .setStrokeStyle(2, Palette.stoneLight)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    const chip = this.add.rectangle(x + 18, y + h / 2, 16, 16, Palette.muted, 1).setVisible(false);
    const label = this.add.text(x + 34, y + h / 2 - 16, "", {
      font: FONT_BTN_SM,
      color: "#e8e0d4",
      wordWrap: { width: w - 44 },
    });
    box.on("pointerover", () => {
      if (box.visible) box.setStrokeStyle(2, Palette.gold);
    });
    box.on("pointerout", () => box.setStrokeStyle(2, Palette.stoneLight));
    return { box, chip, label, rect: { x, y, w, h } };
  }

  private buildLattice(): void {
    const children: Phaser.GameObjects.GameObject[] = [];
    const top = 16 + BTN_H + 16 + BTN_H + 20;
    const panel = this.add
      .rectangle(24, top, GAME_WIDTH - 48, GAME_HEIGHT - top - 24, Palette.panel, 0.96)
      .setStrokeStyle(2, Palette.panelEdge)
      .setOrigin(0, 0);
    children.push(panel);
    children.push(
      this.add
        .text(GAME_WIDTH / 2, top + 36, "Ember Lattice", { font: FONT_TITLE, color: "#e8c547" })
        .setOrigin(0.5, 0),
    );
    children.push(
      this.add
        .text(GAME_WIDTH / 2, top + 88, "The Lattice is not yet open — coming soon.", {
          font: FONT_BODY,
          color: "#e8e0d4",
        })
        .setOrigin(0.5, 0),
    );
    children.push(
      this.add
        .text(GAME_WIDTH / 2, top + 120, "Account points and tag-scoped nodes will live here.", {
          font: FONT_BTN_SM,
          color: "#8a8490",
        })
        .setOrigin(0.5, 0),
    );

    const g = this.add.graphics();
    const cx = GAME_WIDTH / 2;
    const cy = top + 300;
    g.lineStyle(2, Palette.stoneLight, 1);
    g.lineBetween(cx - 90, cy + 50, cx, cy - 40);
    g.lineBetween(cx + 90, cy + 50, cx, cy - 40);
    g.lineBetween(cx - 90, cy + 50, cx + 90, cy + 50);
    g.fillStyle(Palette.goldDim, 1);
    g.fillCircle(cx, cy - 40, 16);
    g.fillStyle(Palette.stone, 1);
    g.fillCircle(cx - 90, cy + 50, 14);
    g.fillCircle(cx + 90, cy + 50, 14);
    g.lineStyle(2, Palette.goldDim, 1);
    g.strokeCircle(cx, cy - 40, 16);
    g.lineStyle(2, Palette.stoneLight, 1);
    g.strokeCircle(cx - 90, cy + 50, 14);
    g.strokeCircle(cx + 90, cy + 50, 14);
    children.push(g);
    children.push(
      this.add
        .text(cx, cy - 70, "0 points", { font: FONT_BTN_SM, color: "#8a8490" })
        .setOrigin(0.5),
    );

    this.latticeRoot = this.add.container(0, 0, children).setVisible(false);
  }

  private handleTap(x: number, y: number): void {
    if (this.help.visible) {
      this.help.handleTap(x, y);
      return;
    }
    if (containsRect(this.enterRect, x, y)) {
      persistProfile();
      this.scene.start("game");
      return;
    }
    if (containsRect(this.tabLoadoutRect, x, y)) {
      this.tab = "loadout";
      this.refresh();
      return;
    }
    if (containsRect(this.tabLatticeRect, x, y)) {
      this.tab = "lattice";
      this.refresh();
      return;
    }
    if (this.tab !== "loadout") return;

    for (const id of TOWER_IDS) {
      const rect = this.towerRects[id];
      if (rect && containsRect(rect, x, y)) {
        this.selected = id;
        this.selectedSlot = null;
        this.selectedUid = null;
        this.refresh();
        return;
      }
    }

    if (containsRect(this.invRunesRect, x, y)) {
      this.invMode = "rune";
      this.selectedUid = null;
      this.refresh();
      return;
    }
    if (containsRect(this.invRelicsRect, x, y)) {
      this.invMode = "relic";
      this.selectedUid = null;
      this.refresh();
      return;
    }

    const loadout = getProfile().loadouts[this.selected];
    if (loadout) {
      for (let i = 0; i < loadout.runes.length; i++) {
        const view = this.runeViews[i];
        if (view && view.box.visible && containsRect(view.rect, x, y)) {
          this.onRuneSlot(i);
          return;
        }
      }
      for (let i = 0; i < loadout.relics.length; i++) {
        const view = this.relicViews[i];
        if (view && view.box.visible && containsRect(view.rect, x, y)) {
          this.onRelicSlot(i);
          return;
        }
      }
    }

    if (containsRect(this.unsocketRect, x, y)) {
      if (this.selectedSlot !== null) {
        if (this.selectedKind === "relic") unsocketRelic(this.selected, this.selectedSlot);
        else unsocketRune(this.selected, this.selectedSlot);
      }
      this.selectedUid = null;
      this.selectedSlot = null;
      this.refresh();
      return;
    }

    if (this.invMode === "rune") {
      const inv = getProfile().runeInventory;
      for (let i = 0; i < this.invViews.length; i++) {
        const view = this.invViews[i];
        const gem = inv[i];
        if (view && gem && view.box.visible && containsRect(view.rect, x, y)) {
          this.selectedUid = gem.uid;
          this.selectedKind = "rune";
          this.selectedSlot = null;
          this.refresh();
          return;
        }
      }
    } else {
      const inv = getProfile().relicInventory;
      for (let i = 0; i < this.invViews.length; i++) {
        const view = this.invViews[i];
        const relic = inv[i];
        if (view && relic && view.box.visible && containsRect(view.rect, x, y)) {
          this.selectedUid = relic.uid;
          this.selectedKind = "relic";
          this.selectedSlot = null;
          this.refresh();
          return;
        }
      }
    }
  }

  private onRuneSlot(slot: number): void {
    if (this.selectedUid && this.selectedKind === "rune") {
      socketRune(this.selected, slot, this.selectedUid);
      this.selectedUid = null;
      this.selectedSlot = null;
      this.refresh();
      return;
    }
    this.selectedKind = "rune";
    this.selectedSlot = slot;
    this.refresh();
  }

  private onRelicSlot(slot: number): void {
    if (this.selectedUid && this.selectedKind === "relic") {
      socketRelic(this.selected, slot, this.selectedUid);
      this.selectedUid = null;
      this.selectedSlot = null;
      this.refresh();
      return;
    }
    this.selectedKind = "relic";
    this.selectedSlot = slot;
    this.refresh();
  }

  private refresh(): void {
    const onLoadout = this.tab === "loadout";
    this.loadoutRoot.setVisible(onLoadout);
    this.latticeRoot.setVisible(!onLoadout);
    this.tabMarks?.loadout.setVisible(onLoadout);
    this.tabMarks?.lattice.setVisible(!onLoadout);
    if (!onLoadout) return;

    const def = TOWERS[this.selected];
    const profile = getProfile();
    const loadout = profile.loadouts[this.selected];
    const previewSigil = makeGem("sigil", def.starterSigil);
    const resolved = resolveLoadout(def, previewSigil, loadout?.runes ?? [], loadout?.relics ?? []);

    this.sigilLabel.setText(`${def.name}  ·  default Sigil  ${SIGILS[def.starterSigil].name}`);
    this.statsText.setText(formatPreview(resolved));

    for (let i = 0; i < TOWER_IDS.length; i++) {
      const mark = this.towerMarks[i];
      if (mark) mark.setVisible(TOWER_IDS[i] === this.selected);
    }

    const runeCount = loadout?.runes.length ?? 0;
    const sigilTags = SIGILS[def.starterSigil].tags;
    for (let i = 0; i < this.runeViews.length; i++) {
      const view = this.runeViews[i];
      if (!view) continue;
      const used = i < runeCount;
      view.box.setVisible(used);
      if (!used) {
        view.chip.setVisible(false);
        view.label.setVisible(false);
        continue;
      }
      const gem = loadout?.runes[i] ?? null;
      const selected = this.selectedSlot === i;
      view.box.setStrokeStyle(selected ? 3 : 2, selected ? Palette.gold : Palette.stoneLight);
      if (!gem) {
        view.chip.setVisible(false);
        view.label.setVisible(true).setColor("#8a8490").setText("Empty socket");
        continue;
      }
      const tags = isRuneId(gem.defId) ? RUNES[gem.defId].tags : [];
      const ok = runeMatchesSigil(sigilTags, tags);
      view.chip.setVisible(true).setFillStyle(gemColor(gem), 1);
      view.label
        .setVisible(true)
        .setColor(ok ? "#e8e0d4" : "#8a8490")
        .setText(`${gemName(gem)}\nRune  L${gem.level}${ok ? "" : "  off"}`);
    }

    for (let i = 0; i < this.relicViews.length; i++) {
      const view = this.relicViews[i];
      if (!view) continue;
      const relic = loadout?.relics[i] ?? null;
      const selected = this.selectedKind === "relic" && this.selectedSlot === i;
      view.box.setVisible(true).setStrokeStyle(selected ? 3 : 2, selected ? Palette.gold : Palette.stoneLight);
      if (!relic) {
        view.chip.setVisible(false);
        view.label.setVisible(true).setColor("#8a8490").setText("Empty relic slot");
        continue;
      }
      view.chip.setVisible(true).setFillStyle(itemColor(relic), 1);
      view.label
        .setVisible(true)
        .setColor("#e8e0d4")
        .setText(`${relicDisplayName(relic)}\n${relicRarityLabel(relic.rarity)}`);
    }

    const filled =
      this.selectedSlot !== null &&
      (this.selectedKind === "rune" ? !!loadout?.runes[this.selectedSlot] : !!loadout?.relics[this.selectedSlot]);
    this.unsocketBtn.setFillStyle(filled ? 0x3a1a1a : 0x1a1414);
    this.unsocketBtn.setStrokeStyle(2, filled ? Palette.danger : Palette.stone);
    this.unsocketLabel.setColor(filled ? "#e8e0d4" : "#8a8490");

    this.invRunesMark.setVisible(this.invMode === "rune");
    this.invRelicsMark.setVisible(this.invMode === "relic");

    if (this.invMode === "rune") {
      const inv = profile.runeInventory;
      for (let i = 0; i < this.invViews.length; i++) {
        const view = this.invViews[i];
        const gem = inv[i];
        if (!view) continue;
        if (!gem) {
          view.box.setVisible(false);
          view.chip.setVisible(false);
          view.label.setVisible(false);
          continue;
        }
        const selected = this.selectedUid === gem.uid;
        view.box.setVisible(true).setStrokeStyle(selected ? 3 : 2, selected ? Palette.gold : Palette.stoneLight);
        view.chip.setVisible(true).setFillStyle(gemColor(gem), 1);
        view.label.setVisible(true).setColor("#e8e0d4").setText(`${gemName(gem)}\nRune  L${gem.level}  ${gem.xp} xp`);
      }
      this.hint.setText(this.selectedUid && this.selectedKind === "rune" ? "Tap a socket to link this rune" : "Tap a rune, then a socket");
    } else {
      const inv = profile.relicInventory;
      for (let i = 0; i < this.invViews.length; i++) {
        const view = this.invViews[i];
        const relic = inv[i];
        if (!view) continue;
        if (!relic) {
          view.box.setVisible(false);
          view.chip.setVisible(false);
          view.label.setVisible(false);
          continue;
        }
        const selected = this.selectedUid === relic.uid;
        view.box.setVisible(true).setStrokeStyle(selected ? 3 : 2, selected ? Palette.gold : Palette.stoneLight);
        view.chip.setVisible(true).setFillStyle(itemColor(relic), 1);
        view.label.setVisible(true).setColor("#e8e0d4").setText(`${relicDisplayName(relic)}\n${relicRarityLabel(relic.rarity)}`);
      }
      this.hint.setText(
        this.selectedUid && this.selectedKind === "relic"
          ? "Tap a relic slot to equip"
          : inv.length === 0
            ? "Relics drop in a Breach"
            : "Tap a relic, then a slot",
      );
    }
  }

  getSnapshot(): HubSnapshot {
    const profile = getProfile();
    const loadout = profile.loadouts[this.selected];
    const def = TOWERS[this.selected];
    const preview = resolveLoadout(def, makeGem("sigil", def.starterSigil), loadout?.runes ?? [], loadout?.relics ?? []);
    return {
      ready: true,
      scene: "bastion",
      tab: this.tab,
      selected: this.selected,
      helpVisible: this.help.visible,
      runeInventory: profile.runeInventory.map((g) => ({
        uid: g.uid,
        defId: g.defId,
        kind: g.kind,
        level: g.level,
        xp: g.xp,
      })),
      loadoutRunes: (loadout?.runes ?? []).map((g) =>
        g ? { uid: g.uid, defId: g.defId, kind: g.kind, level: g.level, xp: g.xp } : null,
      ),
      loadoutRelics: (loadout?.relics ?? []).map((r) => (r ? { uid: r.uid, defId: r.defId, rarity: r.rarity } : null)),
      relicInventory: profile.relicInventory.map((r) => ({ uid: r.uid, defId: r.defId, rarity: r.rarity })),
      invMode: this.invMode,
      preview,
    };
  }

  getUiRects(): UiRects {
    const profile = getProfile();
    const loadout = profile.loadouts[this.selected];
    const runeRects: UiRect[] = [];
    const count = loadout?.runes.length ?? 0;
    for (let i = 0; i < count; i++) {
      const v = this.runeViews[i];
      if (v) runeRects.push(v.rect);
    }
    const invRects: UiRect[] = [];
    if (this.invMode === "rune") {
      for (let i = 0; i < this.invViews.length; i++) {
        const v = this.invViews[i];
        const gem = profile.runeInventory[i];
        if (v && gem) invRects.push(v.rect);
      }
    } else {
      for (let i = 0; i < this.invViews.length; i++) {
        const v = this.invViews[i];
        const relic = profile.relicInventory[i];
        if (v && relic) invRects.push(v.rect);
      }
    }
    const relicRects: UiRect[] = this.relicViews.map((v) => v.rect);
    return {
      game: { w: GAME_WIDTH, h: GAME_HEIGHT },
      scene: "bastion",
      helpVisible: this.help.visible,
      helpDismiss: this.help.dismissRect(),
      enterBreach: this.enterRect,
      tabLoadout: this.tabLoadoutRect,
      tabLattice: this.tabLatticeRect,
      unsocket: this.unsocketRect,
      towers: this.towerRects,
      runeSockets: runeRects,
      relics: relicRects,
      inventory: invRects,
      invTabRunes: this.invRunesRect,
      invTabRelics: this.invRelicsRect,
      startWave: { x: 0, y: 0, w: 0, h: 0 },
      inscribe: { x: 0, y: 0, w: 0, h: 0 },
      panel: null,
      returnToBastion: null,
    };
  }

  private exposeDebug(): void {
    window.__towerForge = {
      ready: true,
      scene: "bastion",
      placeTower: () => false,
      startWave: () => false,
      getState: () => this.getSnapshot(),
      firstBuildableNearPath: () => ({ col: 3, row: 5 }),
      stress: () => ({ spawned: 0, fps: 0 }),
      enemyPositions: () => [],
      openPanel: () => false,
      closePanel: () => undefined,
      dismissHelp: () => this.help.dismiss(),
      getUiRects: () => this.getUiRects(),
      socketByDef: () => false,
      giveRelic: (defId?: string, rarity: RelicRarity = "magic") => {
        const relic = makeRelic((defId as "ember-core") || "ember-core", rarity, 6);
        getProfile().relicInventory.push(relic);
        persistProfile();
        this.refresh();
        return relic;
      },
      getProfile: () => getProfile(),
      forceOutcome: () => undefined,
    };
  }
}

function formatPreview(r: ResolvedAttack): string {
  const dmg = Math.round(r.damage * 10) / 10;
  const rate = Math.round(r.attackRate * 100) / 100;
  const gold = r.goldMult !== 1 ? `    Gold ×${Math.round(r.goldMult * 100) / 100}` : "";
  return `Damage ${dmg}    Rate ${rate}/s    Range ${r.range}    Projectiles ${r.projectileCount}    Chain ${r.chainCount}    Pierce ${r.pierceCount}${gold}`;
}
