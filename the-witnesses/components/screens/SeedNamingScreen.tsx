'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (seedName: string) => void;
  isLoading?: boolean;
}

export default function SeedNamingScreen({ onSubmit, isLoading }: Props) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = name.trim().split(/\s+/)[0];
    if (!word) return;
    onSubmit(word);
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <p className="font-serif text-2xl text-white/80 mb-10">
          Name your seed in one word.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/20 text-white font-serif text-xl text-center p-4 rounded focus:outline-none focus:border-white/50"
            placeholder="…"
            autoFocus
            maxLength={30}
          />

          <button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="px-8 py-3 border border-white/30 text-white/70 font-mono text-sm hover:border-white hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLoading ? 'saving…' : 'Done →'}
          </button>
        </form>
      </div>
    </div>
  );
}
