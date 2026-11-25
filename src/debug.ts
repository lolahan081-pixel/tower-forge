import type { PlayerProfile } from "./data/profile";
import type { ResolvedAttack } from "./data/stats";
import type { UiRect } from "./game/ui";

export type GemSnap = { uid: string; defId: string; kind: string; level: number; xp: number };

export type UiRects = {
  game: { w: number; h: number };
  scene: "bastion" | "game" | "menu";
  helpVisible: boolean;
  helpDismiss: UiRect;
  startWave: UiRect;
  inscribe: UiRect;
  towers: Record<string, UiRect>;
  enterBreach?: UiRect;
  tabLoadout?: UiRect;
  tabLattice?: UiRect;
  tabStash?: UiRect;
  tabForge?: UiRect;
  depthSelect?: { depths: UiRect[]; enter: UiRect; close: UiRect } | null;
  latticeNodes?: Record<string, UiRect>;
  latticeView?: UiRect;
  shop?: { offers: UiRect[]; close: UiRect } | null;
  spoilsTake?: UiRect | null;
  forgeRelics?: UiRect[];
  forgeCurrencies?: UiRect[];
  forgeApply?: UiRect;
  unsocket?: UiRect;
  runeSockets?: UiRect[];
  relics?: UiRect[];
  inventory?: UiRect[];
  invTabRunes?: UiRect;
  invTabRelics?: UiRect;
  returnToBastion: UiRect | null;
  menuButton?: UiRect;
  menuStart?: UiRect;
  menuBastion?: UiRect;
  menuHowToPlay?: UiRect;
  menuSettings?: UiRect;
  settingsCancel?: UiRect | null;
  settingsConfirm?: UiRect | null;
  unlockOk?: UiRect | null;
  battleHintOk?: UiRect | null;
  panel: {
    close: UiRect;
    unsocket: UiRect;
    currentSigil?: UiRect;
    inventory: UiRect[];
    runes?: UiRect[];
  } | null;
};

export type HubSnapshot = {
  ready: boolean;
  scene: "bastion";
  tab: "loadout" | "stash" | "forge" | "lattice";
  selected: string;
  helpVisible: boolean;
  runeInventory: GemSnap[];
  loadoutRunes: (GemSnap | null)[];
  loadoutRelics?: ({ uid: string; defId: string; rarity: string } | null)[];
  relicInventory?: { uid: string; defId: string; rarity: string }[];
  invMode?: "rune" | "relic";
  preview: ResolvedAttack;
};

export type GameSnapshot = {
  ready: boolean;
  scene: "game";
  gold: number;
  lives: number;
  wave: number;
  waveActive: boolean;
  enemiesAlive: number;
  towers: number;
  projectiles: number;
  peakProjectiles: number;
  lastVolleyCount: number;
  fps: number;
  outcome: "playing" | "won" | "lost";
  selected: string;
  panelOpen: boolean;
  helpVisible: boolean;
  inventory: GemSnap[];
  towerSockets: {
    col: number;
    row: number;
    sockets: (GemSnap | null)[];
    resolved: ResolvedAttack;
  }[];
};

export type MenuSnapshot = {
  ready: boolean;
  scene: "menu";
  hasStarted: boolean;
};

export type TowerForgeDebug = {
  ready: boolean;
  scene: "bastion" | "game" | "menu";
  placeTower: (col: number, row: number, towerId?: string) => boolean;
  startWave: () => boolean;
  getState: () => HubSnapshot | GameSnapshot | MenuSnapshot;
  firstBuildableNearPath: () => { col: number; row: number };
  stress: (count: number) => { spawned: number; fps: number };
  enemyPositions: () => { x: number; y: number; progress: number; hp: number }[];
  openPanel: (col: number, row: number) => boolean;
  closePanel: () => void;
  dismissHelp: () => void;
  getUiRects: () => UiRects;
  socketByDef: (col: number, row: number, defId: string) => boolean;
  getProfile: () => PlayerProfile;
  forceOutcome: (outcome: "won" | "lost") => void;
  getSpoils?: () => unknown[];
  collectSpoils?: () => void;
  giveRelic?: (defId?: string, rarity?: "normal" | "magic" | "rare") => unknown;
  giveCurrency?: (id: string, qty?: number) => void;
  givePoints?: (n?: number) => void;
  allocateNode?: (id: string) => unknown;
  latticeNodes?: Record<string, UiRect>;
  guaranteeDrop?: (kind?: "off" | "relic" | "rune" | "sigil" | "currency") => void;
  shopOffers?: () => unknown[];
  buyShop?: (index: number) => boolean;
  guaranteeRarity?: (rarity?: "off" | "normal" | "magic" | "rare" | "unique") => void;
  spawnModified?: (rarity?: "normal" | "magic" | "rare" | "unique") => unknown;
  setTimeScale?: (scale: number) => void;
  resetProfile?: () => void;
  setHighestDepthCleared?: (depth: number) => void;
  clearSeenUnlocks?: () => void;
  markHasStarted?: () => void;
};

declare global {
  interface Window {
    __towerForge?: TowerForgeDebug;
  }
}

export {};
