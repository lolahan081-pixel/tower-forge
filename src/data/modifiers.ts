/** Shared numeric stack used by Relics, the Ember Lattice, and resolveLoadout. */
export type StatMods = {
  addDamage: number;
  damageMult: number;
  attackRateMult: number;
  addRange: number;
  addProjectiles: number;
  addPierce: number;
  addChain: number;
  goldMult: number;
  convertToCold: number;
};

export const IDENTITY_MODS: StatMods = {
  addDamage: 0,
  damageMult: 1,
  attackRateMult: 1,
  addRange: 0,
  addProjectiles: 0,
  addPierce: 0,
  addChain: 0,
  goldMult: 1,
  convertToCold: 0,
};

export function copyMods(src: StatMods = IDENTITY_MODS): StatMods {
  return { ...src };
}

export function stackMod(into: StatMods, add: Partial<StatMods>): void {
  if (add.addDamage) into.addDamage += add.addDamage;
  if (add.damageMult !== undefined) into.damageMult *= add.damageMult;
  if (add.attackRateMult !== undefined) into.attackRateMult *= add.attackRateMult;
  if (add.addRange) into.addRange += add.addRange;
  if (add.addProjectiles) into.addProjectiles += add.addProjectiles;
  if (add.addPierce) into.addPierce += add.addPierce;
  if (add.addChain) into.addChain += add.addChain;
  if (add.goldMult !== undefined) into.goldMult *= add.goldMult;
  if (add.convertToCold) into.convertToCold = Math.min(1, into.convertToCold + add.convertToCold);
}
