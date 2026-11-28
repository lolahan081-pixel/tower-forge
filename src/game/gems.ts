import { type GemInstance } from "../data/items";
import { isRuneId, RUNES } from "../data/runes";
import { isSigilId, SIGILS } from "../data/sigils";
import { Palette } from "../palette";
import { isRelic, relicDisplayName, RELICS, type RelicInstance } from "../data/relics";
import { CURRENCIES, isCurrencyId } from "../data/currency";
import type { SpoilsItem } from "../data/drops";

export function gemName(g: GemInstance): string {
  if (g.kind === "sigil" && isSigilId(g.defId)) return SIGILS[g.defId].name;
  if (g.kind === "rune" && isRuneId(g.defId)) return RUNES[g.defId].name;
  return g.defId;
}

export function gemColor(g: GemInstance): number {
  if (g.kind === "sigil" && isSigilId(g.defId)) return SIGILS[g.defId].accent;
  if (g.kind === "rune" && isRuneId(g.defId)) return RUNES[g.defId].color;
  return Palette.muted;
}

/** Sigil UI uses the glyph frame (def id), not the projectile texture. */
export function gemIcon(g: GemInstance): string {
  if (g.kind === "sigil" && isSigilId(g.defId)) return g.defId;
  if (g.kind === "rune" && isRuneId(g.defId)) return RUNES[g.defId].icon;
  return "gem-chip";
}

export function itemName(item: GemInstance | RelicInstance): string {
  if (isRelic(item)) return relicDisplayName(item);
  return gemName(item);
}

export function itemColor(item: GemInstance | RelicInstance): number {
  if (isRelic(item)) return RELICS[item.defId]?.color ?? Palette.muted;
  return gemColor(item);
}

export function itemIcon(item: GemInstance | RelicInstance): string {
  if (isRelic(item)) return RELICS[item.defId]?.texture ?? "relic-slot";
  return gemIcon(item);
}

export function spoilsIcon(item: SpoilsItem): string {
  if (item.kind === "currency") return isCurrencyId(item.id) ? CURRENCIES[item.id].icon : "gem-chip";
  if (item.kind === "relic") return itemIcon(item.item);
  return gemIcon(item.item);
}

export function rarityIcon(rarity: "normal" | "magic" | "rare"): string {
  return `rarity-${rarity}`;
}
