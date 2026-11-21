import { emptyCurrency, isCurrencyId, type CurrencyId } from "./currency";
import { makeGem, type GemInstance } from "./items";
import type { SpoilsItem } from "./drops";
import { isRelic, type RelicInstance } from "./relics";
import { RUNE_IDS } from "./runes";
import { SIGIL_IDS } from "./sigils";
import { TOWERS, TOWER_IDS, isTowerId, type TowerId } from "./towers";

export type { RelicInstance };

export const PROFILE_STORAGE_KEY = "tower-forge-profile";
export const PROFILE_VERSION = 2;

export type TowerLoadout = {
  runes: (GemInstance | null)[];
  relics: (RelicInstance | null)[];
};

export type PlayerProfile = {
  version: number;
  runeInventory: GemInstance[];
  sigilInventory: GemInstance[];
  relicInventory: RelicInstance[];
  currency: Record<CurrencyId, number>;
  loadouts: Record<TowerId, TowerLoadout>;
  accountXp: number;
  unspentPoints: number;
  allocatedNodes: string[];
  highestDepthCleared: number;
};

export function runeSlotCount(towerId: TowerId): number {
  return Math.max(0, TOWERS[towerId].sockets - 1);
}

export function relicSlotCount(_towerId: TowerId): number {
  return 2;
}

export function emptyLoadout(towerId: TowerId): TowerLoadout {
  return {
    runes: Array.from({ length: runeSlotCount(towerId) }, () => null),
    relics: Array.from({ length: relicSlotCount(towerId) }, () => null),
  };
}

export function createDefaultProfile(): PlayerProfile {
  const loadouts = {} as Record<TowerId, TowerLoadout>;
  for (const id of TOWER_IDS) loadouts[id] = emptyLoadout(id);
  return {
    version: PROFILE_VERSION,
    runeInventory: RUNE_IDS.map((id) => makeGem("rune", id)),
    sigilInventory: SIGIL_IDS.map((id) => makeGem("sigil", id)),
    relicInventory: [],
    currency: emptyCurrency(),
    loadouts,
    accountXp: 0,
    unspentPoints: 0,
    allocatedNodes: [],
    highestDepthCleared: 0,
  };
}

function isGem(value: unknown, kind: GemInstance["kind"]): value is GemInstance {
  if (value === null || typeof value !== "object") return false;
  const g = value as GemInstance;
  return (
    typeof g.uid === "string" &&
    typeof g.defId === "string" &&
    g.kind === kind &&
    typeof g.level === "number" &&
    typeof g.xp === "number"
  );
}

function normalizeLoadout(towerId: TowerId, raw: unknown): TowerLoadout {
  const fallback = emptyLoadout(towerId);
  if (raw === null || typeof raw !== "object") return fallback;
  const rec = raw as { runes?: unknown; relics?: unknown };
  const runes = Array.isArray(rec.runes) ? rec.runes : [];
  const relics = Array.isArray(rec.relics) ? rec.relics : [];
  const out = emptyLoadout(towerId);
  for (let i = 0; i < out.runes.length; i++) {
    const g = runes[i];
    out.runes[i] = isGem(g, "rune") ? g : null;
  }
  for (let i = 0; i < out.relics.length; i++) {
    const r = relics[i];
    out.relics[i] = isRelic(r) ? r : null;
  }
  return out;
}

export function sanitizeProfile(raw: unknown): PlayerProfile {
  const base = createDefaultProfile();
  if (raw === null || typeof raw !== "object") return base;
  const rec = raw as Partial<PlayerProfile>;
  const runes = Array.isArray(rec.runeInventory) ? rec.runeInventory.filter((g) => isGem(g, "rune")) : base.runeInventory;
  const sigils = Array.isArray(rec.sigilInventory) ? rec.sigilInventory.filter((g) => isGem(g, "sigil")) : base.sigilInventory;
  const relics = Array.isArray(rec.relicInventory) ? rec.relicInventory.filter((r) => isRelic(r)) : [];
  const currency = emptyCurrency();
  if (rec.currency && typeof rec.currency === "object") {
    for (const [k, v] of Object.entries(rec.currency)) {
      if (isCurrencyId(k) && typeof v === "number" && v > 0) currency[k] = Math.floor(v);
    }
  }
  const loadouts = {} as Record<TowerId, TowerLoadout>;
  const src = rec.loadouts && typeof rec.loadouts === "object" ? rec.loadouts : {};
  for (const id of TOWER_IDS) {
    const key = id as string;
    loadouts[id] = normalizeLoadout(id, (src as Record<string, unknown>)[key]);
  }
  const allocated = Array.isArray(rec.allocatedNodes) ? rec.allocatedNodes.filter((n) => typeof n === "string") : [];
  return {
    version: PROFILE_VERSION,
    runeInventory: runes,
    sigilInventory: sigils,
    relicInventory: relics,
    currency,
    loadouts,
    accountXp: typeof rec.accountXp === "number" ? Math.max(0, rec.accountXp) : 0,
    unspentPoints: typeof rec.unspentPoints === "number" ? Math.max(0, rec.unspentPoints) : 0,
    allocatedNodes: allocated,
    highestDepthCleared: typeof rec.highestDepthCleared === "number" ? Math.max(0, rec.highestDepthCleared) : 0,
  };
}

function usedRuneUids(profile: PlayerProfile): Set<string> {
  const used = new Set<string>();
  for (const id of TOWER_IDS) {
    const loadout = profile.loadouts[id];
    if (!loadout) continue;
    for (const rune of loadout.runes) if (rune) used.add(rune.uid);
  }
  return used;
}

/** Drop inventory copies of runes that are already socketed in a loadout. */
export function dedupeRuneInventory(profile: PlayerProfile): void {
  const used = usedRuneUids(profile);
  profile.runeInventory = profile.runeInventory.filter((g) => !used.has(g.uid));
}

let current: PlayerProfile | null = null;

export function getProfile(): PlayerProfile {
  if (!current) current = loadProfile();
  return current;
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const profile = sanitizeProfile(parsed);
    dedupeRuneInventory(profile);
    dedupeRelicInventory(profile);
    current = profile;
    return profile;
  } catch {
    current = createDefaultProfile();
    return current;
  }
}

export function persistProfile(): void {
  const profile = getProfile();
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // quota / private mode
  }
}

export function socketRune(towerId: TowerId, slot: number, uid: string): boolean {
  if (!isTowerId(towerId)) return false;
  const profile = getProfile();
  const loadout = profile.loadouts[towerId];
  if (!loadout || slot < 0 || slot >= loadout.runes.length) return false;

  let incoming: GemInstance | null = null;
  const invIndex = profile.runeInventory.findIndex((g) => g.uid === uid);
  if (invIndex >= 0) {
    incoming = profile.runeInventory.splice(invIndex, 1)[0] ?? null;
  } else {
    for (const id of TOWER_IDS) {
      const other = profile.loadouts[id];
      if (!other) continue;
      for (let i = 0; i < other.runes.length; i++) {
        const g = other.runes[i];
        if (g && g.uid === uid) {
          other.runes[i] = null;
          incoming = g;
          break;
        }
      }
      if (incoming) break;
    }
  }
  if (!incoming || incoming.kind !== "rune") {
    if (incoming) profile.runeInventory.push(incoming);
    return false;
  }
  const occupant = loadout.runes[slot];
  if (occupant) profile.runeInventory.push(occupant);
  loadout.runes[slot] = incoming;
  persistProfile();
  return true;
}

export function unsocketRune(towerId: TowerId, slot: number): boolean {
  if (!isTowerId(towerId)) return false;
  const profile = getProfile();
  const loadout = profile.loadouts[towerId];
  if (!loadout || slot < 0 || slot >= loadout.runes.length) return false;
  const gem = loadout.runes[slot];
  if (!gem) return false;
  loadout.runes[slot] = null;
  profile.runeInventory.push(gem);
  persistProfile();
  return true;
}

function usedRelicUids(profile: PlayerProfile): Set<string> {
  const used = new Set<string>();
  for (const id of TOWER_IDS) {
    const loadout = profile.loadouts[id];
    if (!loadout) continue;
    for (const relic of loadout.relics) if (relic) used.add(relic.uid);
  }
  return used;
}

export function dedupeRelicInventory(profile: PlayerProfile): void {
  const used = usedRelicUids(profile);
  profile.relicInventory = profile.relicInventory.filter((r) => !used.has(r.uid));
}

export function socketRelic(towerId: TowerId, slot: number, uid: string): boolean {
  if (!isTowerId(towerId)) return false;
  const profile = getProfile();
  const loadout = profile.loadouts[towerId];
  if (!loadout || slot < 0 || slot >= loadout.relics.length) return false;
  let incoming: RelicInstance | null = null;
  const invIndex = profile.relicInventory.findIndex((r) => r.uid === uid);
  if (invIndex >= 0) incoming = profile.relicInventory.splice(invIndex, 1)[0] ?? null;
  else {
    for (const id of TOWER_IDS) {
      const other = profile.loadouts[id];
      if (!other) continue;
      for (let i = 0; i < other.relics.length; i++) {
        const r = other.relics[i];
        if (r && r.uid === uid) {
          other.relics[i] = null;
          incoming = r;
          break;
        }
      }
      if (incoming) break;
    }
  }
  if (!incoming) return false;
  const occupant = loadout.relics[slot];
  if (occupant) profile.relicInventory.push(occupant);
  loadout.relics[slot] = incoming;
  persistProfile();
  return true;
}

export function unsocketRelic(towerId: TowerId, slot: number): boolean {
  if (!isTowerId(towerId)) return false;
  const profile = getProfile();
  const loadout = profile.loadouts[towerId];
  if (!loadout || slot < 0 || slot >= loadout.relics.length) return false;
  const relic = loadout.relics[slot];
  if (!relic) return false;
  loadout.relics[slot] = null;
  profile.relicInventory.push(relic);
  persistProfile();
  return true;
}

export function addCurrency(id: CurrencyId, qty: number): void {
  if (qty <= 0) return;
  const profile = getProfile();
  profile.currency[id] = (profile.currency[id] ?? 0) + qty;
  persistProfile();
}

export function collectSpoils(items: readonly SpoilsItem[]): void {
  const profile = getProfile();
  for (const item of items) {
    if (item.kind === "rune") profile.runeInventory.push(item.item);
    else if (item.kind === "sigil") profile.sigilInventory.push(item.item);
    else if (item.kind === "relic") profile.relicInventory.push(item.item);
    else if (item.kind === "currency") {
      profile.currency[item.id] = (profile.currency[item.id] ?? 0) + item.qty;
    }
  }
  persistProfile();
}
