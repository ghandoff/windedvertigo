'use client';

import { useState, useEffect, useRef } from 'react';
import type { CharacterData } from '@/lib/characters';
import { EXPLORER_OBJECTS, interpolate } from '@/lib/characters';
import FeltSensePicker from './FeltSensePicker';
import GhostEraser from './GhostEraser';

interface Props {
  character: CharacterData;
  arrivalLineIndex: number;
  playerWord?: string;
  seedPhrase?: string;
  onComplete: (data: {
    playerText: string;
    secondText?: string;
    feltSense: string;
    objectChoice?: 'lamp' | 'blanket' | 'mug';
    erasedElement?: string;
  }) => void;
}

type Phase = 'arriving' | 'prompting' | 'player-input' | 'felt-sense' | 'follow-up' | 'exit';

function useTypewriter(text: string, active: boolean, speed = 25): string {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplayed(''); setDone(false); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 1000 / 40); // 40 chars/sec
    return () => clearInterval(interval);
  }, [text, active]);

  return displayed;
}

export default function VisitorCard({ character, arrivalLineIndex, playerWord, seedPhrase, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('arriving');
  const [playerText, setPlayerText] = useState('');
  const [secondText, setSecondText] = useState('');
  const [selectedFelt, setSelectedFelt] = useState<{ label: string; followUp: string } | null>(null);
  const [objectChoice, setObjectChoice] = useState<'lamp' | 'blanket' | 'mug' | null>(null);
  const [erasedElement, setErasedElement] = useState<string | null>(null);
  const [arrivalDone, setArrivalDone] = useState(false);
  const [promptDone, setPromptDone] = useState(false);
  const [followUpDone, setFollowUpDone] = useState(false);
  const [exitDone, setExitDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const arrivalLine = character.arrivalLines[arrivalLineIndex];
  const rawPrompt = character.mainPrompt;
  const mainPrompt = interpolate(rawPrompt, {
    PLAYER_WORD: playerWord,
    SEED: seedPhrase,
  });

  const displayedArrival = useTypewriter(arrivalLine, phase === 'arriving');
  const displayedPrompt = useTypewriter(mainPrompt, phase === 'prompting');
  const displayedFollowUp = useTypewriter(selectedFelt?.followUp ?? '', phase === 'follow-up');
  const exitLineRaw = interpolate(character.exitLine, {
    OBJECT: objectChoice ?? undefined,
    ELEMENT: erasedElement ?? undefined,
  });
  const displayedExit = useTypewriter(exitLineRaw, phase === 'exit');

  // Advance phases
  useEffect(() => {
    if (phase === 'arriving' && displayedArrival === arrivalLine && arrivalLine.length > 0) {
      setArrivalDone(true);
      setTimeout(() => setPhase('prompting'), 600);
    }
  }, [displayedArrival, arrivalLine, phase]);

  useEffect(() => {
    if (phase === 'prompting' && displayedPrompt === mainPrompt && mainPrompt.length > 0) {
      setPromptDone(true);
      setTimeout(() => {
        setPhase('player-input');
        setTimeout(() => textareaRef.current?.focus(), 100);
      }, 400);
    }
  }, [displayedPrompt, mainPrompt, phase]);

  useEffect(() => {
    if (phase === 'follow-up' && displayedFollowUp === selectedFelt?.followUp && (selectedFelt?.followUp.length ?? 0) > 0) {
      setFollowUpDone(true);
      setTimeout(() => setPhase('exit'), 800);
    }
  }, [displayedFollowUp, selectedFelt, phase]);

  useEffect(() => {
    if (phase === 'exit' && displayedExit === exitLineRaw && exitLineRaw.length > 0) {
      setExitDone(true);
    }
  }, [displayedExit, exitLineRaw, phase]);

  const handleSubmitPlayerText = () => {
    if (!playerText.trim()) return;
    setPhase('felt-sense');
  };

  const handleFeltSense = (opt: { label: string; followUp: string }) => {
    setSelectedFelt(opt);
    setPhase('follow-up');
  };

  const handleContinue = () => {
    if (!exitDone) return;
    onComplete({
      playerText,
      secondText: character.key === 'ripple' ? secondText : undefined,
      feltSense: selectedFelt?.label ?? '',
      objectChoice: objectChoice ?? undefined,
      erasedElement: erasedElement ?? undefined,
    });
  };

  const accentStyle = { borderColor: character.accentColor };
  const accentTextStyle = { color: character.accentColor };

  const isTimeTraveler = character.key === 'timeTraveler';
  const isRipple = character.key === 'ripple';
  const isGhost = character.key === 'ghost';
  const isExplorer = character.key === 'explorer';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className="bg-[#0a0a1a] border-l-4 p-6 rounded-r"
        style={accentStyle}
      >
        {/* Character name */}
        <div className="text-xs font-mono uppercase tracking-widest mb-4 opacity-60" style={accentTextStyle}>
          {character.name}
        </div>

        {/* Arrival line */}
        {(phase === 'arriving' || arrivalDone) && (
          <p className="italic text-white/60 text-sm mb-4 font-serif whitespace-pre-wrap min-h-[2rem]">
            {displayedArrival}
          </p>
        )}

        {/* Main prompt */}
        {(phase === 'prompting' || promptDone) && (
          <p className="text-white font-mono text-sm mb-4 whitespace-pre-wrap min-h-[2rem]">
            {displayedPrompt}
          </p>
        )}

        {/* Player input area */}
        {phase === 'player-input' && (
          <div className="space-y-3">
            {isRipple ? (
              <>
                <div>
                  <label className="block text-xs text-white/50 font-mono mb-1">Some of us…</label>
                  <textarea
                    ref={textareaRef}
                    value={playerText}
                    onChange={(e) => setPlayerText(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 text-white font-mono text-sm p-3 rounded resize-none focus:outline-none focus:border-white/50"
                    rows={3}
                    placeholder="what some of us needed…"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 font-mono mb-1">Others…</label>
                  <textarea
                    value={secondText}
                    onChange={(e) => setSecondText(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 text-white font-mono text-sm p-3 rounded resize-none focus:outline-none focus:border-white/50"
                    rows={3}
                    placeholder="what others needed…"
                  />
                </div>
              </>
            ) : isTimeTraveler ? (
              <div className="flex items-start gap-2">
                <span className="text-white/60 font-mono text-sm pt-3 whitespace-nowrap">By 2036, it had…</span>
                <textarea
                  ref={textareaRef}
                  value={playerText}
                  onChange={(e) => setPlayerText(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/20 text-white font-mono text-sm p-3 rounded resize-none focus:outline-none focus:border-white/50"
                  rows={3}
                  placeholder="…completed the sentence"
                />
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={playerText}
                onChange={(e) => setPlayerText(e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white font-mono text-sm p-3 rounded resize-none focus:outline-none focus:border-white/50"
                rows={4}
                placeholder={isGhost ? "what you took away to make space…" : ""}
              />
            )}

            {isExplorer && (
              <div className="flex gap-2 mt-2">
                {EXPLORER_OBJECTS.map((obj) => (
                  <button
                    key={obj}
                    onClick={() => setObjectChoice(obj)}
                    className={`px-3 py-1.5 border font-mono text-xs rounded transition-all ${
                      objectChoice === obj
                        ? 'border-white bg-white text-black'
                        : 'border-white/30 text-white/70 hover:border-white/60'
                    }`}
                  >
                    a {obj}
                  </button>
                ))}
              </div>
            )}

            {isGhost && (
              <GhostEraser
                selectedElement={erasedElement}
                onSelect={setErasedElement}
              />
            )}

            <button
              onClick={handleSubmitPlayerText}
              disabled={!playerText.trim() || (isExplorer && !objectChoice) || (isGhost && !erasedElement)}
              className="mt-2 px-4 py-2 border border-white/30 text-white/70 font-mono text-sm hover:border-white hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded"
            >
              continue →
            </button>
          </div>
        )}

        {/* Felt sense picker */}
        {phase === 'felt-sense' && (
          <FeltSensePicker
            options={character.feltSenseOptions}
            onSelect={handleFeltSense}
          />
        )}

        {/* Follow-up */}
        {(phase === 'follow-up' || followUpDone) && phase !== 'player-input' && phase !== 'felt-sense' && (
          <p className="text-white/80 font-mono text-sm whitespace-pre-wrap mt-4 min-h-[2rem]">
            {displayedFollowUp}
          </p>
        )}

        {/* Exit line */}
        {(phase === 'exit') && (
          <p className="italic text-white/40 text-sm mt-4 font-serif whitespace-pre-wrap min-h-[2rem]">
            {displayedExit}
          </p>
        )}

        {/* Continue button after exit */}
        {exitDone && (
          <button
            onClick={handleContinue}
            className="mt-6 px-6 py-2 border border-white/30 text-white/70 font-mono text-sm hover:border-white hover:text-white transition-all rounded"
          >
            next →
          </button>
        )}
      </div>
    </div>
  );
}
