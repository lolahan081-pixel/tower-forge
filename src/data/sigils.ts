import type { GemTag } from "./tags";

export type SigilId = "cinder-orb" | "forked-spark" | "hoarfrost-burst" | "crimson-spike";

export type SigilBehaviour = "projectile" | "chain" | "nova" | "pierce";

export type SigilDef = {
  id: SigilId;
  name: string;
  tags: readonly GemTag[];
  behaviour: SigilBehaviour;
  /** Added to the frame's base damage, then scaled by gem level. */
  baseDamage: number;
  /** Pixels per second. 0 means an instant hit (used by chain beams). */
  projectileSpeed: number;
  chainCount: number;
  pierceCount: number;
  novaRadius: number;
  color: number;
  accent: number;
  texture: string;
};

export const SIGILS: Record<SigilId, SigilDef> = {
  "cinder-orb": {
    id: "cinder-orb",
    name: "Cinder Orb",
    tags: ["projectile", "fire"],
    behaviour: "projectile",
    baseDamage: 8,
    projectileSpeed: 420,
    chainCount: 0,
    pierceCount: 0,
    novaRadius: 0,
    color: 0xc4451c,
    accent: 0xe86a2a,
    texture: "cinder-orb",
  },
  "forked-spark": {
    id: "forked-spark",
    name: "Forked Spark",
    tags: ["spell", "lightning", "chain"],
    behaviour: "chain",
    baseDamage: 7,
    projectileSpeed: 0,
    chainCount: 3,
    pierceCount: 0,
    novaRadius: 0,
    color: 0xc8b44a,
    accent: 0xe8d47a,
    texture: "spark-bolt",
  },
  "hoarfrost-burst": {
    id: "hoarfrost-burst",
    name: "Hoarfrost Burst",
    tags: ["spell", "cold", "nova"],
    behaviour: "nova",
    baseDamage: 10,
    projectileSpeed: 0,
    chainCount: 0,
    pierceCount: 0,
    novaRadius: 80,
    color: 0x6a9bb8,
    accent: 0x9fd0e8,
    texture: "frost-bolt",
  },
  "crimson-spike": {
    id: "crimson-spike",
    name: "Crimson Spike",
    tags: ["projectile", "spell", "blood", "pierce"],
    behaviour: "pierce",
    baseDamage: 14,
    projectileSpeed: 500,
    chainCount: 0,
    pierceCount: 3,
    novaRadius: 0,
    color: 0x8b1a1a,
    accent: 0xc42222,
    texture: "blood-spike",
  },
};

export const SIGIL_IDS: SigilId[] = ["cinder-orb", "forked-spark", "hoarfrost-burst", "crimson-spike"];

export function isSigilId(value: string): value is SigilId {
  return Object.prototype.hasOwnProperty.call(SIGILS, value);
}
