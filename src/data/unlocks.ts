/** Progressive feature unlocks. A feature opens after `afterDepth` Depths have been cleared. */

export type FeatureId = "runes" | "relics" | "stash" | "forge" | "enemy-mods" | "lattice";

export type FeatureDef = {
  id: FeatureId;
  name: string;
  /** Unlocked once highestDepthCleared reaches this value. 0 = available at the start. */
  afterDepth: number;
  title: string;
  body: string;
};

export const FEATURES: Record<FeatureId, FeatureDef> = {
  runes: {
    id: "runes",
    name: "Runes",
    afterDepth: 1,
    title: "Runes are unbound",
    body: "You can now socket Runes into a frame in the Bastion. The shop between waves will also sell basic Runes.",
  },
  relics: {
    id: "relics",
    name: "Relics",
    afterDepth: 2,
    title: "Relics found",
    body: "Relic slots are open on your loadout. Equipped Relics change how a frame fights.",
  },
  stash: {
    id: "stash",
    name: "Stash",
    afterDepth: 2,
    title: "The Stash is open",
    body: "The Stash keeps every gem, Relic, and currency you bring back from a Breach.",
  },
  forge: {
    id: "forge",
    name: "Forge",
    afterDepth: 3,
    title: "The Ember Forge",
    body: "Spend crafting currency to change Relics. Currency can now drop in the Breach.",
  },
  "enemy-mods": {
    id: "enemy-mods",
    name: "Pack mods",
    afterDepth: 3,
    title: "The mist thickens",
    body: "Magic and Rare foes now appear with pack mods. Rares wear an ember outline — be ready.",
  },
  lattice: {
    id: "lattice",
    name: "Lattice",
    afterDepth: 4,
    title: "The Ember Lattice",
    body: "Account points from clears can be bound on the Ember Lattice for lasting bonuses.",
  },
};

/** Popup and unlock order. */
export const FEATURE_IDS: readonly FeatureId[] = ["runes", "relics", "stash", "forge", "enemy-mods", "lattice"];

export function isFeatureId(value: string): value is FeatureId {
  return Object.prototype.hasOwnProperty.call(FEATURES, value);
}

export function isFeatureUnlocked(id: FeatureId, highestDepthCleared: number): boolean {
  return highestDepthCleared >= FEATURES[id].afterDepth;
}

export function featureUnlockDepth(id: FeatureId): number {
  return FEATURES[id].afterDepth;
}

/** Features the player has earned but has not been shown a popup for, in order. */
export function pendingUnlocks(highestDepthCleared: number, seen: readonly string[]): FeatureDef[] {
  const out: FeatureDef[] = [];
  for (const id of FEATURE_IDS) {
    if (isFeatureUnlocked(id, highestDepthCleared) && !seen.includes(id)) out.push(FEATURES[id]);
  }
  return out;
}

/**
 * Old saves have no seen list. Mark every feature already implied by their
 * clear depth as seen so they are not spammed with catch-up popups.
 */
export function migrateSeenUnlocks(highestDepthCleared: number, rawSeen: unknown): string[] {
  if (Array.isArray(rawSeen)) {
    return rawSeen.filter((id): id is string => typeof id === "string" && isFeatureId(id));
  }
  const seen: string[] = [];
  for (const id of FEATURE_IDS) {
    if (isFeatureUnlocked(id, highestDepthCleared)) seen.push(id);
  }
  return seen;
}
