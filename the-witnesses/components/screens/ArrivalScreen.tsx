'use client';

interface Props {
  onNext: () => void;
}

export default function ArrivalScreen({ onNext }: Props) {
  return (
    <div className="relative min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center overflow-hidden">
      {/* Drifting clouds */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="cloud-drift absolute top-[15%] text-white/10 text-6xl" style={{ left: '-10%', animationDuration: '40s' }}>
          ☁
        </div>
        <div className="cloud-drift absolute top-[30%] text-white/5 text-4xl" style={{ left: '-20%', animationDuration: '55s', animationDelay: '10s' }}>
          ☁
        </div>
        <div className="cloud-drift absolute top-[10%] text-white/8 text-5xl" style={{ left: '-30%', animationDuration: '70s', animationDelay: '20s' }}>
          ☁
        </div>
      </div>

      {/* Title */}
      <div className="text-center animate-fade-in z-10">
        <h1 className="text-5xl md:text-7xl font-serif text-white/90 tracking-widest mb-4">
          the witnesses
        </h1>
        <p className="text-white/40 font-mono text-sm tracking-wider">
          a small game from winded.vertigo
        </p>
      </div>

      <button
        onClick={onNext}
        className="mt-16 px-6 py-3 border border-white/20 text-white/60 font-mono text-sm hover:border-white/60 hover:text-white transition-all duration-300 z-10"
      >
        Open the letter →
      </button>

      <style>{`
        @keyframes cloudDrift {
          from { transform: translateX(0); }
          to { transform: translateX(130vw); }
        }
        .cloud-drift {
          animation: cloudDrift linear infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 1.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
