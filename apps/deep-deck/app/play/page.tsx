"use client";

import { useReducer, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AgeBand, DepthLevel } from "@/lib/types";
import { AGE_BAND_LABELS } from "@/lib/types";
import { gameReducer, initialState, getCurrentCard } from "@/lib/game-reducer";
import { buildDeck } from "@/lib/deck";
import { CardDisplay } from "@/components/card-display";
import { DepthSelector } from "@/components/depth-selector";
import { WildBanner } from "@/components/wild-banner";
import { GameControls } from "@/components/game-controls";

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const band = (searchParams.get("band") || "6-8") as AgeBand;

  const [state, dispatch] = useReducer(gameReducer, initialState, () => ({
    ...initialState,
    phase: "playing" as const,
    ageBand: band,
    deck: buildDeck(band),
  }));

  const currentCard = getCurrentCard(state);

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

  const handleRestart = useCallback(() => {
    dispatch({ type: "START_GAME", ageBand: band });
  }, [band]);

  const handleNewBand = useCallback(() => {
    router.push("/reservoir/deep-deck");
  }, [router]);

  // ── End screen ──
  if (state.phase === "ended") {
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
        </span>
      </header>

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
