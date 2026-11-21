import { copyMods, stackMod, type StatMods } from "./modifiers";
import { getProfile, persistProfile } from "./profile";

export type LatticeRegion = "hearth" | "spire" | "font" | "totem" | "economy";
export type LatticeKind = "small" | "notable" | "keystone";

export type LatticeNodeDef = {
  id: string;
  name: string;
  kind: LatticeKind;
  region: LatticeRegion;
  x: number;
  y: number;
  /** Combat mods apply only when every tag is on the Sigil. Empty = always. */
  tags: readonly string[];
  mods: Partial<StatMods>;
  blurb: string;
};

export const LATTICE_START = "hearth-ember";

const n = (
  id: string,
  name: string,
  kind: LatticeKind,
  region: LatticeRegion,
  x: number,
  y: number,
  tags: readonly string[],
  mods: Partial<StatMods>,
  blurb: string,
): LatticeNodeDef => ({ id, name, kind, region, x, y, tags, mods, blurb });

export const LATTICE_NODES: Record<string, LatticeNodeDef> = {
  "hearth-ember": n("hearth-ember", "Hearth Ember", "small", "hearth", 0, 0, [], { addDamage: 2 }, "The first coal in the Lattice."),

  "cinder-tithe": n("cinder-tithe", "Cinder Tithe", "small", "economy", -140, 140, [], { goldMult: 1.04 }, "A thin tax on every kill."),
  "ash-purse": n("ash-purse", "Ash Purse", "small", "economy", 140, 140, [], { goldMult: 1.04 }, "Spoils settle a little heavier."),
  "spark-wage": n("spark-wage", "Spark Wage", "small", "economy", 0, 140, [], { goldMult: 1.04 }, "The Breach pays in sparks."),
  "ember-due": n("ember-due", "Ember Due", "small", "economy", -140, 280, [], { goldMult: 1.06 }, "A richer share of the pyre."),
  "soot-account": n("soot-account", "Soot Account", "small", "economy", 140, 280, [], { addDamage: 4 }, "Booked heat, spent as force."),
  "ledger-of-ash": n("ledger-of-ash", "Ledger of Ash", "notable", "economy", 0, 280, [], { goldMult: 1.12 }, "The tally of every fallen wretch."),
  "slag-ledger": n("slag-ledger", "Slag Ledger", "small", "economy", -140, 420, [], { goldMult: 1.05 }, "Even slag has a price."),
  "crown-of-cinders": n(
    "crown-of-cinders",
    "Crown of Cinders",
    "keystone",
    "economy",
    0,
    420,
    [],
    { goldMult: 1.25, damageMult: 0.9 },
    "Richer spoils, but the flame burns thinner.",
  ),

  "searing-shaft": n("searing-shaft", "Searing Shaft", "small", "spire", -180, -80, ["projectile"], { damageMult: 1.06 }, "Hotter coals along the line."),
  "flinted-point": n("flinted-point", "Flinted Point", "small", "spire", -320, -180, ["projectile"], { addDamage: 4 }, "A harder tip on every shot."),
  "ember-flight": n("ember-flight", "Ember Flight", "small", "spire", -320, 20, ["projectile"], { attackRateMult: 1.06 }, "The Spire looses a little faster."),
  "long-spire": n("long-spire", "Long Spire", "small", "spire", -460, -180, ["projectile"], { addRange: 10 }, "The shaft reaches farther."),
  "cinder-tip": n("cinder-tip", "Cinder Tip", "small", "spire", -460, 20, ["projectile"], { damageMult: 1.06 }, "A brighter point of fire."),
  "ashen-line": n("ashen-line", "Ashen Line", "small", "spire", -600, -180, ["projectile"], { addDamage: 4 }, "The line holds more heat."),
  "spire-tip": n("spire-tip", "Spire Tip", "notable", "spire", -600, -320, ["projectile"], { addPierce: 1, damageMult: 1.12 }, "A point that does not stop."),
  "piercing-spark": n("piercing-spark", "Piercing Spark", "small", "spire", -600, 20, ["projectile"], { damageMult: 1.08 }, "Sparks that bite deeper."),
  "swift-shaft": n("swift-shaft", "Swift Shaft", "small", "spire", -740, -180, ["projectile"], { attackRateMult: 1.08 }, "The volley comes quick."),
  "high-spire": n("high-spire", "High Spire", "small", "spire", -740, 20, ["projectile"], { addRange: 12 }, "A taller throat for the Spire."),
  "ashen-volley": n(
    "ashen-volley",
    "Ashen Volley",
    "keystone",
    "spire",
    -880,
    -180,
    ["projectile"],
    { addProjectiles: 2, damageMult: 0.7 },
    "A storm of lesser coals.",
  ),

  "font-spark": n("font-spark", "Font Spark", "small", "font", 180, -80, ["spell"], { damageMult: 1.06 }, "The Font coughs a hotter spark."),
  "blood-warmth": n("blood-warmth", "Blood Warmth", "small", "font", 320, -180, ["spell"], { addDamage: 4 }, "Warmth drawn from the well."),
  "font-pulse": n("font-pulse", "Font Pulse", "small", "font", 320, 20, ["spell"], { attackRateMult: 1.06 }, "The well beats a little faster."),
  "deep-font": n("deep-font", "Deep Font", "small", "font", 460, -180, ["spell"], { addRange: 10 }, "The Font reaches farther."),
  "sanguine-tease": n("sanguine-tease", "Sanguine Tease", "small", "font", 460, 20, ["spell"], { damageMult: 1.06 }, "A redder lick of the Font."),
  "rune-well": n("rune-well", "Rune Well", "small", "font", 600, -180, ["spell"], { addDamage: 4 }, "The well remembers runes."),
  "font-mouth": n("font-mouth", "Font Mouth", "notable", "font", 600, -320, ["spell"], { addChain: 1, damageMult: 1.12 }, "The mouth splits the spell."),
  "crimson-eddy": n("crimson-eddy", "Crimson Eddy", "small", "font", 600, 20, ["spell"], { damageMult: 1.08 }, "A turning of the blood."),
  "wellspring": n("wellspring", "Wellspring", "small", "font", 740, -180, ["spell"], { attackRateMult: 1.08 }, "The Font does not pause."),
  "font-cadence": n("font-cadence", "Font Cadence", "small", "font", 740, 20, ["spell"], { addRange: 12 }, "A longer measure of the well."),
  "sanguine-font": n(
    "sanguine-font",
    "Sanguine Font",
    "keystone",
    "font",
    880,
    -180,
    ["spell"],
    { damageMult: 1.4, attackRateMult: 0.8 },
    "The well runs deep and slow.",
  ),

  "totem-root": n("totem-root", "Totem Root", "small", "totem", -280, 140, ["aura"], { addRange: 8 }, "Roots that widen the circle."),
  "ward-post": n("ward-post", "Ward Post", "small", "totem", -280, 280, ["aura"], { damageMult: 1.06 }, "A post that holds heat."),
  "circle-ember": n("circle-ember", "Circle Ember", "small", "totem", -420, 140, ["aura"], { attackRateMult: 1.06 }, "The circle turns quicker."),
  "ashen-ward": n("ashen-ward", "Ashen Ward", "small", "totem", -420, 280, ["aura"], { addRange: 10 }, "Ash drawn into a ward."),
  "ward-circle": n("ward-circle", "Ward Circle", "notable", "totem", -420, 420, ["aura"], { addRange: 20 }, "A wide pale ring."),
  "pale-stake": n("pale-stake", "Pale Stake", "small", "totem", -280, 420, ["aura"], { damageMult: 1.06 }, "A stake of quiet fire."),
  "quiet-halo": n("quiet-halo", "Quiet Halo", "small", "totem", -560, 280, ["aura"], { attackRateMult: 1.05 }, "A hush around the totem."),
  "stake-reach": n("stake-reach", "Stake Reach", "small", "totem", -560, 420, ["aura"], { addRange: 12 }, "The stake claims more ground."),
  "ember-stake": n("ember-stake", "Ember Stake", "small", "totem", -420, 560, ["aura"], { addRange: 8 }, "A last ember in the ring."),
};

export const LATTICE_EDGES: readonly [string, string][] = [
  ["hearth-ember", "cinder-tithe"],
  ["hearth-ember", "ash-purse"],
  ["hearth-ember", "spark-wage"],
  ["hearth-ember", "searing-shaft"],
  ["hearth-ember", "font-spark"],
  ["hearth-ember", "totem-root"],
  ["cinder-tithe", "ember-due"],
  ["cinder-tithe", "spark-wage"],
  ["ash-purse", "soot-account"],
  ["ash-purse", "spark-wage"],
  ["spark-wage", "ledger-of-ash"],
  ["ember-due", "ledger-of-ash"],
  ["ember-due", "slag-ledger"],
  ["soot-account", "ledger-of-ash"],
  ["ledger-of-ash", "crown-of-cinders"],
  ["ledger-of-ash", "slag-ledger"],
  ["slag-ledger", "crown-of-cinders"],
  ["searing-shaft", "flinted-point"],
  ["searing-shaft", "ember-flight"],
  ["flinted-point", "long-spire"],
  ["ember-flight", "cinder-tip"],
  ["long-spire", "ashen-line"],
  ["long-spire", "cinder-tip"],
  ["cinder-tip", "piercing-spark"],
  ["ashen-line", "spire-tip"],
  ["ashen-line", "piercing-spark"],
  ["ashen-line", "swift-shaft"],
  ["spire-tip", "swift-shaft"],
  ["piercing-spark", "high-spire"],
  ["swift-shaft", "ashen-volley"],
  ["swift-shaft", "high-spire"],
  ["high-spire", "ashen-volley"],
  ["font-spark", "blood-warmth"],
  ["font-spark", "font-pulse"],
  ["blood-warmth", "deep-font"],
  ["font-pulse", "sanguine-tease"],
  ["deep-font", "rune-well"],
  ["deep-font", "sanguine-tease"],
  ["sanguine-tease", "crimson-eddy"],
  ["rune-well", "font-mouth"],
  ["rune-well", "crimson-eddy"],
  ["rune-well", "wellspring"],
  ["font-mouth", "wellspring"],
  ["crimson-eddy", "font-cadence"],
  ["wellspring", "sanguine-font"],
  ["wellspring", "font-cadence"],
  ["font-cadence", "sanguine-font"],
  ["totem-root", "ward-post"],
  ["totem-root", "circle-ember"],
  ["ward-post", "ashen-ward"],
  ["ward-post", "pale-stake"],
  ["circle-ember", "ashen-ward"],
  ["circle-ember", "quiet-halo"],
  ["ashen-ward", "ward-circle"],
  ["ashen-ward", "quiet-halo"],
  ["ward-circle", "stake-reach"],
  ["ward-circle", "ember-stake"],
  ["ward-circle", "pale-stake"],
  ["pale-stake", "ember-stake"],
  ["quiet-halo", "stake-reach"],
  ["stake-reach", "ember-stake"],
];

const ADJACENT: Record<string, string[]> = {};
for (const id of Object.keys(LATTICE_NODES)) ADJACENT[id] = [];
for (const [a, b] of LATTICE_EDGES) {
  ADJACENT[a]?.push(b);
  ADJACENT[b]?.push(a);
}

export function latticeAdjacent(id: string): readonly string[] {
  return ADJACENT[id] ?? [];
}

export function canAllocate(id: string, allocated: readonly string[], unspent: number): boolean {
  if (unspent <= 0 || allocated.includes(id) || !LATTICE_NODES[id]) return false;
  if (id === LATTICE_START) return true;
  const neighbors = ADJACENT[id] ?? [];
  for (let i = 0; i < neighbors.length; i++) {
    const nId = neighbors[i];
    if (nId && allocated.includes(nId)) return true;
  }
  return false;
}

export function tryAllocate(id: string): { ok: true } | { ok: false; reason: string } {
  const profile = getProfile();
  if (profile.allocatedNodes.includes(id)) return { ok: false, reason: "Already bound." };
  if (profile.unspentPoints <= 0) return { ok: false, reason: "No unspent points." };
  if (!canAllocate(id, profile.allocatedNodes, profile.unspentPoints)) {
    return { ok: false, reason: "Bind an adjacent ember first." };
  }
  profile.allocatedNodes.push(id);
  profile.unspentPoints -= 1;
  persistProfile();
  return { ok: true };
}

export function latticeForTags(tags: readonly string[] = []): StatMods {
  return stackLattice(getProfile().allocatedNodes, tags);
}

export function stackLattice(allocated: readonly string[], tags: readonly string[] = []): StatMods {
  const into = copyMods();
  for (let i = 0; i < allocated.length; i++) {
    const node = LATTICE_NODES[allocated[i] ?? ""];
    if (!node) continue;
    if (node.tags.length > 0) {
      let ok = true;
      for (let t = 0; t < node.tags.length; t++) {
        const tag = node.tags[t];
        if (tag && !tags.includes(tag)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    stackMod(into, node.mods);
  }
  return into;
}

export function describeMods(mods: Partial<StatMods>): string {
  const parts: string[] = [];
  if (mods.addDamage) parts.push(`+${mods.addDamage} damage`);
  if (mods.damageMult !== undefined && mods.damageMult !== 1) parts.push(`×${mods.damageMult} damage`);
  if (mods.attackRateMult !== undefined && mods.attackRateMult !== 1) parts.push(`×${mods.attackRateMult} rate`);
  if (mods.addRange) parts.push(`+${mods.addRange} range`);
  if (mods.addProjectiles) parts.push(`+${mods.addProjectiles} projectiles`);
  if (mods.addPierce) parts.push(`+${mods.addPierce} pierce`);
  if (mods.addChain) parts.push(`+${mods.addChain} chain`);
  if (mods.goldMult !== undefined && mods.goldMult !== 1) parts.push(`×${mods.goldMult} gold`);
  return parts.join("  ·  ");
}

export const LATTICE_IDS = Object.keys(LATTICE_NODES);
