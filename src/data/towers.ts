import type { StatBlock } from "./stats";
import type { FrameTag } from "./tags";

export type TowerId = "ember-spire" | "blood-font";

export type TowerDef = {
  id: TowerId;
  name: string;
  cost: number;
  /** Socket count on this frame (2–6). All sockets form one Inscription. */
  sockets: number;
  /** Base stats. Unused until a Sigil is inscribed. */
  stats: StatBlock;
  tags: readonly FrameTag[];
  color: number;
  accent: number;
};

export const TOWERS: Record<TowerId, TowerDef> = {
  "ember-spire": {
    id: "ember-spire",
    name: "Ember Spire",
    cost: 40,
    sockets: 3,
    stats: { damage: 8, attackRate: 1.35, range: 140 },
    tags: ["projectile"],
    color: 0x2a2420,
    accent: 0xc4451c,
  },
  "blood-font": {
    id: "blood-font",
    name: "Blood Font",
    cost: 75,
    sockets: 4,
    stats: { damage: 14, attackRate: 0.7, range: 120 },
    tags: ["spell"],
    color: 0x1c1214,
    accent: 0x8b1a1a,
  },
};

export const TOWER_IDS: TowerId[] = ["ember-spire", "blood-font"];

export function isTowerId(value: string): value is TowerId {
  return value === "ember-spire" || value === "blood-font";
}
