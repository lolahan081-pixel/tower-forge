import type { EnemyId } from "./enemies";

export type WaveSpawn = {
  enemyId: EnemyId;
  count: number;
  /** Time between spawns in this group, in milliseconds. */
  intervalMs: number;
  /** Delay after the wave starts before this group begins, in milliseconds. */
  delayMs: number;
};

export type WaveDef = {
  id: number;
  spawns: WaveSpawn[];
};

export const WAVES: WaveDef[] = [
  {
    id: 1,
    spawns: [{ enemyId: "wretch", count: 6, intervalMs: 700, delayMs: 0 }],
  },
  {
    id: 2,
    spawns: [{ enemyId: "wretch", count: 10, intervalMs: 550, delayMs: 0 }],
  },
  {
    id: 3,
    spawns: [
      { enemyId: "wretch", count: 8, intervalMs: 500, delayMs: 0 },
      { enemyId: "brute", count: 3, intervalMs: 1200, delayMs: 1500 },
    ],
  },
  {
    id: 4,
    spawns: [
      { enemyId: "wretch", count: 12, intervalMs: 420, delayMs: 0 },
      { enemyId: "brute", count: 5, intervalMs: 900, delayMs: 800 },
    ],
  },
  {
    id: 5,
    spawns: [
      { enemyId: "wretch", count: 16, intervalMs: 360, delayMs: 0 },
      { enemyId: "brute", count: 8, intervalMs: 700, delayMs: 600 },
    ],
  },
];
