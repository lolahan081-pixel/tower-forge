import { CURRENCY_IDS, type CurrencyId } from "./currency";
import { makeGem, type GemInstance } from "./items";
import { rollRelic, type RelicInstance, type RelicRarity } from "./relics";
import { RUNE_IDS } from "./runes";
import { SIGIL_IDS } from "./sigils";
import { isFeatureUnlocked } from "./unlocks";

export type EnemyRarity = "normal" | "magic" | "rare" | "unique";

export type DropKind = "relic" | "sigil" | "rune" | "currency";

export type AllowedDrops = { relic: boolean; sigil: boolean; rune: boolean; currency: boolean };

export const ALL_DROPS: AllowedDrops = { relic: true, sigil: true, rune: true, currency: true };

export function allowedDropsFor(highestDepthCleared: number): AllowedDrops {
  return {
    sigil: true,
    rune: isFeatureUnlocked("runes", highestDepthCleared),
    relic: isFeatureUnlocked("relics", highestDepthCleared),
    currency: isFeatureUnlocked("forge", highestDepthCleared),
  };
}

export type SpoilsItem =
  | { kind: "relic"; item: RelicInstance }
  | { kind: "sigil"; item: GemInstance }
  | { kind: "rune"; item: GemInstance }
  | { kind: "currency"; id: CurrencyId; qty: number };

type Weights = { nothing: number; relic: number; sigil: number; rune: number; currency: number };

const WEIGHTS: Record<EnemyRarity, Weights> = {
  normal: { nothing: 78, relic: 4, sigil: 5, rune: 6, currency: 7 },
  magic: { nothing: 50, relic: 12, sigil: 12, rune: 12, currency: 14 },
  rare: { nothing: 20, relic: 22, sigil: 18, rune: 18, currency: 22 },
  unique: { nothing: 0, relic: 28, sigil: 22, rune: 20, currency: 30 },
};

const RARITY_ROLL: Record<EnemyRarity, { magic: number; rare: number }> = {
  normal: { magic: 0.72, rare: 0.08 },
  magic: { magic: 0.6, rare: 0.22 },
  rare: { magic: 0.35, rare: 0.5 },
  unique: { magic: 0.15, rare: 0.75 },
};

function pickWeighted<K extends string>(weights: Record<K, number>, rng: () => number): K {
  let total = 0;
  for (const k in weights) total += weights[k];
  let roll = rng() * total;
  let last: K | null = null;
  for (const k in weights) {
    last = k;
    roll -= weights[k];
    if (roll <= 0) return k;
  }
  return last as K;
}

function rollRelicRarity(source: EnemyRarity, rng: () => number): RelicRarity {
  const table = RARITY_ROLL[source];
  const r = rng();
  if (r < table.rare) return "rare";
  if (r < table.rare + table.magic) return "magic";
  return "normal";
}

export function rollDrop(
  source: EnemyRarity,
  depth: number,
  rng: () => number = Math.random,
  allowed: AllowedDrops = ALL_DROPS,
): SpoilsItem | null {
  const base = WEIGHTS[source];
  const weights: Weights = {
    nothing: base.nothing,
    relic: allowed.relic ? base.relic : 0,
    sigil: allowed.sigil ? base.sigil : 0,
    rune: allowed.rune ? base.rune : 0,
    currency: allowed.currency ? base.currency : 0,
  };
  const kind = pickWeighted(weights, rng);
  if (kind === "nothing") return null;
  const ilvl = Math.max(1, depth * 2);
  if (kind === "relic") return { kind: "relic", item: rollRelic(ilvl, rollRelicRarity(source, rng), rng) };
  if (kind === "sigil") {
    const id = SIGIL_IDS[Math.floor(rng() * SIGIL_IDS.length)] ?? "cinder-orb";
    return { kind: "sigil", item: makeGem("sigil", id, 1) };
  }
  if (kind === "rune") {
    const id = RUNE_IDS[Math.floor(rng() * RUNE_IDS.length)] ?? "split-volley";
    return { kind: "rune", item: makeGem("rune", id, 1) };
  }
  const id = CURRENCY_IDS[Math.floor(rng() * CURRENCY_IDS.length)] ?? "kindle-shard";
  const qty = source === "unique" || source === "rare" ? 1 + Math.floor(rng() * 2) : 1;
  return { kind: "currency", id, qty };
}

/** Bosses and rares drop extra rolls. */
export function rollKillDrops(
  source: EnemyRarity,
  depth: number,
  rng: () => number = Math.random,
  allowed: AllowedDrops = ALL_DROPS,
): SpoilsItem[] {
  const extra = source === "unique" ? 3 : source === "rare" ? 2 : 1;
  const out: SpoilsItem[] = [];
  for (let i = 0; i < extra; i++) {
    const item = rollDrop(source, depth, rng, allowed);
    if (item) out.push(item);
  }
  return out;
}

export function spoilsLabel(item: SpoilsItem): string {
  if (item.kind === "currency") return `${item.qty}× currency`;
  if (item.kind === "relic") return item.item.defId;
  return item.item.defId;
}
