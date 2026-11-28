import { ENEMIES } from "./enemies";
import type { WaveDef } from "./waves";

export const MAX_DEPTH = 10;
export const WAVES_PER_BREACH = 10;

export type DepthBand = "steady" | "harsh" | "dire" | "sovereign";

export type DepthScale = {
  hp: number;
  count: number;
  speed: number;
  /** Multiplier on base spawn interval (lower is denser). */
  interval: number;
  magic: number;
  rare: number;
  unique: number;
  lives: number;
  gold: number;
  startGold: number;
  bossHp: number;
  band: DepthBand;
};

/** Depth 1–3 stay relaxed; the curve steps up at 4 and keeps climbing. */
const SCALES: readonly DepthScale[] = [
  /* 0 unused */ { hp: 1, count: 1, speed: 1, interval: 1, magic: 0, rare: 0, unique: 0, lives: 20, gold: 1, startGold: 100, bossHp: 1, band: "steady" },
  { hp: 1.0, count: 1.0, speed: 1.0, interval: 1.0, magic: 0.04, rare: 0.0, unique: 0, lives: 20, gold: 1.0, startGold: 100, bossHp: 1.0, band: "steady" },
  { hp: 1.1, count: 1.05, speed: 1.02, interval: 0.98, magic: 0.06, rare: 0.01, unique: 0, lives: 20, gold: 1.08, startGold: 100, bossHp: 1.08, band: "steady" },
  { hp: 1.22, count: 1.12, speed: 1.04, interval: 0.95, magic: 0.1, rare: 0.02, unique: 0, lives: 20, gold: 1.16, startGold: 100, bossHp: 1.18, band: "steady" },
  { hp: 1.55, count: 1.3, speed: 1.1, interval: 0.88, magic: 0.16, rare: 0.06, unique: 0, lives: 16, gold: 1.3, startGold: 120, bossHp: 1.45, band: "harsh" },
  { hp: 1.85, count: 1.45, speed: 1.14, interval: 0.82, magic: 0.2, rare: 0.08, unique: 0.01, lives: 16, gold: 1.42, startGold: 120, bossHp: 1.7, band: "harsh" },
  { hp: 2.2, count: 1.6, speed: 1.18, interval: 0.76, magic: 0.24, rare: 0.1, unique: 0.015, lives: 16, gold: 1.55, startGold: 130, bossHp: 2.05, band: "harsh" },
  { hp: 2.6, count: 1.8, speed: 1.24, interval: 0.7, magic: 0.28, rare: 0.12, unique: 0.02, lives: 14, gold: 1.7, startGold: 140, bossHp: 2.45, band: "dire" },
  { hp: 3.1, count: 2.0, speed: 1.3, interval: 0.64, magic: 0.32, rare: 0.15, unique: 0.03, lives: 14, gold: 1.85, startGold: 140, bossHp: 2.95, band: "dire" },
  { hp: 3.7, count: 2.2, speed: 1.36, interval: 0.58, magic: 0.36, rare: 0.18, unique: 0.04, lives: 14, gold: 2.0, startGold: 160, bossHp: 3.55, band: "sovereign" },
  { hp: 4.4, count: 2.4, speed: 1.42, interval: 0.52, magic: 0.4, rare: 0.22, unique: 0.05, lives: 12, gold: 2.2, startGold: 160, bossHp: 4.25, band: "sovereign" },
];

const BAND_LABEL: Record<DepthBand, string> = {
  steady: "Steady",
  harsh: "Harsh",
  dire: "Dire",
  sovereign: "Sovereign",
};

export function clampDepth(depth: number): number {
  return Math.max(1, Math.min(MAX_DEPTH, Math.round(depth) || 1));
}

export function scaleFor(depth: number): DepthScale {
  return SCALES[clampDepth(depth)] ?? SCALES[1]!;
}

export function isDepthUnlocked(depth: number, highestCleared: number): boolean {
  return depth >= 1 && depth <= MAX_DEPTH && depth <= highestCleared + 1;
}

export function livesForDepth(depth: number): number {
  return scaleFor(depth).lives;
}

export function startingGoldForDepth(depth: number): number {
  return scaleFor(depth).startGold;
}

export function hpScale(depth: number): number {
  return scaleFor(depth).hp;
}

export function countScale(depth: number): number {
  return scaleFor(depth).count;
}

export function speedScale(depth: number): number {
  return scaleFor(depth).speed;
}

export function goldScale(depth: number): number {
  return scaleFor(depth).gold;
}

export function bossHpScale(depth: number): number {
  return scaleFor(depth).bossHp;
}

export function difficultyBand(depth: number): DepthBand {
  return scaleFor(depth).band;
}

export function difficultyLabel(depth: number): string {
  return BAND_LABEL[difficultyBand(depth)];
}

/** 1–4 pips for HUD and Atlas cards. */
export function difficultyPips(depth: number): number {
  const band = difficultyBand(depth);
  if (band === "sovereign") return 4;
  if (band === "dire") return 3;
  if (band === "harsh") return 2;
  return 1;
}

export function pipText(depth: number): string {
  return "▲".repeat(difficultyPips(depth));
}

/** Magic/rare/unique chance. Relaxed at Depth 1–3. Unique packs start at Depth 5. */
export function modChance(depth: number): { magic: number; rare: number; unique: number } {
  const s = scaleFor(depth);
  return { magic: s.magic, rare: s.rare, unique: s.unique };
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
  return Math.max(200, Math.round(ms * scaleFor(depth).interval));
}

/**
 * Ten-wave Breach. Waves 1–9 are trash packs; wave 10 is the Unique boss
 * plus a growing escort. Counts and pacing scale with Depth.
 */
export function buildBreachWaves(depth: number): WaveDef[] {
  const d = clampDepth(depth);
  const iv = (ms: number) => interval(ms, d);
  const n = (c: number) => scaled(c, d);
  const bossEscort = d >= 4 ? n(6 + d) : n(8);
  const bossBrutes = d >= 4 ? n(Math.max(1, d - 3)) : 0;
  const lateUnique = d >= 7;
  const waves: WaveDef[] = [
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
      { enemyId: "brute", count: n(10) + (lateUnique ? 1 : 0), intervalMs: iv(600), delayMs: 400 },
    ]},
    { id: 10, spawns: [
      { enemyId: "wretch", count: bossEscort, intervalMs: iv(400), delayMs: 0 },
      ...(bossBrutes > 0
        ? [{ enemyId: "brute" as const, count: bossBrutes, intervalMs: iv(700), delayMs: 900 }]
        : []),
      { enemyId: "hollow-sovereign", count: 1, intervalMs: 0, delayMs: 1800 },
    ]},
  ];
  return waves;
}

export type DepthPreview = {
  depth: number;
  label: string;
  pips: number;
  lives: number;
  startGold: number;
  hp: number;
  speed: number;
  count: number;
  interval: number;
  magic: number;
  rare: number;
  unique: number;
  bossHp: number;
  totals: { enemies: number; wretch: number; brute: number; boss: number; wretchHp: number; bruteHp: number; bossHp: number };
};

export function depthPreview(depth: number): DepthPreview {
  const d = clampDepth(depth);
  const s = scaleFor(d);
  const waves = buildBreachWaves(d);
  let wretch = 0;
  let brute = 0;
  let boss = 0;
  for (const wave of waves) {
    for (const sp of wave.spawns) {
      if (sp.enemyId === "wretch") wretch += sp.count;
      else if (sp.enemyId === "brute") brute += sp.count;
      else if (sp.enemyId === "hollow-sovereign") boss += sp.count;
    }
  }
  return {
    depth: d,
    label: difficultyLabel(d),
    pips: difficultyPips(d),
    lives: s.lives,
    startGold: s.startGold,
    hp: s.hp,
    speed: s.speed,
    count: s.count,
    interval: s.interval,
    magic: s.magic,
    rare: s.rare,
    unique: s.unique,
    bossHp: s.bossHp,
    totals: {
      enemies: wretch + brute + boss,
      wretch,
      brute,
      boss,
      wretchHp: Math.round(ENEMIES.wretch.maxHp * s.hp),
      bruteHp: Math.round(ENEMIES.brute.maxHp * s.hp),
      bossHp: Math.round(ENEMIES["hollow-sovereign"].maxHp * s.bossHp),
    },
  };
}
