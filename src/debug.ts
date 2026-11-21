import type { GameSnapshot } from "./game/GameScene";
import type { UiRect } from "./game/ui";

export type UiRects = {
  game: { w: number; h: number };
  helpVisible: boolean;
  helpDismiss: UiRect;
  startWave: UiRect;
  inscribe: UiRect;
  towers: Record<string, UiRect>;
  panel: {
    invPage: number;
    invPageSize: number;
    close: UiRect;
    unsocket: UiRect;
    sockets: UiRect[];
    inventory: UiRect[];
    prev: UiRect;
    next: UiRect;
  } | null;
};

export type TowerForgeDebug = {
  ready: boolean;
  placeTower: (col: number, row: number, towerId?: string) => boolean;
  startWave: () => boolean;
  getState: () => GameSnapshot;
  firstBuildableNearPath: () => { col: number; row: number };
  stress: (count: number) => { spawned: number; fps: number };
  enemyPositions: () => { x: number; y: number; progress: number; hp: number }[];
  openPanel: (col: number, row: number) => boolean;
  closePanel: () => void;
  dismissHelp: () => void;
  getUiRects: () => UiRects;
  socketByDef: (col: number, row: number, defId: string) => boolean;
};

declare global {
  interface Window {
    __towerForge?: TowerForgeDebug;
  }
}

export {};
