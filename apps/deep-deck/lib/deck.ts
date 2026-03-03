import type { AgeBand, Card, ConversationCard, GamificationCard } from "./types";
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

/** Build a shuffled deck for a given age band. */
export function buildDeck(ageBand: AgeBand): Card[] {
  const conversation: ConversationCard[] = allConversationCards.filter(
    (c) => c.ageBand === ageBand,
  );
  const gamification: GamificationCard[] = allGamificationCards.filter(
    (c) => c.ageBand === ageBand,
  );

  // Randomly select a subset of wild cards so modifiers stay rare
  const selectedWilds = shuffle(wildCards as Card[]).slice(0, WILDS_PER_DECK);

  const deck: Card[] = [...conversation, ...gamification, ...selectedWilds];

  return shuffleWithSpacing(deck);
}

/** Get the count of cards for a given age band (including wilds). */
export function getDeckSize(ageBand: AgeBand): number {
  const conversation = allConversationCards.filter(
    (c) => c.ageBand === ageBand,
  ).length;
  const gamification = allGamificationCards.filter(
    (c) => c.ageBand === ageBand,
  ).length;
  return conversation + gamification + WILDS_PER_DECK;
}
