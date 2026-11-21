export type CurrencyId =
  | "kindle-shard"
  | "ash-mote"
  | "crown-cinder"
  | "sovereign-ember"
  | "rift-salt"
  | "null-ash"
  | "blight-heart"
  | "unbinding-tear";

export type CurrencyDef = {
  id: CurrencyId;
  name: string;
  desc: string;
  color: number;
};

export const CURRENCIES: Record<CurrencyId, CurrencyDef> = {
  "kindle-shard": {
    id: "kindle-shard",
    name: "Kindle Shard",
    desc: "Normal Relic becomes Magic with one prefix or suffix.",
    color: 0x6a9bb8,
  },
  "ash-mote": {
    id: "ash-mote",
    name: "Ash Mote",
    desc: "Add one affix to a Magic Relic.",
    color: 0xc9a227,
  },
  "crown-cinder": {
    id: "crown-cinder",
    name: "Crown Cinder",
    desc: "Magic Relic becomes Rare and gains one affix.",
    color: 0xe8c547,
  },
  "sovereign-ember": {
    id: "sovereign-ember",
    name: "Sovereign Ember",
    desc: "Add one affix to a Rare Relic.",
    color: 0xe86a2a,
  },
  "rift-salt": {
    id: "rift-salt",
    name: "Rift Salt",
    desc: "Remove one random affix and add a new one.",
    color: 0x9fd0e8,
  },
  "null-ash": {
    id: "null-ash",
    name: "Null Ash",
    desc: "Remove one random affix.",
    color: 0x8a8490,
  },
  "blight-heart": {
    id: "blight-heart",
    name: "Blight Heart",
    desc: "Corrupt a Relic: a random outcome, then it is locked.",
    color: 0x8b1a1a,
  },
  "unbinding-tear": {
    id: "unbinding-tear",
    name: "Unbinding Tear",
    desc: "Refund all Ember Lattice points.",
    color: 0xe8e0d4,
  },
};

export const CURRENCY_IDS: CurrencyId[] = [
  "kindle-shard",
  "ash-mote",
  "crown-cinder",
  "sovereign-ember",
  "rift-salt",
  "null-ash",
  "blight-heart",
  "unbinding-tear",
];

export function isCurrencyId(value: string): value is CurrencyId {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function emptyCurrency(): Record<CurrencyId, number> {
  const out = {} as Record<CurrencyId, number>;
  for (const id of CURRENCY_IDS) out[id] = 0;
  return out;
}
