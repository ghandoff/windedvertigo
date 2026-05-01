"use client";

/**
 * ChallengeShell — top-level orchestrator for Timer Challenge mode.
 *
 * "how much can you notice?" — not a speed test, but a noticing game.
 * The timer adds playful urgency. The celebration is always about
 * what you spotted, never about how fast you were.
 *
 * Phases:
 *   config → pick a time preset or free play
 *   active → timer + emoji grid — tap what you notice
 *   celebration → "wow, you spotted N things!"
 *   results → matcher results from the items you found
 */

import { Material } from "../matcher/types";
import { EmojiTile } from "../matcher/emoji-tile";
import { ProgressRing } from "../matcher/progress-ring";
import { MatcherResults } from "../matcher/matcher-results";
import { getMaterialEmoji } from "../matcher/material-emoji";
import { useChallengeState, ChallengeConfig } from "./use-challenge-state";
import { useMemo } from "react";
import {
  resolveCharacterFromForm,
  type CharacterName,
} from "@windedvertigo/characters";

interface ChallengeShellProps {
  materials: Material[];
  slots: string[];
}

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const SLOT_EMOJI: Record<string, string> = {
  scissors: "✂️",
  glue: "🫗",
  markers: "🖍️",
  water: "💧",
  oven: "🔥",
  hammer: "🔨",
};

const PRESETS: { label: string; emoji: string; seconds: number | null }[] = [
  { label: "30 seconds", emoji: "⚡", seconds: 30 },
  { label: "60 seconds", emoji: "🔥", seconds: 60 },
  { label: "90 seconds", emoji: "🌟", seconds: 90 },
  { label: "free play", emoji: "♾️", seconds: null },
];

export default function ChallengeShell({
  materials,
  slots,
}: ChallengeShellProps) {
  const state = useChallengeState(materials, slots);

  /* merge materials + slots into a flat list for the emoji grid.
     Materials carry an optional characterName so EmojiTile can render
     the harbour cast; slots don't (they're tools, not materials).     */
  const allItems = useMemo(() => {
    const items: {
      id: string;
      emoji: string;
      label: string;
      characterName: CharacterName | null;
    }[] = [];
    for (const mat of materials) {
      items.push({
        id: mat.id,
        emoji: getMaterialEmoji(mat.title, mat.form_primary, mat.emoji),
        label: mat.title,
        characterName: resolveCharacterFromForm(mat.form_primary, mat.title),
      });
    }
    for (const slot of slots) {
      items.push({
        id: slot,
        emoji: SLOT_EMOJI[slot] ?? "🔧",
        label: slot,
        characterName: null,
      });
    }
    return items;
  }, [materials, slots]);

  /* ── config phase ───────────────────────────────────────────── */
  if (state.phase === "config") {
    return (
      <div className="text-center">
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                state.startChallenge({
                  durationSeconds: preset.seconds,
                })
              }
              className="rounded-2xl px-6 py-4 text-base font-bold active:scale-[0.96] border-2"
              style={{
                borderColor: "rgba(39, 50, 72, 0.1)",
                backgroundColor: "var(--wv-cream)",
                color: "var(--wv-cadet)",
                transition: `all 220ms ${SPRING}`,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span className="mr-2">{preset.emoji}</span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── active phase ───────────────────────────────────────────── */
  if (state.phase === "active") {
    const isFreePlay = state.config.durationSeconds === null;
    const duration = state.config.durationSeconds ?? 0;
    const progress = isFreePlay ? 0 : 1 - state.timer.timeLeft / duration;

    return (
      <div>
        {/* timer or free-play header */}
        <div className="flex flex-col items-center mb-5">
          {!isFreePlay ? (
            <ProgressRing
              progress={progress}
              size={100}
              strokeWidth={7}
              label={`${state.timer.timeLeft} seconds remaining`}
            >
              <span
                className="text-2xl font-bold tabular-nums"
                style={{
                  color:
                    state.timer.timeLeft <= 10
                      ? "var(--wv-redwood)"
                      : "var(--color-text-on-tint)",
                  transition: "color 300ms ease",
                }}
              >
                {state.timer.timeLeft}
              </span>
            </ProgressRing>
          ) : (
            <p
              className="text-sm font-bold"
              style={{ color: "var(--wv-sienna)" }}
            >
              take your time — tap when you&apos;re done!
            </p>
          )}

          <p
            className="text-sm mt-3 font-bold"
            style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
          >
            spotted: {state.found.size}
          </p>
        </div>

        {/* emoji grid — larger tiles so each item reads clearly and the
            grid feels like a game board, not the same list as classic.  */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {allItems.map((item, i) => (
            <EmojiTile
              key={item.id}
              emoji={item.emoji}
              characterName={item.characterName}
              label={item.label}
              selected={state.found.has(item.id)}
              onClick={() => state.tapItem(item.id)}
              size="lg"
              fluid
              accentColor="var(--wv-sienna)"
              index={i}
            />
          ))}
        </div>

        {/* free play: done button */}
        {isFreePlay && state.found.size > 0 && (
          <div className="text-center mt-6">
            <button
              type="button"
              onClick={state.finishEarly}
              className="rounded-2xl px-8 py-4 text-base font-bold active:scale-95"
              style={{
                backgroundColor: "var(--wv-redwood)",
                color: "var(--wv-white)",
                boxShadow: "0 4px 16px rgba(177, 80, 67, 0.25)",
                transition: `all 250ms ${SPRING}`,
              }}
            >
              i&apos;m done! 🎉
            </button>
          </div>
        )}

        {/* spacer for bottom nav */}
        <div className="h-20 sm:h-8" />
      </div>
    );
  }

  /* ── celebration phase ──────────────────────────────────────── */
  if (state.phase === "celebration") {
    return (
      <div
        className="text-center py-8"
        style={{ animation: `celebrationPop 500ms ${SPRING}` }}
      >
        <span
          className="text-5xl block mb-4"
          style={{ animation: `celebrationBounce 600ms ${SPRING}` }}
        >
          🎉
        </span>

        <p
          className="text-xl font-bold mb-2"
          style={{ color: "var(--wv-cadet)" }}
        >
          you noticed {state.found.size} thing
          {state.found.size !== 1 ? "s" : ""}!
        </p>

        <p
          className="text-sm mb-3"
          style={{ color: "var(--wv-sienna)" }}
        >
          🤫 whisper what you found to someone — or shout it out!
        </p>

        <p
          className="text-sm mb-8"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          let&apos;s see what these can become
        </p>

        {/* look again — close to the top for easy restart */}
        <div className="mb-5">
          <button
            type="button"
            onClick={state.reset}
            className="text-sm font-medium"
            style={{ color: "var(--wv-cadet)", opacity: 0.55 }}
          >
            🔄 look again
          </button>
        </div>

        <button
          type="button"
          onClick={state.submitToMatcher}
          disabled={state.loading}
          className="rounded-2xl px-8 py-4 text-base font-bold active:scale-95"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
            boxShadow: "0 4px 20px rgba(177, 80, 67, 0.3)",
            transition: `all 250ms ${SPRING}`,
          }}
        >
          {state.loading ? (
            <>
              <span className="inline-block animate-spin mr-2">🔮</span>
              looking…
            </>
          ) : (
            <>what can these become? ✨</>
          )}
        </button>

        {state.error && (
          <p
            className="text-sm mt-3"
            style={{ color: "var(--wv-redwood)" }}
          >
            {state.error}
          </p>
        )}

        <style>{`
          @keyframes celebrationPop {
            from { opacity: 0; transform: scale(0.9); }
            to   { opacity: 1; transform: scale(1); }
          }
          @keyframes celebrationBounce {
            0%   { transform: scale(0); }
            50%  { transform: scale(1.3); }
            100% { transform: scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes celebrationPop { from, to { opacity: 1; transform: none; } }
            @keyframes celebrationBounce { from, to { transform: scale(1); } }
          }
        `}</style>
      </div>
    );
  }

  /* ── results phase ──────────────────────────────────────────── */
  return (
    <div>
      {/* look again — near the top, close to mode selector */}
      <div className="text-center mb-4">
        <button
          type="button"
          onClick={state.reset}
          className="text-sm font-medium mb-3"
          style={{ color: "var(--wv-cadet)", opacity: 0.55 }}
        >
          🔄 look again
        </button>
        <p
          className="text-sm font-bold"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          you noticed {state.found.size} thing
          {state.found.size !== 1 ? "s" : ""} — here&apos;s what they can become
        </p>
      </div>

      <MatcherResults
        results={state.matcherResults}
        loading={state.loading}
        resultsRef={state.resultsRef as React.RefObject<HTMLDivElement>}
        selectedMaterialsSize={state.found.size}
      />
    </div>
  );
}
