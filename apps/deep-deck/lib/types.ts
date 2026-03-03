export type AgeBand = "6-8" | "9-10" | "11-12" | "13-14";

export type DepthLevel = "deep" | "deeper" | "deepest";

/** Pack identifiers — "sampler" is free, everything else requires purchase. */
export type PackId = "sampler" | "full";

export interface ConversationCard {
  id: string;
  type: "conversation";
  ageBand: AgeBand;
  pack: PackId;
  prompts: Record<DepthLevel, string>;
  tip: string;
}

export interface GamificationCard {
  id: string;
  type: "gamification";
  ageBand: AgeBand;
  pack: PackId;
  title: string;
  instructions: string;
  tip: string;
}

export interface WildCard {
  id: string;
  type: "wild";
  pack: PackId;
  title: string;
  description: string;
  effect: string;
}

export type Card = ConversationCard | GamificationCard | WildCard;

export type GamePhase = "picking" | "playing" | "ended";

export interface GameSession {
  phase: GamePhase;
  ageBand: AgeBand;
  deck: Card[];
  currentIndex: number;
  currentDepth: DepthLevel;
  isFlipped: boolean;
  activeWild: WildCard | null;
  cardsPlayed: number;
}

export const AGE_BAND_LABELS: Record<AgeBand, { grades: string; label: string }> = {
  "6-8": { grades: "1-2", label: "Ages 6\u20138" },
  "9-10": { grades: "3-4", label: "Ages 9\u201310" },
  "11-12": { grades: "5-6", label: "Ages 11\u201312" },
  "13-14": { grades: "7-8", label: "Ages 13\u201314" },
};

export const DEPTH_LABELS: Record<DepthLevel, string> = {
  deep: "Deep",
  deeper: "Deeper",
  deepest: "Deepest",
};
