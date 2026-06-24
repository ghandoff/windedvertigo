'use client';

import { useState, useEffect } from 'react';
import type { GameSession, CharacterKey, Visit } from '@/lib/session';
import { CHARACTERS } from '@/lib/characters';
import WorldCanvas from '@/components/WorldCanvas';
import VisitorCard from '@/components/VisitorCard';

interface Props {
  session: GameSession;
  currentVisitIndex: number;
  onVisitComplete: (visit: Visit) => void;
  isImageLoading?: boolean;
}

export default function VisitScreen({ session, currentVisitIndex, onVisitComplete, isImageLoading }: Props) {
  const [playerWord, setPlayerWord] = useState<string | undefined>(undefined);
  const characterKey: CharacterKey = session.visitOrder[currentVisitIndex];
  const character = CHARACTERS[characterKey];
  const currentImage = session.visits.at(-1)?.imageUrl ?? session.seedImageUrl;

  const arrivalLineIndex = currentVisitIndex % 3; // deterministic per visit

  useEffect(() => {
    // Extract word from seed phrase for characters that need [PLAYER_WORD]
    if (characterKey === 'explorer' || characterKey === 'trickster') {
      fetch('/api/extract-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: session.seedPhrase }),
      })
        .then((r) => r.json())
        .then((d) => setPlayerWord(d.word ?? 'thing'))
        .catch(() => setPlayerWord('thing'));
    }
  }, [characterKey, session.seedPhrase]);

  const handleComplete = (data: {
    playerText: string;
    secondText?: string;
    feltSense: string;
    objectChoice?: 'lamp' | 'blanket' | 'mug';
    erasedElement?: string;
  }) => {
    const visit: Visit = {
      character: characterKey,
      arrivalLineIndex,
      playerText: data.playerText,
      secondText: data.secondText,
      feltSense: data.feltSense,
      objectChoice: data.objectChoice,
      erasedElement: data.erasedElement,
    };
    onVisitComplete(visit);
  };

  const visitNumber = currentVisitIndex + 1;
  const totalVisits = session.visitOrder.length;

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center py-8 px-4 gap-8">
      {/* Progress */}
      <div className="w-full max-w-2xl flex items-center gap-2">
        <span className="text-xs text-white/30 font-mono">
          visitor {visitNumber} of {totalVisits}
        </span>
        <div className="flex-1 h-px bg-white/10">
          <div
            className="h-full bg-white/30 transition-all duration-500"
            style={{ width: `${(visitNumber / totalVisits) * 100}%` }}
          />
        </div>
      </div>

      {/* World canvas */}
      <WorldCanvas
        imageUrl={currentImage}
        isLoading={isImageLoading}
        showGhostOverlay={characterKey === 'ghost' && !currentImage}
      />

      {/* Visitor card */}
      <VisitorCard
        key={`${characterKey}-${currentVisitIndex}`}
        character={character}
        arrivalLineIndex={arrivalLineIndex}
        playerWord={playerWord}
        seedPhrase={session.seedPhrase}
        onComplete={handleComplete}
      />
    </div>
  );
}
