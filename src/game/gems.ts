import { type GemInstance } from "../data/items";
import { isRuneId, RUNES } from "../data/runes";
import { isSigilId, SIGILS } from "../data/sigils";
import { Palette } from "../palette";
import { isRelic, relicDisplayName, RELICS, type RelicInstance } from "../data/relics";

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

export function itemName(item: GemInstance | RelicInstance): string {
  if (isRelic(item)) return relicDisplayName(item);
  return gemName(item);
}

export function itemColor(item: GemInstance | RelicInstance): number {
  if (isRelic(item)) return RELICS[item.defId]?.color ?? Palette.muted;
  return gemColor(item);
}
