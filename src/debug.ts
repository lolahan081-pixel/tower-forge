import type { GameSnapshot } from "./game/GameScene";

export type TowerForgeDebug = {
  ready: boolean;
  placeTower: (col: number, row: number, towerId?: string) => boolean;
  startWave: () => boolean;
  getState: () => GameSnapshot;
  firstBuildableNearPath: () => { col: number; row: number };
  stress: (count: number) => { spawned: number; fps: number };
  enemyPositions: () => { x: number; y: number; progress: number; hp: number }[];
  openPanel: (col: number, row: number) => boolean;
  socketByDef: (col: number, row: number, defId: string) => boolean;
};

declare global {
  interface Window {
    __towerForge?: TowerForgeDebug;
  }
}

export {};
