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

/** Build a shuffled deck for a given age band. */
export function buildDeck(ageBand: AgeBand): Card[] {
  const conversation: ConversationCard[] = allConversationCards.filter(
    (c) => c.ageBand === ageBand,
  );
  const gamification: GamificationCard[] = allGamificationCards.filter(
    (c) => c.ageBand === ageBand,
  );

  // Combine age-band-specific cards with all wild cards
  const deck: Card[] = [...conversation, ...gamification, ...wildCards];

  return shuffle(deck);
}

/** Get the count of cards for a given age band (including wilds). */
export function getDeckSize(ageBand: AgeBand): number {
  const conversation = allConversationCards.filter(
    (c) => c.ageBand === ageBand,
  ).length;
  const gamification = allGamificationCards.filter(
    (c) => c.ageBand === ageBand,
  ).length;
  return conversation + gamification + wildCards.length;
}
