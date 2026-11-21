/** Serializable owned instance. Every gem, Relic, and currency stack will use this shape of uid. */
export type GemKind = "sigil" | "rune";

export type GemInstance = {
  uid: string;
  defId: string;
  kind: GemKind;
  level: number;
  xp: number;
};

let seq = 0;

export function newUid(prefix: string): string {
  seq += 1;
  const uniq = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}_${seq}_${uniq}`;
}

export function makeGem(kind: GemKind, defId: string, level = 1): GemInstance {
  const prefix = kind === "sigil" ? "sig" : "run";
  return { uid: newUid(prefix), defId, kind, level, xp: 0 };
}

export const GEM_MAX_LEVEL = 7;

export function xpToNext(level: number): number {
  return 16 * level;
}

/** @returns true if the gem gained a level. */
export function addGemXp(gem: GemInstance, amount: number): boolean {
  if (amount <= 0 || gem.level >= GEM_MAX_LEVEL) return false;
  gem.xp += amount;
  let leveled = false;
  while (gem.level < GEM_MAX_LEVEL && gem.xp >= xpToNext(gem.level)) {
    gem.xp -= xpToNext(gem.level);
    gem.level += 1;
    leveled = true;
  }
  return leveled;
}

export function sigilDamageScale(level: number): number {
  return 1 + 0.12 * Math.max(0, level - 1);
}
