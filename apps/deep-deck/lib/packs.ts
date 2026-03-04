import type { PackId } from "./types";

export interface PackDefinition {
  id: PackId;
  name: string;
  description: string;
  /** Stripe price ID — set via env var for each pack */
  stripePriceId: string | null;
  /** Price in cents (for display) */
  priceCents: number;
  features: string[];
}

export const PACKS: Record<PackId, PackDefinition> = {
  sampler: {
    id: "sampler",
    name: "Free Sampler",
    description: "5 conversation cards + 2 games per age band, plus 8 wild cards",
    stripePriceId: null, // free
    priceCents: 0,
    features: [
      "20 conversation cards across all 4 age bands",
      "8 gamification cards",
      "8 wild card modifiers",
      "All 3 depth levels",
    ],
  },
  full: {
    id: "full",
    name: "Full Deck",
    description: "All 128 cards across every age band, plus the complete set of 32 wild cards",
    stripePriceId:
      process.env.NEXT_PUBLIC_STRIPE_PRICE_FULL_DECK ||
      "price_1T77cvD50swbC2DgVxutmKNr",
    priceCents: 999,
    features: [
      "72 conversation cards across all 4 age bands",
      "24 gamification cards",
      "32 wild card modifiers",
      "All 3 depth levels",
      "Future card packs included",
    ],
  },
};

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Total cards available to a set of entitlements. */
export function getEntitledCardCounts(entitlements: PackId[]): {
  conversation: number;
  gamification: number;
  wild: number;
} {
  const hasFullDeck = entitlements.includes("full");
  return {
    conversation: hasFullDeck ? 72 : 20,
    gamification: hasFullDeck ? 24 : 8,
    wild: hasFullDeck ? 32 : 8,
  };
}
