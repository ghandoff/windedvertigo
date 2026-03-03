import type { AgeBand, Card, ConversationCard, GamificationCard, PackId } from "./types";
import {
  allConversationCards,
  allGamificationCards,
} from "@/data/cards";
import { wildCards } from "@/data/wild-cards";

/** Fisher-Yates shuffle — returns a new shuffled array. */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffle a deck of cards so that no two wild cards appear consecutively.
 *
 * Strategy: separate wilds from non-wilds, shuffle each group, then
 * interleave wilds into evenly-spaced gaps among the non-wild cards.
 * This guarantees no consecutive wilds as long as wilds ≤ non-wilds + 1.
 */
export function shuffleWithSpacing(cards: Card[]): Card[] {
  const wilds = shuffle(cards.filter((c) => c.type === "wild"));
  const others = shuffle(cards.filter((c) => c.type !== "wild"));

  // If there are more wilds than can be spaced, fall back to best-effort
  if (wilds.length === 0) return others;
  if (others.length === 0) return wilds;

  // Distribute wilds into the gaps between non-wild cards.
  // With N non-wild cards there are N+1 gaps (before, between, after).
  // Space wild insertions as evenly as possible.
  const result: Card[] = [];
  const gaps = others.length + 1;
  let wildIdx = 0;

  for (let g = 0; g < gaps; g++) {
    // How many wilds go in this gap? Distribute evenly using integer math.
    const remaining = wilds.length - wildIdx;
    const remainingGaps = gaps - g;
    const count = Math.ceil(remaining / remainingGaps);

    for (let w = 0; w < count && wildIdx < wilds.length; w++) {
      result.push(wilds[wildIdx++]);
    }

    // Add the non-wild card after this gap (except after the last gap)
    if (g < others.length) {
      result.push(others[g]);
    }
  }

  return result;
}

/** Max wild cards per deck — keeps modifiers rare enough to space apart. */
const WILDS_PER_DECK = 8;

/** Check if a card is accessible with the given entitlements. */
function isEntitled(card: Card, entitlements: PackId[]): boolean {
  return entitlements.includes(card.pack);
}

/** Build a shuffled deck for a given age band, filtered by entitlements. */
export function buildDeck(ageBand: AgeBand, entitlements: PackId[] = ["sampler"]): Card[] {
  const conversation: ConversationCard[] = allConversationCards.filter(
    (c) => c.ageBand === ageBand && isEntitled(c, entitlements),
  );
  const gamification: GamificationCard[] = allGamificationCards.filter(
    (c) => c.ageBand === ageBand && isEntitled(c, entitlements),
  );

  // Filter wilds by entitlement, then randomly select a subset
  const entitledWilds = (wildCards as Card[]).filter((c) => isEntitled(c, entitlements));
  const selectedWilds = shuffle(entitledWilds).slice(0, WILDS_PER_DECK);

  const deck: Card[] = [...conversation, ...gamification, ...selectedWilds];

  return shuffleWithSpacing(deck);
}

/** Get the count of cards for a given age band (including wilds). */
export function getDeckSize(ageBand: AgeBand, entitlements?: PackId[]): number {
  const filter = entitlements
    ? (c: Card) => isEntitled(c, entitlements)
    : () => true;

  const conversation = allConversationCards.filter(
    (c) => c.ageBand === ageBand && filter(c),
  ).length;
  const gamification = allGamificationCards.filter(
    (c) => c.ageBand === ageBand && filter(c),
  ).length;

  if (entitlements) {
    const entitledWilds = (wildCards as Card[]).filter(filter);
    return conversation + gamification + Math.min(entitledWilds.length, WILDS_PER_DECK);
  }

  return conversation + gamification + WILDS_PER_DECK;
}

/** Get total card counts across all bands for display. */
export function getTotalDeckSize(entitlements?: PackId[]): number {
  const bands: AgeBand[] = ["6-8", "9-10", "11-12", "13-14"];
  const filter = entitlements
    ? (c: Card) => isEntitled(c, entitlements)
    : () => true;

  const conv = allConversationCards.filter(filter).length;
  const gam = allGamificationCards.filter(filter).length;
  const wilds = entitlements
    ? (wildCards as Card[]).filter(filter).length
    : wildCards.length;

  return conv + gam + wilds;
}
