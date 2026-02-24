"use client";

/**
 * Quote capture component for evidence.
 *
 * Captures things children said during a playdate, with optional
 * attribution ("Mia, age 6").
 *
 * Phase B — evidence capture (practitioner tier).
 */

import { useState } from "react";

export interface QuoteItem {
  localId: string;
  text: string;
  attribution: string;
}

let nextQuoteId = 0;
function genQuoteId() {
  return `quote-${Date.now()}-${nextQuoteId++}`;
}

export default function EvidenceQuote({
  quotes,
  onChange,
}: {
  quotes: QuoteItem[];
  onChange: (quotes: QuoteItem[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newAttribution, setNewAttribution] = useState("");

  function addQuote() {
    if (!newText.trim()) return;
    const quote: QuoteItem = {
      localId: genQuoteId(),
      text: newText.trim(),
      attribution: newAttribution.trim(),
    };
    onChange([...quotes, quote]);
    setNewText("");
    setNewAttribution("");
    setIsAdding(false);
  }

  function removeQuote(localId: string) {
    onChange(quotes.filter((q) => q.localId !== localId));
  }

  return (
    <div className="space-y-3">
      <label className="text-xs text-cadet/60 font-medium block">
        quotes
      </label>

      {/* existing quotes */}
      {quotes.map((q) => (
        <div
          key={q.localId}
          className="rounded-lg border border-cadet/10 bg-white px-4 py-3 relative group"
        >
          <p className="text-sm italic text-cadet/80">
            &ldquo;{q.text}&rdquo;
          </p>
          {q.attribution && (
            <p className="text-xs text-cadet/50 mt-1">
              — {q.attribution}
            </p>
          )}
          <button
            type="button"
            onClick={() => removeQuote(q.localId)}
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cadet/5 text-cadet/40
                       flex items-center justify-center text-xs opacity-0 group-hover:opacity-100
                       transition-opacity hover:bg-cadet/10 hover:text-redwood"
            aria-label="remove quote"
          >
            ×
          </button>
        </div>
      ))}

      {/* add form */}
      {isAdding ? (
        <div className="rounded-lg border border-sienna/20 bg-white p-4 space-y-3">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="what did they say?"
            rows={2}
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 resize-y"
            autoFocus
          />
          <input
            type="text"
            value={newAttribution}
            onChange={(e) => setNewAttribution(e.target.value)}
            placeholder="who said it? (e.g. mia, age 6)"
            className="w-full rounded-lg border border-cadet/15 px-3 py-1.5 text-xs outline-none focus:ring-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addQuote}
              disabled={!newText.trim()}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--wv-sienna)" }}
            >
              add quote
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewText("");
                setNewAttribution("");
              }}
              className="text-xs px-3 py-1.5 rounded-lg text-cadet/60 hover:text-cadet"
            >
              cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="text-xs px-3 py-2 rounded-lg border border-dashed border-cadet/15 text-cadet/50
                     hover:border-sienna/30 hover:text-sienna transition-all w-full text-left"
        >
          + add a quote
        </button>
      )}
    </div>
  );
}
