import { makeGem, type GemInstance } from "./items";
import { RUNE_IDS } from "./runes";
import { SIGIL_IDS } from "./sigils";
import { TOWERS, TOWER_IDS, isTowerId, type TowerId } from "./towers";

export const PROFILE_STORAGE_KEY = "tower-forge-profile";
export const PROFILE_VERSION = 1;

/** Relic items are not implemented yet. Slots exist so the hub can show placeholders. */
export type RelicInstance = {
  uid: string;
  defId: string;
  kind: "relic";
};

export type TowerLoadout = {
  runes: (GemInstance | null)[];
  relics: (RelicInstance | null)[];
};

export type PlayerProfile = {
  version: number;
  runeInventory: GemInstance[];
  sigilInventory: GemInstance[];
  loadouts: Record<TowerId, TowerLoadout>;
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
    loadouts,
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
    out.relics[i] = r && typeof r === "object" && (r as RelicInstance).kind === "relic" ? (r as RelicInstance) : null;
  }
  return out;
}

export function sanitizeProfile(raw: unknown): PlayerProfile {
  const base = createDefaultProfile();
  if (raw === null || typeof raw !== "object") return base;
  const rec = raw as Partial<PlayerProfile>;
  const runes = Array.isArray(rec.runeInventory) ? rec.runeInventory.filter((g) => isGem(g, "rune")) : base.runeInventory;
  const sigils = Array.isArray(rec.sigilInventory) ? rec.sigilInventory.filter((g) => isGem(g, "sigil")) : base.sigilInventory;
  const loadouts = {} as Record<TowerId, TowerLoadout>;
  const src = rec.loadouts && typeof rec.loadouts === "object" ? rec.loadouts : {};
  for (const id of TOWER_IDS) {
    const key = id as string;
    loadouts[id] = normalizeLoadout(id, (src as Record<string, unknown>)[key]);
  }
  return { version: PROFILE_VERSION, runeInventory: runes, sigilInventory: sigils, loadouts };
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
