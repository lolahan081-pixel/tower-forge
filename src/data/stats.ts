import { isRuneId, RUNES } from "./runes";
import { isSigilId, SIGILS, type SigilBehaviour, type SigilId } from "./sigils";
import { addGemXp, sigilDamageScale, type GemInstance } from "./items";
import type { TowerDef } from "./towers";
import { type StatMods } from "./modifiers";
import { stackRelics, type RelicInstance } from "./relics";

export type StatBlock = {
  damage: number;
  /** Attacks per second. */
  attackRate: number;
  /** Targeting radius in pixels. */
  range: number;
};

export type ResolvedAttack = StatBlock & {
  behaviour: SigilBehaviour | "none";
  sigilId: SigilId | null;
  projectileCount: number;
  projectileSpeed: number;
  chainCount: number;
  pierceCount: number;
  novaRadius: number;
  /** 0–1 fraction of damage treated as cold (tint / later resists). */
  convertToCold: number;
  goldMult: number;
  texture: string;
};

export const INERT_ATTACK: ResolvedAttack = {
  damage: 0,
  attackRate: 0,
  range: 0,
  behaviour: "none",
  sigilId: null,
  projectileCount: 0,
  projectileSpeed: 0,
  chainCount: 0,
  pierceCount: 0,
  novaRadius: 0,
  convertToCold: 0,
  goldMult: 1,
  texture: "cinder-orb",
};

/** A Rune applies only when every one of its tags is present on the Sigil. */
export function runeMatchesSigil(sigilTags: readonly string[], runeTags: readonly string[]): boolean {
  for (let i = 0; i < runeTags.length; i++) {
    const tag = runeTags[i];
    if (tag === undefined) continue;
    if (!sigilTags.includes(tag)) return false;
  }
  return true;
}

export function sigilFitsFrame(sigilTags: readonly string[], frameTags: readonly string[]): boolean {
  for (let i = 0; i < frameTags.length; i++) {
    const tag = frameTags[i];
    if (tag !== undefined && sigilTags.includes(tag)) return true;
  }
  return false;
}

/**
 * Resolve what a frame actually fires.
 * Later Relics and Ember Lattice nodes also fold into this function.
 */
export function resolveAttack(frame: TowerDef, sockets: readonly (GemInstance | null)[]): ResolvedAttack {
  let sigil: GemInstance | null = null;
  for (let i = 0; i < sockets.length; i++) {
    const g = sockets[i];
    if (g && g.kind === "sigil") {
      sigil = g;
      break;
    }
  }
  if (!sigil || !isSigilId(sigil.defId)) return { ...INERT_ATTACK, range: frame.stats.range };

  const sdef = SIGILS[sigil.defId];
  if (!sigilFitsFrame(sdef.tags, frame.tags)) return { ...INERT_ATTACK, range: frame.stats.range };

  const scale = sigilDamageScale(sigil.level);
  let damage = (frame.stats.damage + sdef.baseDamage) * scale;
  let attackRate = frame.stats.attackRate;
  const range = frame.stats.range;
  let projectileCount = 1;
  let chainCount = sdef.chainCount;
  let pierceCount = sdef.pierceCount;
  let convertToCold = 0;
  const projectileSpeed = sdef.projectileSpeed;
  const novaRadius = sdef.novaRadius;

  for (let i = 0; i < sockets.length; i++) {
    const g = sockets[i];
    if (!g || g.kind !== "rune" || !isRuneId(g.defId)) continue;
    const rdef = RUNES[g.defId];
    if (!runeMatchesSigil(sdef.tags, rdef.tags)) continue;
    const m = rdef.modifiers;
    projectileCount += m.addProjectiles;
    damage *= m.damageMult;
    chainCount += m.addChain;
    pierceCount += m.addPierce;
    attackRate *= m.attackRateMult;
    convertToCold = Math.min(1, convertToCold + m.convertToCold);
  }

  return {
    damage,
    attackRate,
    range,
    behaviour: sdef.behaviour,
    sigilId: sdef.id,
    projectileCount: Math.max(1, projectileCount),
    projectileSpeed,
    chainCount: Math.max(0, chainCount),
    pierceCount: Math.max(0, pierceCount),
    novaRadius,
    convertToCold,
    goldMult: 1,
    texture: convertToCold >= 0.25 ? "frost-bolt" : sdef.texture,
  };
}

export function grantSocketXp(sockets: readonly (GemInstance | null)[], amount: number): boolean {
  let changed = false;
  for (let i = 0; i < sockets.length; i++) {
    const g = sockets[i];
    if (!g) continue;
    if (addGemXp(g, amount)) changed = true;
    else if (amount > 0) changed = true;
  }
  return changed;
}

export function applyStatMods(resolved: ResolvedAttack, mods: StatMods): ResolvedAttack {
  return {
    ...resolved,
    damage: (resolved.damage + mods.addDamage) * mods.damageMult,
    attackRate: resolved.attackRate * mods.attackRateMult,
    range: resolved.range + mods.addRange,
    projectileCount: Math.max(1, resolved.projectileCount + mods.addProjectiles),
    pierceCount: Math.max(0, resolved.pierceCount + mods.addPierce),
    chainCount: Math.max(0, resolved.chainCount + mods.addChain),
    convertToCold: Math.min(1, resolved.convertToCold + mods.convertToCold),
    goldMult: resolved.goldMult * mods.goldMult,
    texture: resolved.convertToCold + mods.convertToCold >= 0.25 ? "frost-bolt" : resolved.texture,
  };
}

export function resolveLoadout(
  frame: TowerDef,
  sigil: GemInstance | null,
  runes: readonly (GemInstance | null)[],
  relics: readonly (RelicInstance | null)[] = [],
  extra?: StatMods,
): ResolvedAttack {
  const sockets: (GemInstance | null)[] = [sigil, ...runes];
  let resolved = resolveAttack(frame, sockets);
  if (relics.length > 0) resolved = applyStatMods(resolved, stackRelics(relics));
  if (extra) resolved = applyStatMods(resolved, extra);
  return resolved;
}
