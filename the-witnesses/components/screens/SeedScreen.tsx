'use client';

import { useState } from 'react';

interface Props {
  recipientName?: string;
  onSubmit: (seedPhrase: string) => void;
  isLoading?: boolean;
}

const HINTS = [
  "a community library that stays open all night",
  "a free public bookcart",
  "a repair café where neighbors fix each other's things",
];

export default function SeedScreen({ onSubmit, isLoading }: Props) {
  const [text, setText] = useState('');
  const [showHints, setShowHints] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 3) return;
    onSubmit(text.trim());
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-10 space-y-4">
          <p className="font-serif text-xl text-white/80">
            Something awesome has just been launched into the world.
          </p>
          <p className="font-serif text-white/60">
            It's still warm from your hands.
          </p>
          <p className="font-serif text-white/70 italic">
            It plays. It makes room. It's alive.
          </p>
          <p className="font-serif text-sm text-white/50 leading-relaxed max-w-sm mx-auto">
            Six visitors are coming to meet it. They won't all agree with you,
            and they won't all agree with each other.
            <br /><br />
            That's the point.
          </p>
          <p className="font-serif text-white/70 mt-4">
            Tell us — what did you make?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-white/5 border border-white/20 text-white font-serif text-base p-4 rounded resize-none focus:outline-none focus:border-white/50 min-h-[100px]"
            placeholder="Describe what you made, found, or dreamed…"
            maxLength={300}
          />

          <div className="text-xs text-white/30 font-mono text-right">
            {text.length} chars {text.length < 60 ? '(try 60–140)' : ''}
          </div>

          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            className="text-xs text-white/30 font-mono hover:text-white/60 transition-colors"
          >
            {showHints ? 'hide hints ↑' : 'Stuck? Try one of these… ↓'}
          </button>

          {showHints && (
            <div className="space-y-2">
              {HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => { setText(hint); setShowHints(false); }}
                  className="block w-full text-left text-sm text-white/50 font-mono hover:text-white/80 transition-colors py-1 px-2 hover:bg-white/5 rounded"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={text.trim().length < 3 || isLoading}
              className="px-8 py-3 border border-white/30 text-white/70 font-mono text-sm hover:border-white hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isLoading ? 'planting…' : 'Plant it →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
