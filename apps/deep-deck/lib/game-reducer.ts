import type { AgeBand, Card, DepthLevel, GameSession, WildCard } from "./types";
import { buildDeck, shuffleWithSpacing } from "./deck";

export type GameAction =
  | { type: "START_GAME"; ageBand: AgeBand }
  | { type: "FLIP_CARD" }
  | { type: "DRAW_NEXT" }
  | { type: "SET_DEPTH"; depth: DepthLevel }
  | { type: "APPLY_WILD"; wild: WildCard }
  | { type: "CLEAR_WILD" }
  | { type: "SHUFFLE_REMAINING" }
  | { type: "END_GAME" };

export const initialState: GameSession = {
  phase: "picking",
  ageBand: "6-8",
  deck: [],
  currentIndex: 0,
  currentDepth: "deep",
  isFlipped: false,
  activeWild: null,
  cardsPlayed: 0,
};

export function gameReducer(state: GameSession, action: GameAction): GameSession {
  switch (action.type) {
    case "START_GAME": {
      const deck = buildDeck(action.ageBand);
      return {
        ...initialState,
        phase: "playing",
        ageBand: action.ageBand,
        deck,
        currentIndex: 0,
        isFlipped: false,
      };
    }

    case "FLIP_CARD":
      return {
        ...state,
        isFlipped: !state.isFlipped,
      };

    case "DRAW_NEXT": {
      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.deck.length) {
        return { ...state, phase: "ended" };
      }

      const nextCard = state.deck[nextIndex];
      const currentCard = state.deck[state.currentIndex];

      // If next card is a wild card, store it as the active modifier
      if (nextCard.type === "wild") {
        return {
          ...state,
          currentIndex: nextIndex,
          currentDepth: "deep",
          isFlipped: false,
          activeWild: nextCard,
          cardsPlayed: state.cardsPlayed + 1,
        };
      }

      // Keep activeWild if we're advancing FROM a wild card —
      // the modifier should display as a banner on the next non-wild card.
      // Otherwise clear it (the modifier has been shown for one card).
      return {
        ...state,
        currentIndex: nextIndex,
        currentDepth: "deep",
        isFlipped: false,
        activeWild: currentCard?.type === "wild" ? state.activeWild : null,
        cardsPlayed: state.cardsPlayed + 1,
      };
    }

    case "SET_DEPTH":
      return {
        ...state,
        currentDepth: action.depth,
      };

    case "APPLY_WILD":
      return {
        ...state,
        activeWild: action.wild,
      };

    case "CLEAR_WILD":
      return {
        ...state,
        activeWild: null,
      };

    case "SHUFFLE_REMAINING": {
      const played = state.deck.slice(0, state.currentIndex + 1);
      const remaining = state.deck.slice(state.currentIndex + 1);
      const reshuffled = shuffleWithSpacing(remaining);

      // If the current card is wild, make sure the first reshuffled card isn't
      const lastPlayed = played[played.length - 1];
      if (
        lastPlayed?.type === "wild" &&
        reshuffled.length > 1 &&
        reshuffled[0].type === "wild"
      ) {
        const swapIdx = reshuffled.findIndex((c) => c.type !== "wild");
        if (swapIdx > 0) {
          [reshuffled[0], reshuffled[swapIdx]] = [reshuffled[swapIdx], reshuffled[0]];
        }
      }

      return {
        ...state,
        deck: [...played, ...reshuffled],
      };
    }

    case "END_GAME":
      return {
        ...state,
        phase: "ended",
      };

    default:
      return state;
  }
}

/** Get the current card from the game state. */
export function getCurrentCard(state: GameSession): Card | null {
  if (state.phase !== "playing" || state.currentIndex >= state.deck.length) {
    return null;
  }
  return state.deck[state.currentIndex];
}
