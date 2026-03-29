'use client';

/* ────────────────────────────────────────────────────────────────
   StatusBadge — semantic, accessible status indicators
   ──────────────────────────────────────────────────────────────── */

export interface StatusBadgeProps {
  status: 'on-track' | 'at-risk' | 'blocked' | 'complete' | 'pending' | 'info';
  label?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

/* ── Status config ─────────────────────────────────────────────── */

interface StatusConfig {
  color: string;       // tailwind color token (without prefix)
  bgClass: string;     // background at 10% opacity
  borderClass: string; // border at 20% opacity
  textClass: string;   // text color
  label: string;       // default display label
  icon: (size: number) => React.ReactNode;
}

const STATUS_MAP: Record<StatusBadgeProps['status'], StatusConfig> = {
  'on-track': {
    color: 'emerald-400',
    bgClass: 'bg-emerald-400/10',
    borderClass: 'border-emerald-400/20',
    textClass: 'text-emerald-400',
    label: 'on track',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="currentColor" />
      </svg>
    ),
  },
  'at-risk': {
    color: 'amber-400',
    bgClass: 'bg-amber-400/10',
    borderClass: 'border-amber-400/20',
    textClass: 'text-amber-400',
    label: 'at risk',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden="true">
        <polygon points="6,1 11,11 1,11" fill="currentColor" />
      </svg>
    ),
  },
  blocked: {
    color: 'red-400',
    bgClass: 'bg-red-400/10',
    borderClass: 'border-red-400/20',
    textClass: 'text-red-400',
    label: 'blocked',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M3 3L9 9M9 3L3 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  complete: {
    color: 'emerald-400',
    bgClass: 'bg-emerald-400/10',
    borderClass: 'border-emerald-400/20',
    textClass: 'text-emerald-400',
    label: 'complete',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 6.5L5 9L9.5 3.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
  pending: {
    color: 'ops-text-muted',
    bgClass: 'bg-white/5',
    borderClass: 'border-white/10',
    textClass: 'text-ops-text-muted',
    label: 'pending',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden="true">
        <circle
          cx="6"
          cy="6"
          r="4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    ),
  },
  info: {
    color: 'blue-400',
    bgClass: 'bg-blue-400/10',
    borderClass: 'border-blue-400/20',
    textClass: 'text-blue-400',
    label: 'info',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="currentColor" />
      </svg>
    ),
  },
};

/* ── Component ─────────────────────────────────────────────────── */

export function StatusBadge({
  status,
  label,
  size = 'md',
  showLabel,
  showIcon = true,
  className = '',
}: StatusBadgeProps) {
  const config = STATUS_MAP[status];
  const displayLabel = label ?? config.label;

  // Default showLabel: true for md, false for sm
  const shouldShowLabel = showLabel ?? (size === 'md');

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center ${config.textClass} ${className}`}
        aria-label={displayLabel}
        role="status"
      >
        {showIcon && config.icon(8)}
        {shouldShowLabel && (
          <span className="ml-1 text-[10px] uppercase tracking-wide">
            {displayLabel}
          </span>
        )}
      </span>
    );
  }

  // size === 'md' (badge / pill)
  return (
    <span
      className={[
        'inline-flex items-center gap-1',
        'rounded-full border px-2 py-0.5',
        'text-[10px] uppercase tracking-wide',
        config.bgClass,
        config.borderClass,
        config.textClass,
        className,
      ].join(' ')}
      aria-label={displayLabel}
      role="status"
    >
      {showIcon && config.icon(12)}
      {shouldShowLabel && <span>{displayLabel}</span>}
    </span>
  );
}

/* ── Helpers ───────────────────────────────────────────────────── */

export function projectStatusToBadge(
  status: 'green' | 'yellow' | 'red',
): StatusBadgeProps['status'] {
  return status === 'green'
    ? 'on-track'
    : status === 'yellow'
      ? 'at-risk'
      : 'blocked';
}
