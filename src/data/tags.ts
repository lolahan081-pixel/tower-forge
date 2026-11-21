/** Shared tags for frames, Sigils, and Runes. A Rune applies only if every one of its tags is on the Sigil. */
export type GemTag =
  | "projectile"
  | "spell"
  | "aura"
  | "fire"
  | "cold"
  | "lightning"
  | "blood"
  | "nova"
  | "chain"
  | "pierce";

export type FrameTag = "projectile" | "spell" | "aura";
