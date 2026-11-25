import { makeGem, type GemInstance } from "./items";
import { RUNE_IDS } from "./runes";
import { SIGIL_IDS } from "./sigils";

export type ShopOffer = {
  uid: string;
  gem: GemInstance;
  price: number;
  sold: boolean;
};

export const SHOP_RUNE_PRICE = 22;
export const SHOP_SIGIL_PRICE = 40;

export function rollShopOffers(rng: () => number = Math.random, opts?: { runes?: boolean }): ShopOffer[] {
  const offers: ShopOffer[] = [];
  const runes = RUNE_IDS.slice();
  const sigils = SIGIL_IDS.slice();
  shuffle(runes, rng);
  shuffle(sigils, rng);
  if (opts?.runes !== false) {
    for (let i = 0; i < 2; i++) {
      const id = runes[i] ?? "split-volley";
      const gem = makeGem("rune", id, 1);
      offers.push({ uid: gem.uid, gem, price: SHOP_RUNE_PRICE, sold: false });
    }
  }
  const sigilCount = opts?.runes === false ? 4 : 2;
  for (let i = 0; i < sigilCount; i++) {
    const id = sigils[i] ?? "cinder-orb";
    const gem = makeGem("sigil", id, 1);
    offers.push({ uid: gem.uid, gem, price: SHOP_SIGIL_PRICE, sold: false });
  }
  return offers;
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = a;
  }
}
