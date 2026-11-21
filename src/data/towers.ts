import type { StatBlock } from "./stats";

export type TowerId = "ember-spire" | "blood-font";

export type FireMode = "projectile" | "instant";

export type TowerDef = {
  id: TowerId;
  name: string;
  cost: number;
  stats: StatBlock;
  fire: FireMode;
  /** Pixels per second. Unused for instant hits. */
  projectileSpeed: number;
  color: number;
  accent: number;
};

export const TOWERS: Record<TowerId, TowerDef> = {
  "ember-spire": {
    id: "ember-spire",
    name: "Ember Spire",
    cost: 40,
    stats: { damage: 8, attackRate: 1.35, range: 140 },
    fire: "projectile",
    projectileSpeed: 420,
    color: 0x2a2420,
    accent: 0xc4451c,
  },
  "blood-font": {
    id: "blood-font",
    name: "Blood Font",
    cost: 75,
    stats: { damage: 22, attackRate: 0.7, range: 120 },
    fire: "instant",
    projectileSpeed: 0,
    color: 0x1c1214,
    accent: 0x8b1a1a,
  },
};

export const TOWER_IDS: TowerId[] = ["ember-spire", "blood-font"];

export function isTowerId(value: string): value is TowerId {
  return value === "ember-spire" || value === "blood-font";
}
