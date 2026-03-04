"use client";

import { useReducer, useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AgeBand, Card, DepthLevel } from "@/lib/types";
import { AGE_BAND_LABELS } from "@/lib/types";
import { gameReducer, initialState, getCurrentCard } from "@/lib/game-reducer";
import { getDeckSize } from "@/lib/deck";
import { useAccess } from "@/lib/use-access";
import { CardDisplay } from "@/components/card-display";
import { DepthSelector } from "@/components/depth-selector";
import { WildBanner } from "@/components/wild-banner";
import { GameControls } from "@/components/game-controls";
import { UpsellBanner } from "@/components/upsell-banner";
import { UpsellEndScreen } from "@/components/upsell-end-screen";

/** Fetch a shuffled deck from the server API. */
async function fetchDeck(
  band: AgeBand,
  packs: string[],
  sessionId: string | null,
): Promise<Card[]> {
  const params = new URLSearchParams({
    band,
    packs: packs.join(","),
  });

  const headers: Record<string, string> = {};
  if (sessionId) {
    headers["x-dd-session"] = sessionId;
  }

  const res = await fetch(`/api/deck?${params}`, { headers });
  const data = await res.json();
  return data.deck;
}

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const band = (searchParams.get("band") || "6-8") as AgeBand;
  const { entitlements, isSamplerOnly, sessionId } = useAccess();

  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Load deck from server API
  useEffect(() => {
    let cancelled = false;

    async function loadDeck() {
      setLoading(true);
      setLoadError(false);
      try {
        const deck = await fetchDeck(band, entitlements, sessionId);
        if (!cancelled) {
          dispatch({ type: "START_GAME", ageBand: band, deck });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      }
    }

    loadDeck();
    return () => {
      cancelled = true;
    };
  }, [band, entitlements, sessionId]);

  const currentCard = getCurrentCard(state);

  // How many more cards would the full deck add?
  const fullDeckSize = getDeckSize(band, ["sampler", "full"]);
  const samplerDeckSize = getDeckSize(band, ["sampler"]);
  const additionalCards = fullDeckSize - samplerDeckSize;

  const handleFlip = useCallback(() => {
    dispatch({ type: "FLIP_CARD" });
  }, []);

  const handleNext = useCallback(() => {
    dispatch({ type: "DRAW_NEXT" });
  }, []);

  const handleSetDepth = useCallback((depth: DepthLevel) => {
    dispatch({ type: "SET_DEPTH", depth });
  }, []);

  const handleClearWild = useCallback(() => {
    dispatch({ type: "CLEAR_WILD" });
  }, []);

  const handleShuffle = useCallback(() => {
    dispatch({ type: "SHUFFLE_REMAINING" });
  }, []);

  const handleEnd = useCallback(() => {
    dispatch({ type: "END_GAME" });
  }, []);

  const handleRestart = useCallback(async () => {
    setLoading(true);
    const deck = await fetchDeck(band, entitlements, sessionId);
    dispatch({ type: "START_GAME", ageBand: band, deck });
    setLoading(false);
  }, [band, entitlements, sessionId]);

  const handleNewBand = useCallback(() => {
    router.push("/play/pick");
  }, [router]);

  const handleUpgrade = useCallback(() => {
    router.push("/checkout");
  }, [router]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-[var(--dd-cadet)]/10 flex items-center justify-center mb-4 animate-pulse">
          <span className="text-lg font-bold text-[var(--dd-cadet)]/40">DD</span>
        </div>
        <p className="text-[var(--dd-cadet)]/50 text-sm">Shuffling deck...</p>
      </div>
    );
  }

  // ── Error state ──
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[var(--dd-cadet)] mb-2">
          Couldn&apos;t load the deck
        </h2>
        <p className="text-sm text-[var(--dd-cadet)]/60 mb-6 max-w-xs">
          Something went wrong fetching your cards. Please try again.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleNewBand}
            className="px-6 py-3 rounded-xl text-sm font-medium bg-[var(--dd-cadet)]/10 text-[var(--dd-cadet)] hover:bg-[var(--dd-cadet)]/20 transition-colors"
          >
            Pick Age Band
          </button>
        </div>
      </div>
    );
  }

  // ── End screen ──
  if (state.phase === "ended") {
    if (isSamplerOnly) {
      return (
        <UpsellEndScreen
          ageBand={state.ageBand}
          cardsPlayed={state.cardsPlayed}
          onRestart={handleRestart}
          onNewBand={handleNewBand}
          onUpgrade={handleUpgrade}
        />
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center mb-6">
          <span className="text-2xl font-bold text-white">DD</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--dd-cadet)] mb-2">
          Session complete
        </h1>
        <p className="text-[var(--dd-cadet)]/60 mb-1">
          {AGE_BAND_LABELS[state.ageBand].label} &middot; Grades{" "}
          {AGE_BAND_LABELS[state.ageBand].grades}
        </p>
        <p className="text-3xl font-bold text-[var(--dd-redwood)] mb-8">
          {state.cardsPlayed} cards played
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-cadet)] text-white hover:bg-[var(--dd-cadet)]/90 transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={handleNewBand}
            className="px-6 py-3 rounded-xl text-sm font-medium bg-[var(--dd-cadet)]/10 text-[var(--dd-cadet)] hover:bg-[var(--dd-cadet)]/20 transition-colors"
          >
            New Age Group
          </button>
        </div>
      </div>
    );
  }

  // ── Playing screen ──
  if (!currentCard) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 sm:py-10">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 max-w-sm mx-auto w-full">
        <button
          onClick={handleNewBand}
          className="text-sm text-[var(--dd-cadet)]/50 hover:text-[var(--dd-cadet)] transition-colors"
        >
          &larr; Back
        </button>
        <span className="text-sm font-medium text-[var(--dd-cadet)]/60">
          {AGE_BAND_LABELS[band].label}
          {isSamplerOnly && (
            <span className="ml-1 text-[var(--dd-redwood)]/60">(sampler)</span>
          )}
        </span>
      </header>

      {/* Upsell banner for sampler users — show after a few cards */}
      {isSamplerOnly && state.cardsPlayed >= 3 && state.cardsPlayed % 5 === 3 && (
        <UpsellBanner totalFull={additionalCards} onUpgrade={handleUpgrade} />
      )}

      {/* Wild card banner */}
      {state.activeWild && currentCard.type !== "wild" && (
        <div className="max-w-sm mx-auto w-full mb-4">
          <WildBanner wild={state.activeWild} onDismiss={handleClearWild} />
        </div>
      )}

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <CardDisplay
          card={currentCard}
          isFlipped={state.isFlipped}
          currentDepth={state.currentDepth}
          onFlip={handleFlip}
          drawKey={state.currentIndex}
        />

        {/* Depth selector — only for conversation cards when flipped */}
        {state.isFlipped && currentCard.type === "conversation" && (
          <DepthSelector
            currentDepth={state.currentDepth}
            onSelect={handleSetDepth}
          />
        )}
      </div>

      {/* Controls */}
      <div className="mt-6">
        <GameControls
          onNext={handleNext}
          onShuffle={handleShuffle}
          onEnd={handleEnd}
          cardsPlayed={state.cardsPlayed}
          totalCards={state.deck.length}
        />
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[var(--dd-cadet)]/50">Loading deck...</p>
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
