"use client";

import { useState, useCallback } from "react";

interface Card {
  id: string;
  text: string;
  type: "premise" | "conclusion";
}

const AXIOMS: Card[] = [
  { id: "a1", text: "all humans are mortal", type: "premise" },
  { id: "a2", text: "socrates is human", type: "premise" },
];

const CONCLUSION: Card = {
  id: "c1",
  text: "socrates is mortal",
  type: "conclusion",
};

export default function ProofBuilder() {
  const [slot1, setSlot1] = useState<Card | null>(null);
  const [slot2, setSlot2] = useState<Card | null>(null);
  const [derived, setDerived] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);

  const availableCards = AXIOMS.filter(
    (a) => a.id !== slot1?.id && a.id !== slot2?.id
  );

  const handleCardClick = useCallback(
    (card: Card) => {
      setSelected(card);
    },
    []
  );

  const handleSlotClick = useCallback(
    (slotNum: 1 | 2) => {
      if (derived) return;
      if (selected) {
        if (slotNum === 1) {
          if (slot1) return; // slot occupied
          setSlot1(selected);
        } else {
          if (slot2) return;
          setSlot2(selected);
        }
        setSelected(null);
      } else {
        // tap occupied slot to remove
        if (slotNum === 1 && slot1) setSlot1(null);
        if (slotNum === 2 && slot2) setSlot2(null);
      }
    },
    [selected, slot1, slot2, derived]
  );

  const applyRule = () => {
    if (!slot1 || !slot2) return;
    setDerived(true);
    setShowAnimation(true);
    setTimeout(() => setShowAnimation(false), 1000);
  };

  const reset = () => {
    setSlot1(null);
    setSlot2(null);
    setDerived(false);
    setSelected(null);
    setShowAnimation(false);
  };

  const cardStyle = (isSelected: boolean) => ({
    background: "rgba(255,255,255,0.05)",
    borderColor: isSelected ? "var(--wv-sienna)" : "rgba(255,255,255,0.1)",
    boxShadow: isSelected ? "0 0 8px var(--wv-sienna)" : "none",
  });

  const slotStyle = (filled: boolean) => ({
    background: filled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.15)",
    borderStyle: filled ? ("solid" as const) : ("dashed" as const),
  });

  return (
    <div>
      {/* available cards */}
      <div className="mb-6">
        <p className="text-xs text-[var(--color-text-on-dark-muted)] mb-2 uppercase tracking-wider">
          available axioms — tap to select, then tap a slot
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {availableCards.map((card) => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card)}
              className="flex-1 px-4 py-3 rounded-xl border text-sm text-left transition-all"
              style={cardStyle(selected?.id === card.id)}
            >
              {card.text}
            </button>
          ))}
          {availableCards.length === 0 && !derived && (
            <p className="text-xs text-[var(--color-text-on-dark-muted)] italic">
              both premises placed
            </p>
          )}
        </div>
      </div>

      {/* premise slots */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {([1, 2] as const).map((num) => {
          const slot = num === 1 ? slot1 : slot2;
          return (
            <button
              key={num}
              onClick={() => handleSlotClick(num)}
              className="flex-1 px-4 py-4 rounded-xl border text-sm text-center transition-all min-h-[56px]"
              style={slotStyle(!!slot)}
              aria-label={`premise slot ${num}${slot ? `: ${slot.text}` : " (empty)"}`}
            >
              {slot ? (
                <span>{slot.text}</span>
              ) : (
                <span className="text-[var(--color-text-on-dark-muted)] text-xs">
                  premise {num}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* arrow + apply */}
      <div className="flex flex-col items-center gap-3 mb-4">
        <div className="text-[var(--color-text-on-dark-muted)] text-2xl">↓</div>
        {!derived && (
          <button
            onClick={applyRule}
            disabled={!slot1 || !slot2}
            className="px-6 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-30"
            style={{
              background: "var(--wv-sienna)",
              color: "var(--wv-champagne)",
            }}
          >
            apply rule
          </button>
        )}
      </div>

      {/* conclusion slot */}
      <div
        className="rounded-xl border px-4 py-4 text-center text-sm transition-all min-h-[56px] flex items-center justify-center"
        style={{
          background: derived ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
          borderColor: derived ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.15)",
          borderStyle: derived ? "solid" : "dashed",
          boxShadow: showAnimation ? "0 0 20px rgba(74,222,128,0.4)" : "none",
          transform: showAnimation ? "scale(1.05)" : "scale(1)",
          transition: "all 0.5s ease",
        }}
      >
        {derived ? (
          <span className="font-semibold" style={{ color: "var(--wv-champagne)" }}>
            ∴ {CONCLUSION.text}
          </span>
        ) : (
          <span className="text-[var(--color-text-on-dark-muted)] text-xs">conclusion</span>
        )}
      </div>

      {/* explanation + reset */}
      {derived && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-[var(--color-text-on-dark-muted)] leading-relaxed">
            you just built a syllogism — the simplest form of deductive proof. in
            formal logic, this is called modus ponens.
          </p>
          <button
            onClick={reset}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            try again
          </button>
        </div>
      )}
    </div>
  );
}
