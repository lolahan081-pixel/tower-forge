import { modChance } from "./depths";

export type EnemyRarity = "normal" | "magic" | "rare" | "unique";

export type EnemyModId =
  | "fleet-ash"
  | "cinder-hide"
  | "rime-hide"
  | "slag-plate"
  | "smoldering"
  | "cinder-split"
  | "ward-shell"
  | "haste-paean"
  | "close-ward";

export type EnemyModDef = {
  id: EnemyModId;
  name: string;
  /** Fast. Multiplies path speed. */
  speedMult?: number;
  /** 0–1 reduction vs fire (non-cold) damage. */
  fireResist?: number;
  /** 0–1 reduction vs cold damage. */
  coldResist?: number;
  /** Multiplier on damage after resists. */
  armourMult?: number;
  /** Fraction of max life restored per second. */
  regenPerSec?: number;
  splitOnDeath?: boolean;
  /** Extra shield as a fraction of max life. */
  shieldFrac?: number;
  hasteAura?: { radius: number; speedMult: number };
  proximalWard?: { radius: number; damageTakenMult: number };
};

export const ENEMY_MODS: Record<EnemyModId, EnemyModDef> = {
  "fleet-ash": { id: "fleet-ash", name: "Fleet Ash", speedMult: 1.35 },
  "cinder-hide": { id: "cinder-hide", name: "Cinder Hide", fireResist: 0.5 },
  "rime-hide": { id: "rime-hide", name: "Rime Hide", coldResist: 0.5 },
  "slag-plate": { id: "slag-plate", name: "Slag Plate", armourMult: 0.7 },
  "smoldering": { id: "smoldering", name: "Smoldering", regenPerSec: 0.04 },
  "cinder-split": { id: "cinder-split", name: "Cinder Split", splitOnDeath: true },
  "ward-shell": { id: "ward-shell", name: "Ward Shell", shieldFrac: 0.35 },
  "haste-paean": { id: "haste-paean", name: "Haste Paean", hasteAura: { radius: 150, speedMult: 1.25 } },
  "close-ward": { id: "close-ward", name: "Close Ward", proximalWard: { radius: 130, damageTakenMult: 0.75 } },
};

export const ENEMY_MOD_IDS = Object.keys(ENEMY_MODS) as EnemyModId[];

export type EnemyPack = { rarity: EnemyRarity; mods: EnemyModId[] };

const scratchIds: EnemyModId[] = ENEMY_MOD_IDS.slice();

function pickMods(count: number): EnemyModId[] {
  for (let i = scratchIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = scratchIds[i]!;
    scratchIds[i] = scratchIds[j]!;
    scratchIds[j] = a;
  }
  const n = Math.max(0, Math.min(count, scratchIds.length));
  return scratchIds.slice(0, n);
}

export function rollEnemyPack(depth: number, forced?: EnemyRarity): EnemyPack {
  let rarity: EnemyRarity = "normal";
  if (forced === "magic" || forced === "rare" || forced === "unique") rarity = forced;
  else if (forced !== "normal") {
    const ch = modChance(depth);
    const roll = Math.random();
    if (roll < ch.unique) rarity = "unique";
    else if (roll < ch.unique + ch.rare) rarity = "rare";
    else if (roll < ch.unique + ch.rare + ch.magic) rarity = "magic";
  }
  if (rarity === "normal" || rarity === "unique") return { rarity, mods: [] };
  const count = rarity === "rare" ? (Math.random() < 0.5 ? 3 : 4) : Math.random() < 0.5 ? 1 : 2;
  return { rarity, mods: pickMods(count) };
}

export function rarityGoldMult(rarity: EnemyRarity): number {
  if (rarity === "unique") return 3;
  if (rarity === "rare") return 2.25;
  if (rarity === "magic") return 1.5;
  return 1;
}

export function rarityHpMult(rarity: EnemyRarity): number {
  if (rarity === "unique") return 3.2;
  if (rarity === "rare") return 2.1;
  if (rarity === "magic") return 1.35;
  return 1;
}

export type ResolvedEnemyMods = {
  speedMult: number;
  fireResist: number;
  coldResist: number;
  armourMult: number;
  regenPerSec: number;
  splitOnDeath: boolean;
  shieldFrac: number;
  hasteRadius: number;
  hasteMult: number;
  wardRadius: number;
  wardMult: number;
};

export const IDENTITY_ENEMY_MODS: ResolvedEnemyMods = {
  speedMult: 1,
  fireResist: 0,
  coldResist: 0,
  armourMult: 1,
  regenPerSec: 0,
  splitOnDeath: false,
  shieldFrac: 0,
  hasteRadius: 0,
  hasteMult: 1,
  wardRadius: 0,
  wardMult: 1,
};

export function resolveEnemyMods(mods: readonly EnemyModId[]): ResolvedEnemyMods {
  const out: ResolvedEnemyMods = { ...IDENTITY_ENEMY_MODS };
  for (let i = 0; i < mods.length; i++) {
    const def = ENEMY_MODS[mods[i]!];
    if (!def) continue;
    if (def.speedMult) out.speedMult *= def.speedMult;
    if (def.fireResist) out.fireResist = Math.min(0.9, out.fireResist + def.fireResist);
    if (def.coldResist) out.coldResist = Math.min(0.9, out.coldResist + def.coldResist);
    if (def.armourMult) out.armourMult *= def.armourMult;
    if (def.regenPerSec) out.regenPerSec += def.regenPerSec;
    if (def.splitOnDeath) out.splitOnDeath = true;
    if (def.shieldFrac) out.shieldFrac += def.shieldFrac;
    if (def.hasteAura) {
      out.hasteRadius = Math.max(out.hasteRadius, def.hasteAura.radius);
      out.hasteMult *= def.hasteAura.speedMult;
    }
    if (def.proximalWard) {
      out.wardRadius = Math.max(out.wardRadius, def.proximalWard.radius);
      out.wardMult *= def.proximalWard.damageTakenMult;
    }
  }
  return out;
}
