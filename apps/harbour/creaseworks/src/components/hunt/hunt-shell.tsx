"use client";

/**
 * HuntShell — the full scavenger hunt experience.
 *
 * Reverses the matcher: pick a vibe → system finds a playdate →
 * kid goes on a hunt for the materials. The hunt itself is the
 * "find" phase made physical — celebrating the joy of looking,
 * noticing, and discovering.
 *
 * Two-player mode splits the checklist between two explorers.
 * Pass-the-phone: player 1 checks their items, taps "done",
 * hands the phone to player 2. Both lists combine at the end.
 *
 * "creative but not frivolous, curious but not aimless."
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { EmojiTile } from "../matcher/emoji-tile";
import { ProgressRing } from "../matcher/progress-ring";
import { getMaterialEmoji, getMaterialIcon } from "../matcher/material-emoji";
import { findRoomsForMaterial } from "../matcher/room-config";
import { apiUrl } from "@/lib/api-url";
import { RankedPlaydate, MatcherResult } from "@/lib/queries/matcher/types";
import {
  VibeConfig,
  ChecklistItem,
  HuntState,
  HuntMode,
  HuntPlayer,
} from "./types";
import { VIBES, filterVibesForAvailableContexts } from "./vibe-config";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const SLOT_EMOJI: Record<string, string> = {
  scissors: "✂️",
  glue: "🫗",
  markers: "🖍️",
  water: "💧",
  oven: "🔥",
  hammer: "🔨",
};

interface HuntShellProps {
  contexts: string[];
}

function buildChecklistItems(playdate: RankedPlaydate): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  for (const mat of playdate.materials) {
    items.push({
      id: mat.id,
      label: mat.title,
      emoji: getMaterialEmoji(mat.title, mat.formPrimary),
      iconSrc: getMaterialIcon(mat.title, mat.formPrimary) ?? undefined,
      required: true,
    });
  }

  for (const slot of playdate.slotsOptional) {
    items.push({
      id: `slot-${slot}`,
      label: slot,
      emoji: SLOT_EMOJI[slot] ?? "🔧",
      required: false,
    });
  }

  return items;
}

function splitItemsForPlayers(items: ChecklistItem[]): {
  player1: ChecklistItem[];
  player2: ChecklistItem[];
} {
  const required = items.filter((i) => i.required);
  const bonus = items.filter((i) => !i.required);
  const p1: ChecklistItem[] = [];
  const p2: ChecklistItem[] = [];

  // interleave required items
  required.forEach((item, i) => (i % 2 === 0 ? p1 : p2).push(item));
  // interleave bonus items
  bonus.forEach((item, i) => (i % 2 === 0 ? p1 : p2).push(item));

  return { player1: p1, player2: p2 };
}

const INITIAL_STATE: HuntState = {
  phase: "mode-select",
  vibe: null,
  candidates: [],
  playdate: null,
  mode: "solo",
  items: [],
  checked: { 1: new Set(), 2: new Set() },
  activePlayer: 1,
  error: null,
};

export default function HuntShell({ contexts }: HuntShellProps) {
  const [state, setState] = useState<HuntState>(INITIAL_STATE);

  const availableVibes = useMemo(
    () => filterVibesForAvailableContexts(VIBES, contexts),
    [contexts],
  );

  /* ── actions ────────────────────────────────────────────────── */

  /** Step 1: choose solo or two-player (now first, not after picking a playdate) */
  const chooseMode = useCallback((mode: HuntMode) => {
    setState((s) => ({ ...s, mode, phase: "vibe" as const }));
  }, []);

  const selectVibe = useCallback(async (vibe: VibeConfig) => {
    setState((s) => ({ ...s, phase: "loading", vibe, error: null }));

    try {
      /**
       * Progressive fallback: try increasingly broad queries until we
       * get results. The DB may not have the full energy/context
       * vocabulary yet, so we gracefully degrade.
       *
       *   1. contexts + energyLevels (exact match)
       *   2. contexts only (drop energy requirement)
       *   3. energyLevels only (drop context requirement)
       *   4. broad query with all contexts from the DB (show anything)
       */
      const tryFetch = async (
        contexts: string[],
        energyLevels: string[],
      ): Promise<MatcherResult | null> => {
        // must have at least one filter for the API
        if (contexts.length === 0 && energyLevels.length === 0) return null;
        const res = await fetch(apiUrl("/api/matcher"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materials: [],
            forms: [],
            slots: [],
            contexts,
            energyLevels: energyLevels.length > 0 ? energyLevels : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `request failed (${res.status})`);
        }
        return res.json() as Promise<MatcherResult>;
      };

      let data: MatcherResult | null = null;

      // 1. exact: both contexts + energy
      if (vibe.contexts.length > 0 || vibe.energyLevels.length > 0) {
        data = await tryFetch(vibe.contexts, vibe.energyLevels);
      }

      // 2. drop energy, keep contexts
      if ((!data || data.ranked.length === 0) && vibe.contexts.length > 0) {
        data = await tryFetch(vibe.contexts, []);
      }

      // 3. drop contexts, keep energy
      if ((!data || data.ranked.length === 0) && vibe.energyLevels.length > 0) {
        data = await tryFetch([], vibe.energyLevels);
      }

      // 4. broadest: just use "classroom" (known to exist in DB)
      if (!data || data.ranked.length === 0) {
        data = await tryFetch(["classroom"], []);
      }

      const top3 = data?.ranked.slice(0, 3) ?? [];

      if (top3.length === 0) {
        setState((s) => ({
          ...s,
          phase: "vibe",
          error: "hmm, no playdates matched that vibe. try another!",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        phase: "pick",
        candidates: top3,
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        phase: "vibe",
        error: err.message || "something went wrong",
      }));
    }
  }, []);

  const pickPlaydate = useCallback((playdate: RankedPlaydate) => {
    const items = buildChecklistItems(playdate);
    setState((s) => ({
      ...s,
      /* mode already chosen at step 1 — go straight to checklist (or unlock if empty) */
      phase: items.length > 0 ? ("checklist" as const) : ("unlocked" as const),
      playdate,
      items,
      activePlayer: 1 as HuntPlayer,
      checked: { 1: new Set<string>(), 2: new Set<string>() },
    }));
  }, []);

  const surpriseMe = useCallback(() => {
    if (state.candidates.length > 0) {
      pickPlaydate(state.candidates[0]);
    }
  }, [state.candidates, pickPlaydate]);

  /* setMode is now chooseMode (step 1) — kept for reference */

  const checkItem = useCallback((itemId: string) => {
    setState((prev) => {
      const player = prev.activePlayer;
      const prevSet = prev.checked[player];
      const next = new Set(prevSet);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      // build a brand-new checked object to ensure React sees a new reference
      const newChecked: Record<HuntPlayer, Set<string>> = {
        1: player === 1 ? next : prev.checked[1],
        2: player === 2 ? next : prev.checked[2],
      };
      return { ...prev, checked: newChecked };
    });
  }, []);

  const playerDone = useCallback(() => {
    setState((s) => {
      if (s.mode === "solo") {
        return { ...s, phase: "unlocked" };
      }
      if (s.activePlayer === 1) {
        // save p1 checked to sessionStorage for pass-the-phone
        try {
          const key = `hunt-p1-${s.playdate?.playdateId}`;
          sessionStorage.setItem(key, JSON.stringify([...s.checked[1]]));
        } catch {}
        return { ...s, activePlayer: 2 as HuntPlayer };
      }
      return { ...s, phase: "buddy-check" };
    });
  }, []);

  const unlock = useCallback(() => {
    setState((s) => ({ ...s, phase: "unlocked" }));
  }, []);

  const restart = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /* ── derived ────────────────────────────────────────────────── */

  const playerItems = useMemo(() => {
    if (state.mode === "solo") return { player1: state.items, player2: [] };
    return splitItemsForPlayers(state.items);
  }, [state.mode, state.items]);

  const currentItems =
    state.activePlayer === 1 ? playerItems.player1 : playerItems.player2;
  const currentChecked = state.checked[state.activePlayer];
  const requiredItems = currentItems.filter((i) => i.required);
  const requiredChecked = requiredItems.filter((i) => currentChecked.has(i.id));
  const allRequiredFound = requiredChecked.length >= requiredItems.length;

  /* ── render ─────────────────────────────────────────────────── */

  /* step 1: mode select — solo or two-player (first!) */
  if (state.phase === "mode-select") {
    return (
      <div className="text-center">
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => chooseMode("solo")}
            className="rounded-2xl px-6 py-4 text-base font-bold border-2 active:scale-[0.97]"
            style={{
              borderColor: "rgba(39, 50, 72, 0.12)",
              backgroundColor: "var(--wv-cream)",
              color: "var(--color-text-on-cream)",
              transition: `all 220ms ${SPRING}`,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            🧭 just me
          </button>
          <button
            type="button"
            onClick={() => chooseMode("two-player")}
            className="rounded-2xl px-6 py-4 text-base font-bold border-2 active:scale-[0.97]"
            style={{
              borderColor: "rgba(39, 50, 72, 0.12)",
              backgroundColor: "var(--wv-cream)",
              color: "var(--color-text-on-cream)",
              transition: `all 220ms ${SPRING}`,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            👯 with a friend
          </button>
        </div>
      </div>
    );
  }

  /* step 2: vibe selection */
  if (state.phase === "vibe") {
    return (
      <div>
        <p
          className="text-sm text-center mb-4 font-bold"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          {state.mode === "two-player" ? "what sounds fun to you two?" : "what sounds fun?"}
        </p>
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {availableVibes.length === 0 && (
            <p
              className="text-sm text-center py-6"
              style={{ color: "var(--color-text-on-cream-muted)" }}
            >
              no vibes available right now — check back soon!
            </p>
          )}
          {availableVibes.map((vibe) => (
            <button
              key={vibe.key}
              type="button"
              onClick={() => selectVibe(vibe)}
              className="rounded-2xl px-5 py-4 text-left border-2 active:scale-[0.97]"
              style={{
                borderColor: "rgba(39, 50, 72, 0.12)",
                backgroundColor: "var(--wv-cream)",
                transition: `all 220ms ${SPRING}`,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span className="text-2xl mr-3">{vibe.emoji}</span>
              <span
                className="text-sm font-bold"
                style={{ color: "var(--color-text-on-cream)" }}
              >
                {vibe.label}
              </span>
              <span
                className="block text-xs mt-0.5 ml-10"
                style={{ color: "var(--color-text-on-cream-muted)" }}
              >
                {vibe.description}
              </span>
            </button>
          ))}
        </div>

        {state.error && (
          <p
            className="text-sm mt-4 text-center"
            style={{ color: "var(--wv-redwood)" }}
          >
            {state.error}
          </p>
        )}
      </div>
    );
  }

  /* loading */
  if (state.phase === "loading") {
    return (
      <div className="text-center py-12">
        <span
          className="text-4xl inline-block animate-bounce"
          style={{ animationDuration: "800ms" }}
        >
          🔮
        </span>
        <p
          className="text-sm mt-4"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          finding an adventure for you…
        </p>
      </div>
    );
  }

  /* pick a playdate */
  if (state.phase === "pick") {
    return (
      <div>
        <p
          className="text-lg font-bold mb-2 text-center"
          style={{ color: "var(--color-text-on-cream)" }}
        >
          pick one!
        </p>
        <p
          className="text-sm mb-6 text-center"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          or let us surprise you
        </p>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {state.candidates.map((pd) => (
            <button
              key={pd.playdateId}
              type="button"
              onClick={() => pickPlaydate(pd)}
              className="rounded-2xl px-5 py-4 text-left border-2 active:scale-[0.97]"
              style={{
                borderColor: "rgba(39, 50, 72, 0.12)",
                backgroundColor: "var(--wv-cream)",
                transition: `all 220ms ${SPRING}`,
              }}
            >
              <span
                className="text-sm font-bold block"
                style={{ color: "var(--color-text-on-cream)" }}
              >
                {pd.title}
              </span>
              {pd.headline && (
                <span
                  className="text-xs block mt-0.5"
                  style={{ color: "var(--color-text-on-cream-muted)" }}
                >
                  {pd.headline}
                </span>
              )}
              <span
                className="text-xs block mt-1"
                style={{ color: "var(--wv-sienna)", opacity: 0.7 }}
              >
                {pd.materials.length > 0
                  ? `${pd.materials.length} thing${pd.materials.length !== 1 ? "s" : ""} to find`
                  : "free-form adventure"}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={surpriseMe}
            className="rounded-2xl px-5 py-4 text-center font-bold active:scale-[0.97]"
            style={{
              backgroundColor: "var(--wv-redwood)",
              color: "var(--wv-white)",
              boxShadow: "0 3px 12px rgba(177, 80, 67, 0.25)",
              transition: `all 220ms ${SPRING}`,
            }}
          >
            🎲 surprise me!
          </button>
        </div>
      </div>
    );
  }

  /* checklist */
  if (state.phase === "checklist") {
    const progress =
      requiredItems.length > 0
        ? requiredChecked.length / requiredItems.length
        : 0;

    return (
      <div>
        {/* player header */}
        <div className="text-center mb-4">
          {state.mode === "two-player" && (
            <p
              className="text-xs font-bold tracking-wider mb-1"
              style={{ color: "var(--wv-sienna)" }}
            >
              player {state.activePlayer}
            </p>
          )}
          <p
            className="text-base font-bold"
            style={{ color: "var(--color-text-on-cream)" }}
          >
            go find your stuff!
          </p>
        </div>

        {/* progress ring */}
        <div className="flex justify-center mb-5">
          <ProgressRing
            progress={progress}
            size={90}
            strokeWidth={6}
            color="var(--wv-sienna)"
            label={`${requiredChecked.length} of ${requiredItems.length} found`}
          >
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: "var(--color-text-on-cream)" }}
            >
              {requiredChecked.length}/{requiredItems.length}
            </span>
          </ProgressRing>
        </div>

        {/* checklist items */}
        <div className="flex flex-col gap-2 max-w-sm mx-auto">
          {currentItems.map((item) => {
            const checked = currentChecked.has(item.id);
            const rooms = findRoomsForMaterial(item.label);
            const roomHint =
              rooms.length > 0 ? `look in the ${rooms[0].label}` : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => checkItem(item.id)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left active:scale-[0.98]"
                style={{
                  backgroundColor: checked
                    ? "color-mix(in srgb, var(--wv-redwood) 10%, var(--wv-cream))"
                    : "var(--wv-cream)",
                  border: checked
                    ? "2px solid var(--wv-redwood)"
                    : "2px solid rgba(39, 50, 72, 0.12)",
                  transition: `all 220ms ${SPRING}`,
                  opacity: checked ? 0.7 : 1,
                }}
                role="checkbox"
                aria-checked={checked}
              >
                {/* checkbox */}
                <span
                  className="flex-shrink-0 rounded-lg flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: checked
                      ? "var(--wv-redwood)"
                      : "rgba(39, 50, 72, 0.08)",
                    color: "var(--wv-white)",
                    fontSize: "0.8rem",
                    transition: `all 220ms ${SPRING}`,
                  }}
                >
                  {checked ? "✓" : ""}
                </span>

                {/* emoji or custom icon + label */}
                {item.iconSrc ? (
                  <img
                    src={item.iconSrc}
                    alt=""
                    width={24}
                    height={24}
                    className="object-contain flex-shrink-0"
                    draggable={false}
                  />
                ) : (
                  <span className="text-xl">{item.emoji}</span>
                )}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-sm font-medium block"
                    style={{
                      color: "var(--color-text-on-cream)",
                      textDecoration: checked ? "line-through" : "none",
                    }}
                  >
                    {item.required
                      ? `can you spot ${item.label}?`
                      : `bonus: ${item.label}`}
                  </span>
                  {roomHint && !checked && (
                    <span
                      className="text-xs block"
                      style={{ color: "var(--wv-sienna)", opacity: 0.7 }}
                    >
                      💡 {roomHint}
                    </span>
                  )}
                </div>

                {/* bonus badge */}
                {!item.required && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(228, 196, 137, 0.3)",
                      color: "var(--color-text-on-cream)",
                      fontSize: "0.55rem",
                    }}
                  >
                    bonus
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* done button */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={playerDone}
            disabled={!allRequiredFound}
            className="rounded-2xl px-8 py-4 text-base font-bold active:scale-95 disabled:opacity-30"
            style={{
              backgroundColor: "var(--wv-redwood)",
              color: "var(--wv-white)",
              boxShadow: allRequiredFound
                ? "0 4px 16px rgba(177, 80, 67, 0.25)"
                : "none",
              transition: `all 250ms ${SPRING}`,
            }}
          >
            {state.mode === "two-player" && state.activePlayer === 1
              ? "i found mine! pass to player 2 →"
              : allRequiredFound
                ? "i found everything! 🎉"
                : `${requiredItems.length - requiredChecked.length} more to find`}
          </button>
        </div>

        <div className="h-20 sm:h-8" />
      </div>
    );
  }

  /* buddy check */
  if (state.phase === "buddy-check") {
    const { player1: p1Items, player2: p2Items } = playerItems;
    const p1Count = p1Items.filter((i) => state.checked[1].has(i.id)).length;
    const p2Count = p2Items.filter((i) => state.checked[2].has(i.id)).length;
    const p1Total = p1Items.length;
    const p2Total = p2Items.length;
    const bothDone =
      p1Items.filter((i) => i.required).every((i) => state.checked[1].has(i.id)) &&
      p2Items.filter((i) => i.required).every((i) => state.checked[2].has(i.id));

    return (
      <div className="text-center">
        <p
          className="text-lg font-bold mb-2"
          style={{ color: "var(--color-text-on-cream)" }}
        >
          buddy check! 🤝
        </p>

        <div className="flex gap-4 justify-center my-6">
          <div>
            <ProgressRing
              progress={p1Total > 0 ? p1Count / p1Total : 0}
              size={80}
              strokeWidth={5}
              color="var(--wv-sienna)"
              label={`player 1: ${p1Count} of ${p1Total}`}
            >
              <span
                className="text-xs font-bold"
                style={{ color: "var(--color-text-on-cream)" }}
              >
                {p1Count}/{p1Total}
              </span>
            </ProgressRing>
            <p
              className="text-xs font-bold mt-1"
              style={{ color: "var(--color-text-on-cream)" }}
            >
              player 1
            </p>
          </div>
          <div>
            <ProgressRing
              progress={p2Total > 0 ? p2Count / p2Total : 0}
              size={80}
              strokeWidth={5}
              color="var(--wv-redwood)"
              label={`player 2: ${p2Count} of ${p2Total}`}
            >
              <span
                className="text-xs font-bold"
                style={{ color: "var(--color-text-on-cream)" }}
              >
                {p2Count}/{p2Total}
              </span>
            </ProgressRing>
            <p
              className="text-xs font-bold mt-1"
              style={{ color: "var(--color-text-on-cream)" }}
            >
              player 2
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={unlock}
          disabled={!bothDone}
          className="rounded-2xl px-8 py-4 text-base font-bold active:scale-95 disabled:opacity-30"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
            boxShadow: bothDone
              ? "0 4px 20px rgba(177, 80, 67, 0.3)"
              : "none",
            transition: `all 250ms ${SPRING}`,
          }}
        >
          {bothDone ? "you're both ready! let's make it! 🎉" : "almost there…"}
        </button>
      </div>
    );
  }

  /* unlocked — ready to play! */
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
        style={{ color: "var(--color-text-on-cream)" }}
      >
        you&apos;re ready!
      </p>

      <p
        className="text-base font-bold mb-2"
        style={{ color: "var(--wv-sienna)" }}
      >
        {state.playdate?.title}
      </p>

      {state.playdate?.headline && (
        <p
          className="text-sm mb-6"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          {state.playdate.headline}
        </p>
      )}

      {/* link to playdate if entitled */}
      {state.playdate?.isEntitled && (
        <Link
          href={`/packs/${state.playdate.packSlugs[0]}/playdates/${state.playdate.slug}`}
          className="inline-block rounded-2xl px-8 py-4 text-base font-bold"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
            boxShadow: "0 4px 20px rgba(177, 80, 67, 0.3)",
          }}
        >
          let&apos;s make this! ✨
        </Link>
      )}

      {!state.playdate?.isEntitled && state.playdate?.packSlugs.length ? (
        <Link
          href={`/packs/${state.playdate.packSlugs[0]}`}
          className="inline-block rounded-2xl px-8 py-4 text-base font-bold"
          style={{
            backgroundColor: "var(--wv-sienna)",
            color: "var(--wv-white)",
            boxShadow: "0 4px 20px rgba(203, 120, 88, 0.3)",
          }}
        >
          see the pack →
        </Link>
      ) : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={restart}
          className="text-sm font-medium"
          style={{ color: "var(--color-text-on-cream-muted)" }}
        >
          start a new hunt
        </button>
      </div>

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
