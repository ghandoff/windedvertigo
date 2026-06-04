'use client';

import { useState } from 'react';
import type { GameSession } from '@/lib/session';
import { CHARACTERS } from '@/lib/characters';

interface Props {
  session: GameSession;
}

export default function PostcardScreen({ session }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lastImageUrl = session.visits.at(-1)?.imageUrl;

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Postcard */}
        <div
          className="rounded-lg shadow-2xl overflow-hidden"
          style={{ background: '#f5f0e0', color: '#2E1A14' }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-4 border-b border-[#C8624E]/20">
            <p className="font-serif italic text-lg text-[#8A3828] mb-1">
              "{session.seedPhrase}"
            </p>
            {session.seedName && (
              <p className="font-mono text-3xl font-bold text-[#2E1A14] mt-2">
                {session.seedName}
              </p>
            )}
          </div>

          {/* Seed image */}
          {(session.seedImageUrl || lastImageUrl) && (
            <div className="w-full">
              <img
                src={session.seedImageUrl ?? lastImageUrl}
                alt="The world"
                className="w-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          )}

          {/* Visit panels */}
          <div className="px-8 py-6 space-y-4">
            {session.visits.map((visit, i) => {
              const char = CHARACTERS[visit.character];
              return (
                <div
                  key={i}
                  className="border-l-2 pl-4 py-1"
                  style={{ borderColor: char.accentColor }}
                >
                  <div className="text-xs font-mono uppercase tracking-widest text-[#8A3828] mb-1">
                    {char.name}
                  </div>
                  <p className="font-serif text-sm text-[#3a2a1a] leading-relaxed">
                    {visit.playerText}
                    {visit.secondText && (
                      <span className="block mt-1 text-[#8A3828]">
                        / {visit.secondText}
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-[#8A3828]/60 mt-1 italic">
                    — {visit.feltSense}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Final evolved image */}
          {lastImageUrl && lastImageUrl !== session.seedImageUrl && (
            <div className="w-full border-t border-[#C8624E]/20">
              <img
                src={lastImageUrl}
                alt="The evolved world"
                className="w-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          )}

          {/* Closing text */}
          <div className="px-8 py-8 border-t border-[#C8624E]/20">
            <div className="font-serif text-sm text-[#3a2a1a] leading-relaxed space-y-2">
              <p>It moved when you spoke.</p>
              <p>It made room for who wasn't there.</p>
              <p>It survived being inverted.</p>
              <p className="italic">That's how we know it's alive.</p>
            </div>
            <p className="font-serif text-xs text-[#8A3828]/60 mt-6">
              — sent into the world by w.v., who care about moments when everything feels connected.
            </p>
          </div>
        </div>

        {/* Copy link button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={handleCopyLink}
            className="px-6 py-3 border border-white/20 text-white/60 font-mono text-sm hover:border-white/60 hover:text-white transition-all duration-300"
          >
            {copied ? 'link copied ✓' : 'Copy link →'}
          </button>
        </div>
      </div>
    </div>
  );
}
