'use client';

interface Props {
  recipientName?: string;
  onNext: () => void;
}

export default function LetterScreen({ recipientName, onNext }: Props) {
  const name = recipientName || 'friend';

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div
          className="p-8 md:p-12 rounded shadow-2xl"
          style={{ background: '#f5f0e0', color: '#2E1A14' }}
        >
          <p className="font-serif text-lg mb-6">Dear {name},</p>
          <div className="font-serif text-sm leading-relaxed space-y-4 text-[#3a2a1a]">
            <p>
              We're winded.vertigo — a learning design collective stoked on creating experiences,
              tools, and research that reveal moments when everything feels connected.
            </p>
            <p>
              We wanted to play a small game with you. Picture something new that's just arrived
              in your world. Maybe you made it. Maybe it found you. Maybe you're still dreaming it up.
            </p>
            <p className="italic">
              It plays. It makes room. It's alive.
            </p>
            <p>
              Six visitors are coming to meet it. We're hoping you'll show us back what they said.
            </p>
            <p>
              No pressure. No grade. Stop anytime.
            </p>
          </div>
          <p className="font-serif text-sm mt-8 text-[#3a2a1a]">— w.v.</p>
        </div>

        <div className="flex justify-center mt-8">
          <button
            onClick={onNext}
            className="px-6 py-3 border border-white/20 text-white/60 font-mono text-sm hover:border-white/60 hover:text-white transition-all duration-300"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
