"use client";

interface GameControlsProps {
  onNext: () => void;
  onShuffle: () => void;
  onEnd: () => void;
  cardsPlayed: number;
  totalCards: number;
}

export function GameControls({
  onNext,
  onShuffle,
  onEnd,
  cardsPlayed,
  totalCards,
}: GameControlsProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Progress */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-xs text-[var(--dd-cadet)]/50 mb-1">
          <span>Card {cardsPlayed + 1}</span>
          <span>{totalCards} total</span>
        </div>
        <div className="h-1.5 bg-[var(--dd-cadet)]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--dd-redwood)] rounded-full transition-all duration-300"
            style={{ width: `${((cardsPlayed + 1) / totalCards) * 100}%` }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onShuffle}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[var(--dd-cadet)]/10 text-[var(--dd-cadet)] hover:bg-[var(--dd-cadet)]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dd-redwood)]"
        >
          Shuffle
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[var(--dd-cadet)] text-white hover:bg-[var(--dd-cadet)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dd-redwood)]"
        >
          Next Card
        </button>
        <button
          onClick={onEnd}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[var(--dd-redwood)]/10 text-[var(--dd-redwood)] hover:bg-[var(--dd-redwood)]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dd-redwood)]"
        >
          End
        </button>
      </div>
    </div>
  );
}
