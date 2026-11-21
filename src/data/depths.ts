import type { WaveDef } from "./waves";

export const MAX_DEPTH = 10;
export const WAVES_PER_BREACH = 10;

export function isDepthUnlocked(depth: number, highestCleared: number): boolean {
  return depth >= 1 && depth <= MAX_DEPTH && depth <= highestCleared + 1;
}

export function livesForDepth(depth: number): number {
  if (depth <= 3) return 20;
  if (depth <= 6) return 16;
  return 14;
}

export function hpScale(depth: number): number {
  return 1 + Math.max(0, depth - 1) * 0.18;
}

export function countScale(depth: number): number {
  return 1 + Math.max(0, depth - 1) * 0.12;
}

export function speedScale(depth: number): number {
  return 1 + Math.max(0, depth - 1) * 0.04;
}

export function goldScale(depth: number): number {
  return 1 + Math.max(0, depth - 1) * 0.1;
}

/** Magic/rare chance. Relaxed at Depth 1–3. */
export function modChance(depth: number): { magic: number; rare: number } {
  if (depth <= 3) return { magic: 0.04 * depth, rare: 0.01 * depth };
  return { magic: Math.min(0.28, 0.08 + depth * 0.02), rare: Math.min(0.12, 0.02 + depth * 0.01) };
}

export function pointsForClear(depth: number): number {
  if (depth <= 3) return 1;
  if (depth <= 7) return 2;
  return 3;
}

export function accountXpForClear(depth: number): number {
  return 8 + depth * 2;
}

function scaled(count: number, depth: number): number {
  return Math.max(1, Math.round(count * countScale(depth)));
}

function interval(ms: number, depth: number): number {
  return Math.max(220, Math.round(ms * (1 - Math.max(0, depth - 1) * 0.03)));
}

/**
 * Ten-wave Breach. Waves 1–9 are trash packs; wave 10 is the Unique boss
 * plus a small escort. Counts and pacing scale with Depth.
 */
export function buildBreachWaves(depth: number): WaveDef[] {
  const d = Math.max(1, Math.min(MAX_DEPTH, depth));
  const iv = (ms: number) => interval(ms, d);
  const n = (c: number) => scaled(c, d);
  return [
    { id: 1, spawns: [{ enemyId: "wretch", count: n(6), intervalMs: iv(700), delayMs: 0 }] },
    { id: 2, spawns: [{ enemyId: "wretch", count: n(10), intervalMs: iv(550), delayMs: 0 }] },
    { id: 3, spawns: [
      { enemyId: "wretch", count: n(8), intervalMs: iv(500), delayMs: 0 },
      { enemyId: "brute", count: n(3), intervalMs: iv(1200), delayMs: 1500 },
    ]},
    { id: 4, spawns: [
      { enemyId: "wretch", count: n(12), intervalMs: iv(420), delayMs: 0 },
      { enemyId: "brute", count: n(5), intervalMs: iv(900), delayMs: 800 },
    ]},
    { id: 5, spawns: [
      { enemyId: "wretch", count: n(14), intervalMs: iv(400), delayMs: 0 },
      { enemyId: "brute", count: n(6), intervalMs: iv(800), delayMs: 700 },
    ]},
    { id: 6, spawns: [
      { enemyId: "wretch", count: n(16), intervalMs: iv(360), delayMs: 0 },
      { enemyId: "brute", count: n(7), intervalMs: iv(750), delayMs: 600 },
    ]},
    { id: 7, spawns: [
      { enemyId: "wretch", count: n(18), intervalMs: iv(340), delayMs: 0 },
      { enemyId: "brute", count: n(8), intervalMs: iv(700), delayMs: 500 },
    ]},
    { id: 8, spawns: [
      { enemyId: "wretch", count: n(16), intervalMs: iv(320), delayMs: 0 },
      { enemyId: "brute", count: n(10), intervalMs: iv(640), delayMs: 400 },
    ]},
    { id: 9, spawns: [
      { enemyId: "wretch", count: n(20), intervalMs: iv(300), delayMs: 0 },
      { enemyId: "brute", count: n(10), intervalMs: iv(600), delayMs: 400 },
    ]},
    { id: 10, spawns: [
      { enemyId: "wretch", count: n(8), intervalMs: iv(400), delayMs: 0 },
      { enemyId: "hollow-sovereign", count: 1, intervalMs: 0, delayMs: 1800 },
    ]},
  ];
}
