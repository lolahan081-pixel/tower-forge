/** Combat stats a tower uses after any future modifiers (gems, supports, affixes). */
export type StatBlock = {
  damage: number;
  /** Attacks per second. */
  attackRate: number;
  /** Targeting radius in pixels. */
  range: number;
};

/**
 * Resolve the stats a tower actually fights with.
 * Later this is the single place gems, supports, and affixes will modify numbers.
 * For the core loop it is a straight copy of the base block.
 */
export function resolveStats(base: StatBlock): StatBlock {
  return { damage: base.damage, attackRate: base.attackRate, range: base.range };
}
