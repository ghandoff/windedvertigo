'use client';

/* ────────────────────────────────────────────────────────────────
   StalenessBar — visual data freshness indicator
   ──────────────────────────────────────────────────────────────── */

export interface StalenessBarProps {
  dataAsOf: string;       // ISO 8601 timestamp
  className?: string;
}

type Freshness = 'fresh' | 'recent' | 'aging' | 'stale' | 'very-stale';

function classify(hours: number): Freshness {
  if (hours < 4) return 'fresh';
  if (hours < 24) return 'recent';
  if (hours < 72) return 'aging';
  if (hours < 168) return 'stale';
  return 'very-stale';
}

function formatRelative(hours: number, freshness: Freshness): string {
  if (freshness === 'fresh') {
    if (hours < 1 / 60) return 'live';
    if (hours < 1) return `${Math.round(hours * 60)}m ago`;
    return `${Math.round(hours)}h ago`;
  }
  if (freshness === 'recent') return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  if (freshness === 'aging') return `${days}d ago`;
  if (freshness === 'stale') return `data may be outdated — ${days}d ago`;
  return `data is ${days}d old — refresh needed`;
}

const dotColor: Record<Freshness, string> = {
  'fresh':      'bg-emerald-400',
  'recent':     'bg-emerald-400',
  'aging':      'bg-amber-400',
  'stale':      'bg-amber-400',
  'very-stale': 'bg-red-400',
};

const textColor: Record<Freshness, string> = {
  'fresh':      'text-ops-text-muted',
  'recent':     'text-ops-text-muted',
  'aging':      'text-amber-400',
  'stale':      'text-amber-400',
  'very-stale': 'text-red-400',
};

const barBg: Record<Freshness, string> = {
  'fresh':      '',
  'recent':     '',
  'aging':      '',
  'stale':      'bg-amber-500/[0.04]',
  'very-stale': 'bg-red-500/[0.04]',
};

export function StalenessBar({ dataAsOf, className = '' }: StalenessBarProps) {
  const now = new Date();
  const asOf = new Date(dataAsOf);
  const hours = Math.max(0, (now.getTime() - asOf.getTime()) / (1000 * 60 * 60));
  const freshness = classify(hours);
  const label = formatRelative(hours, freshness);
  const isFresh = freshness === 'fresh';

  return (
    <div
      className={`w-full h-8 flex items-center justify-between px-5 border-t border-ops-border/40 ${barBg[freshness]} ${className}`}
    >
      {/* left: dot + relative time */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[freshness]}`}
          style={isFresh ? {
            animation: 'pulse-dot 2s ease-in-out infinite',
          } : undefined}
        />
        <span
          className={`text-[10px] leading-none ${textColor[freshness]}`}
          role="status"
          aria-live="polite"
        >
          {label}
        </span>
      </div>

      {/* right: copyright */}
      <span className="text-[10px] leading-none text-ops-text-muted">
        &copy; 2026 winded.vertigo llc
      </span>

      {/* pulse keyframe — injected once via inline style tag */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
