'use client';

import { useState, useEffect } from 'react';

interface Props {
  onNext: () => void;
}

const LINES = [
  "You don't have to be ready.",
  "You don't have to be right.",
  "You can stop after any visitor.",
];

export default function PermissionsScreen({ onNext }: Props) {
  const [visible, setVisible] = useState<boolean[]>([false, false, false]);

  useEffect(() => {
    LINES.forEach((_, i) => {
      setTimeout(() => {
        setVisible((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * 400);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {LINES.map((line, i) => (
          <p
            key={line}
            className="font-serif text-xl md:text-2xl text-white/80 transition-all duration-500"
            style={{
              opacity: visible[i] ? 1 : 0,
              transform: visible[i] ? 'translateY(0)' : 'translateY(6px)',
            }}
          >
            {line}
          </p>
        ))}
      </div>

      <button
        onClick={onNext}
        className="mt-16 px-6 py-3 border border-white/20 text-white/60 font-mono text-sm hover:border-white/60 hover:text-white transition-all duration-300"
        style={{ opacity: visible[2] ? 1 : 0, transition: 'opacity 0.5s 0.2s' }}
      >
        Begin →
      </button>
    </div>
  );
}
