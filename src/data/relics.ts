import { newUid } from "./items";
import { copyMods, IDENTITY_MODS, stackMod, type StatMods } from "./modifiers";

export type RelicRarity = "normal" | "magic" | "rare";
export type AffixKind = "prefix" | "suffix";
export type RelicId = "ember-core" | "blood-censer" | "ashen-band" | "gate-seal";

export type AffixTier = {
  ilvl: number;
} & Partial<StatMods>;

export type AffixDef = {
  id: string;
  name: string;
  kind: AffixKind;
  tiers: readonly AffixTier[];
};

export type RelicBase = {
  id: RelicId;
  name: string;
  implicit: Partial<StatMods>;
  color: number;
  texture: string;
};

export type RolledAffix = { id: string; tier: number };

export type RelicInstance = {
  uid: string;
  defId: RelicId;
  kind: "relic";
  rarity: RelicRarity;
  itemLevel: number;
  affixes: RolledAffix[];
  corrupted: boolean;
};

export const RELICS: Record<RelicId, RelicBase> = {
  "ember-core": {
    id: "ember-core",
    name: "Ember Core",
    implicit: { addDamage: 4 },
    color: 0xc4451c,
    texture: "relic-ember",
  },
  "blood-censer": {
    id: "blood-censer",
    name: "Blood Censer",
    implicit: { damageMult: 1.12 },
    color: 0x8b1a1a,
    texture: "relic-blood",
  },
  "ashen-band": {
    id: "ashen-band",
    name: "Ashen Band",
    implicit: { attackRateMult: 1.1 },
    color: 0xc9a227,
    texture: "relic-ash",
  },
  "gate-seal": {
    id: "gate-seal",
    name: "Gate Seal",
    implicit: { addRange: 16 },
    color: 0x8a8490,
    texture: "relic-gate",
  },
};

export const RELIC_IDS: RelicId[] = ["ember-core", "blood-censer", "ashen-band", "gate-seal"];

export const AFFIXES: Record<string, AffixDef> = {
  searing: {
    id: "searing",
    name: "Searing",
    kind: "prefix",
    tiers: [
      { ilvl: 1, addDamage: 3 },
      { ilvl: 5, addDamage: 6 },
      { ilvl: 10, addDamage: 10 },
    ],
  },
  ruinous: {
    id: "ruinous",
    name: "Ruinous",
    kind: "prefix",
    tiers: [
      { ilvl: 1, damageMult: 1.08 },
      { ilvl: 5, damageMult: 1.14 },
      { ilvl: 10, damageMult: 1.22 },
    ],
  },
  split: {
    id: "split",
    name: "Split",
    kind: "prefix",
    tiers: [
      { ilvl: 1, addProjectiles: 1 },
      { ilvl: 8, addProjectiles: 2 },
    ],
  },
  alacrity: {
    id: "alacrity",
    name: "of Alacrity",
    kind: "suffix",
    tiers: [
      { ilvl: 1, attackRateMult: 1.08 },
      { ilvl: 5, attackRateMult: 1.14 },
      { ilvl: 10, attackRateMult: 1.22 },
    ],
  },
  reach: {
    id: "reach",
    name: "of Reach",
    kind: "suffix",
    tiers: [
      { ilvl: 1, addRange: 12 },
      { ilvl: 5, addRange: 20 },
      { ilvl: 10, addRange: 32 },
    ],
  },
  arcs: {
    id: "arcs",
    name: "of Arcs",
    kind: "suffix",
    tiers: [
      { ilvl: 1, addChain: 1 },
      { ilvl: 8, addChain: 2 },
    ],
  },
  passing: {
    id: "passing",
    name: "of Passing",
    kind: "suffix",
    tiers: [
      { ilvl: 1, addPierce: 1 },
      { ilvl: 8, addPierce: 2 },
    ],
  },
  plenty: {
    id: "plenty",
    name: "of Plenty",
    kind: "suffix",
    tiers: [
      { ilvl: 1, goldMult: 1.1 },
      { ilvl: 5, goldMult: 1.2 },
      { ilvl: 10, goldMult: 1.35 },
    ],
  },
};

export const AFFIX_IDS = Object.keys(AFFIXES);
export const PREFIX_IDS = AFFIX_IDS.filter((id) => AFFIXES[id]?.kind === "prefix");
export const SUFFIX_IDS = AFFIX_IDS.filter((id) => AFFIXES[id]?.kind === "suffix");

export function isRelicId(value: string): value is RelicId {
  return Object.prototype.hasOwnProperty.call(RELICS, value);
}

export function isRelic(value: unknown): value is RelicInstance {
  if (value === null || typeof value !== "object") return false;
  const r = value as RelicInstance;
  return r.kind === "relic" && typeof r.uid === "string" && isRelicId(r.defId) && Array.isArray(r.affixes);
}

export function pickTier(def: AffixDef, ilvl: number): number {
  let best = 0;
  for (let i = 0; i < def.tiers.length; i++) {
    const t = def.tiers[i];
    if (t && t.ilvl <= ilvl) best = i;
  }
  return best;
}

function pickId(ids: readonly string[], exclude: Set<string>, rng: () => number): string | null {
  const pool: string[] = [];
  for (const id of ids) if (!exclude.has(id)) pool.push(id);
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)] ?? null;
}

export function addRandomAffix(relic: RelicInstance, kind: AffixKind | "any", rng: () => number = Math.random): boolean {
  if (relic.corrupted) return false;
  const used = new Set(relic.affixes.map((a) => a.id));
  const prefixes = relic.affixes.filter((a) => AFFIXES[a.id]?.kind === "prefix").length;
  const suffixes = relic.affixes.filter((a) => AFFIXES[a.id]?.kind === "suffix").length;
  const maxP = relic.rarity === "rare" ? 3 : 1;
  const maxS = relic.rarity === "rare" ? 3 : 1;
  let want: AffixKind;
  if (kind === "any") {
    const canP = prefixes < maxP;
    const canS = suffixes < maxS;
    if (!canP && !canS) return false;
    if (canP && canS) want = rng() < 0.5 ? "prefix" : "suffix";
    else want = canP ? "prefix" : "suffix";
  } else {
    want = kind;
    if (want === "prefix" && prefixes >= maxP) return false;
    if (want === "suffix" && suffixes >= maxS) return false;
  }
  const id = pickId(want === "prefix" ? PREFIX_IDS : SUFFIX_IDS, used, rng);
  if (!id) return false;
  const def = AFFIXES[id];
  if (!def) return false;
  relic.affixes.push({ id, tier: pickTier(def, relic.itemLevel) });
  return true;
}

export function makeRelic(defId: RelicId, rarity: RelicRarity, itemLevel: number, rng: () => number = Math.random): RelicInstance {
  const relic: RelicInstance = {
    uid: newUid("rel"),
    defId,
    kind: "relic",
    rarity,
    itemLevel: Math.max(1, itemLevel),
    affixes: [],
    corrupted: false,
  };
  if (rarity === "normal") return relic;
  if (rarity === "magic") {
    addRandomAffix(relic, rng() < 0.5 ? "prefix" : "suffix", rng);
    if (rng() < 0.65) addRandomAffix(relic, "any", rng);
    return relic;
  }
  // Rare: at least 2 affixes, up to 6 (3P+3S).
  const want = 2 + Math.floor(rng() * 5);
  for (let i = 0; i < want; i++) addRandomAffix(relic, "any", rng);
  return relic;
}

export function rollRelic(itemLevel: number, rarity: RelicRarity, rng: () => number = Math.random): RelicInstance {
  const defId = RELIC_IDS[Math.floor(rng() * RELIC_IDS.length)] ?? "ember-core";
  return makeRelic(defId, rarity, itemLevel, rng);
}

export function relicMods(relic: RelicInstance): StatMods {
  const base = RELICS[relic.defId];
  const out = copyMods();
  if (base) stackMod(out, base.implicit);
  for (const rolled of relic.affixes) {
    const def = AFFIXES[rolled.id];
    const tier = def?.tiers[rolled.tier];
    if (tier) stackMod(out, tier);
  }
  return out;
}

export function stackRelics(relics: readonly (RelicInstance | null)[]): StatMods {
  const out = copyMods();
  for (const r of relics) {
    if (!r) continue;
    const m = relicMods(r);
    stackMod(out, {
      addDamage: m.addDamage,
      damageMult: m.damageMult,
      attackRateMult: m.attackRateMult,
      addRange: m.addRange,
      addProjectiles: m.addProjectiles,
      addPierce: m.addPierce,
      addChain: m.addChain,
      goldMult: m.goldMult,
      convertToCold: m.convertToCold,
    });
  }
  if (relics.length === 0) return IDENTITY_MODS;
  return out;
}

export function relicDisplayName(relic: RelicInstance): string {
  const base = RELICS[relic.defId]?.name ?? relic.defId;
  let prefix = "";
  let suffix = "";
  for (const a of relic.affixes) {
    const def = AFFIXES[a.id];
    if (!def) continue;
    if (def.kind === "prefix" && !prefix) prefix = def.name;
    if (def.kind === "suffix" && !suffix) suffix = def.name;
  }
  const rare = relic.rarity === "rare";
  if (rare) return `${base} (${relic.affixes.length} affixes)`;
  return `${prefix ? prefix + " " : ""}${base}${suffix ? " " + suffix : ""}`;
}

export function relicRarityLabel(r: RelicRarity): string {
  if (r === "magic") return "Magic";
  if (r === "rare") return "Rare";
  return "Normal";
}
