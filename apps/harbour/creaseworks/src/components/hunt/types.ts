/**
 * Types for Scavenger Hunt mode.
 *
 * The hunt reverses the matcher flow: instead of "pick materials → find playdates,"
 * it's "pick a vibe → get a playdate → go find the materials."
 * The hunt itself is the learning — the "find" phase made physical.
 */

import { RankedPlaydate } from "@/lib/queries/matcher/types";

export type VibeKey = "messy" | "quiet" | "outside" | "kitchen" | "quick" | "big-build";

export interface VibeConfig {
  key: VibeKey;
  label: string;
  emoji: string;
  /** mapped to MatcherInput.contexts */
  contexts: string[];
  /** mapped to MatcherInput.energyLevels */
  energyLevels: string[];
  color: string;
  description: string;
}

export type HuntPlayer = 1 | 2;
export type HuntMode = "solo" | "two-player";

export interface ChecklistItem {
  id: string;
  label: string;
  emoji: string;
  /** optional custom icon URL — replaces the text emoji when present */
  iconSrc?: string;
  /** true = required material, false = optional slot (bonus) */
  required: boolean;
}

export type HuntPhase =
  | "vibe"
  | "loading"
  | "pick"
  | "mode-select"
  | "checklist"
  | "buddy-check"
  | "unlocked";

export interface HuntState {
  phase: HuntPhase;
  vibe: VibeConfig | null;
  candidates: RankedPlaydate[];
  playdate: RankedPlaydate | null;
  mode: HuntMode;
  items: ChecklistItem[];
  /** per-player checked sets */
  checked: Record<HuntPlayer, Set<string>>;
  /** which player is currently active */
  activePlayer: HuntPlayer;
  error: string | null;
}
