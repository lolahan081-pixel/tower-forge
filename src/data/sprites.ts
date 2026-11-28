/** Atlas texture key and shared animation ids. Frames are packed by scripts/build-atlas.mjs. */
export const ATLAS_KEY = "tf-atlas";

export type SpriteAnimDef = {
  key: string;
  prefix: string;
  frames: number;
  frameRate: number;
  repeat: number;
};

export const SPRITE_ANIMS: readonly SpriteAnimDef[] = [
  { key: "ember-spire-idle", prefix: "ember-spire-idle-", frames: 4, frameRate: 6, repeat: -1 },
  { key: "ember-spire-attack", prefix: "ember-spire-attack-", frames: 2, frameRate: 12, repeat: 0 },
  { key: "blood-font-idle", prefix: "blood-font-idle-", frames: 4, frameRate: 5, repeat: -1 },
  { key: "blood-font-attack", prefix: "blood-font-attack-", frames: 2, frameRate: 10, repeat: 0 },
  { key: "wretch-walk", prefix: "wretch-walk-", frames: 4, frameRate: 8, repeat: -1 },
  { key: "brute-walk", prefix: "brute-walk-", frames: 4, frameRate: 6, repeat: -1 },
  { key: "hollow-sovereign-walk", prefix: "hollow-sovereign-walk-", frames: 4, frameRate: 5, repeat: -1 },
  { key: "death-puff", prefix: "death-puff-", frames: 4, frameRate: 14, repeat: 0 },
  { key: "impact-fire", prefix: "impact-fire-", frames: 3, frameRate: 16, repeat: 0 },
  { key: "impact-cold", prefix: "impact-cold-", frames: 3, frameRate: 16, repeat: 0 },
  { key: "impact-lightning", prefix: "impact-lightning-", frames: 3, frameRate: 16, repeat: 0 },
  { key: "impact-blood", prefix: "impact-blood-", frames: 3, frameRate: 16, repeat: 0 },
];

export type ImpactElement = "fire" | "cold" | "lightning" | "blood";

export function impactAnimFor(texture: string, convertToCold = 0): string {
  if (convertToCold >= 0.5) return "impact-cold";
  if (texture.includes("frost") || texture.includes("cold") || texture.includes("hoarfrost")) return "impact-cold";
  if (texture.includes("spark") || texture.includes("lightning") || texture.includes("forked")) return "impact-lightning";
  if (texture.includes("blood") || texture.includes("crimson")) return "impact-blood";
  return "impact-fire";
}
