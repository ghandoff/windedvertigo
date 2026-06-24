'use client';

import { GHOST_ERASABLE_ELEMENTS } from '@/lib/characters';

interface Props {
  selectedElement: string | null;
  onSelect: (element: string) => void;
}

export default function GhostEraser({ selectedElement, onSelect }: Props) {
  return (
    <div className="mt-4">
      <p className="text-xs text-white/50 font-mono uppercase tracking-widest mb-3">
        tap something to erase from the scene:
      </p>
      <div className="flex flex-wrap gap-2">
        {GHOST_ERASABLE_ELEMENTS.map((el) => (
          <button
            key={el.key}
            onClick={() => onSelect(el.key)}
            className={`px-3 py-1.5 border font-mono text-sm transition-all duration-200 rounded ${
              selectedElement === el.key
                ? 'border-white bg-white text-black'
                : 'border-white/30 text-white/70 hover:border-white/60 hover:text-white'
            }`}
          >
            {el.label}
          </button>
        ))}
      </div>
    </div>
  );
}
