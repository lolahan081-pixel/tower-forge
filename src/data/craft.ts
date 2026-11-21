import type { CurrencyId } from "./currency";
import { addRandomAffix, type RelicInstance } from "./relics";
import { getProfile, persistProfile, type PlayerProfile } from "./profile";

export type CraftResult = { ok: boolean; message: string };

function fail(message: string): CraftResult {
  return { ok: false, message };
}

function ok(message: string): CraftResult {
  return { ok: true, message };
}

function findRelic(profile: PlayerProfile, uid: string): RelicInstance | null {
  const inv = profile.relicInventory.find((r) => r.uid === uid);
  if (inv) return inv;
  for (const id of Object.keys(profile.loadouts) as (keyof typeof profile.loadouts)[]) {
    const loadout = profile.loadouts[id];
    if (!loadout) continue;
    for (const r of loadout.relics) if (r && r.uid === uid) return r;
  }
  return null;
}

function corrupt(relic: RelicInstance, rng: () => number): CraftResult {
  const roll = rng();
  let message = "The Relic is blighted and locked.";
  if (roll < 0.25) {
    addRandomAffix(relic, "any", rng);
    addRandomAffix(relic, "any", rng);
    message = "Corruption blooms with new affixes. The Relic is locked.";
  } else if (roll < 0.45) {
    relic.affixes = [];
    message = "Corruption strips every affix. The Relic is locked.";
  } else if (roll < 0.7) {
    const n = Math.max(1, relic.affixes.length);
    relic.affixes = [];
    if (relic.rarity === "normal") relic.rarity = "magic";
    for (let i = 0; i < n; i++) addRandomAffix(relic, "any", rng);
    message = "Corruption remakes the affixes. The Relic is locked.";
  } else if (roll < 0.85) {
    relic.itemLevel += 4;
    message = "Corruption deepens the item level. The Relic is locked.";
  }
  relic.corrupted = true;
  return ok(message);
}

export function respecLattice(): CraftResult {
  const profile = getProfile();
  if (profile.allocatedNodes.length === 0) return fail("The Lattice has no points to unbind.");
  profile.unspentPoints += profile.allocatedNodes.length;
  profile.allocatedNodes = [];
  persistProfile();
  return ok("The Lattice is unbound. Points are returned.");
}

export function tryCraft(relicUid: string | null, currencyId: CurrencyId, rng: () => number = Math.random): CraftResult {
  const profile = getProfile();
  if ((profile.currency[currencyId] ?? 0) < 1) return fail("You do not have that currency.");
  if (currencyId === "unbinding-tear") {
    const result = respecLattice();
    if (result.ok) {
      profile.currency[currencyId] -= 1;
      persistProfile();
    }
    return result;
  }
  if (!relicUid) return fail("Select a Relic first.");
  const relic = findRelic(profile, relicUid);
  if (!relic) return fail("That Relic is not in your possession.");
  if (relic.corrupted) return fail("Corrupted Relics cannot be crafted.");

  let result: CraftResult;
  if (currencyId === "kindle-shard") {
    if (relic.rarity !== "normal") result = fail("Kindle Shard only works on Normal Relics.");
    else {
      relic.rarity = "magic";
      addRandomAffix(relic, rng() < 0.5 ? "prefix" : "suffix", rng);
      result = ok("The Relic kindles into Magic.");
    }
  } else if (currencyId === "ash-mote") {
    if (relic.rarity !== "magic") result = fail("Ash Mote only works on Magic Relics.");
    else if (!addRandomAffix(relic, "any", rng)) result = fail("No room for another affix.");
    else result = ok("An affix settles in the ash.");
  } else if (currencyId === "crown-cinder") {
    if (relic.rarity !== "normal" && relic.rarity !== "magic") result = fail("Crown Cinder only works on Normal or Magic Relics.");
    else {
      relic.rarity = "rare";
      addRandomAffix(relic, "any", rng);
      result = ok("The Relic is crowned Rare.");
    }
  } else if (currencyId === "sovereign-ember") {
    if (relic.rarity !== "rare") result = fail("Sovereign Ember only works on Rare Relics.");
    else if (!addRandomAffix(relic, "any", rng)) result = fail("The Relic can take no more affixes.");
    else result = ok("A new affix is wrought.");
  } else if (currencyId === "rift-salt") {
    if (relic.affixes.length === 0) result = fail("No affix to replace.");
    else {
      const i = Math.floor(rng() * relic.affixes.length);
      relic.affixes.splice(i, 1);
      addRandomAffix(relic, "any", rng);
      result = ok("Salt scours one affix and writes another.");
    }
  } else if (currencyId === "null-ash") {
    if (relic.affixes.length === 0) result = fail("No affix to remove.");
    else {
      relic.affixes.splice(Math.floor(rng() * relic.affixes.length), 1);
      result = ok("An affix is scoured away.");
    }
  } else if (currencyId === "blight-heart") {
    result = corrupt(relic, rng);
  } else {
    result = fail("Unknown currency.");
  }

  if (result.ok) {
    profile.currency[currencyId] -= 1;
    persistProfile();
  }
  return result;
}
