export type EnemyId = "wretch" | "brute" | "hollow-sovereign";

export type EnemyDef = {
  id: EnemyId;
  name: string;
  maxHp: number;
  /** Pixels per second along the path. */
  speed: number;
  goldReward: number;
  radius: number;
  color: number;
  accent: number;
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  wretch: {
    id: "wretch",
    name: "Wretch",
    maxHp: 24,
    speed: 72,
    goldReward: 7,
    radius: 10,
    color: 0x2a1618,
    accent: 0xa82820,
  },
  brute: {
    id: "brute",
    name: "Brute",
    maxHp: 80,
    speed: 42,
    goldReward: 15,
    radius: 16,
    color: 0x1c1a1e,
    accent: 0x6a2428,
  },
  "hollow-sovereign": {
    id: "hollow-sovereign",
    name: "Hollow Sovereign",
    maxHp: 520,
    speed: 32,
    goldReward: 80,
    radius: 22,
    color: 0x141018,
    accent: 0xe8c547,
  },
};

export function isEnemyId(value: string): value is EnemyId {
  return Object.prototype.hasOwnProperty.call(ENEMIES, value);
}
