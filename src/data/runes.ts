import type { GemTag } from "./tags";

export type RuneId = "split-volley" | "linked-arc" | "through-flesh" | "rime-touch" | "quickening";

/** Numeric modifiers. Multipliers default to 1, additives to 0, conversion to 0. */
export type RuneModifiers = {
  addProjectiles: number;
  damageMult: number;
  addChain: number;
  addPierce: number;
  attackRateMult: number;
  convertToCold: number;
};

export type RuneDef = {
  id: RuneId;
  name: string;
  /** Applies only if every tag is present on the linked Sigil. */
  tags: readonly GemTag[];
  modifiers: RuneModifiers;
  color: number;
};

const NONE: RuneModifiers = {
  addProjectiles: 0,
  damageMult: 1,
  addChain: 0,
  addPierce: 0,
  attackRateMult: 1,
  convertToCold: 0,
};

export const RUNES: Record<RuneId, RuneDef> = {
  "split-volley": {
    id: "split-volley",
    name: "Split Volley",
    tags: ["projectile"],
    modifiers: { ...NONE, addProjectiles: 2, damageMult: 0.75 },
    color: 0xc9a227,
  },
  "linked-arc": {
    id: "linked-arc",
    name: "Linked Arc",
    tags: ["projectile"],
    modifiers: { ...NONE, addChain: 2 },
    color: 0xc8b44a,
  },
  "through-flesh": {
    id: "through-flesh",
    name: "Through-Flesh",
    tags: ["projectile"],
    modifiers: { ...NONE, addPierce: 2 },
    color: 0x8a8490,
  },
  "rime-touch": {
    id: "rime-touch",
    name: "Rime Touch",
    tags: [],
    modifiers: { ...NONE, convertToCold: 0.4 },
    color: 0x6a9bb8,
  },
  quickening: {
    id: "quickening",
    name: "Quickening",
    tags: [],
    modifiers: { ...NONE, attackRateMult: 1.3 },
    color: 0xe8c547,
  },
};

export const RUNE_IDS: RuneId[] = ["split-volley", "linked-arc", "through-flesh", "rime-touch", "quickening"];

export function isRuneId(value: string): value is RuneId {
  return Object.prototype.hasOwnProperty.call(RUNES, value);
}
