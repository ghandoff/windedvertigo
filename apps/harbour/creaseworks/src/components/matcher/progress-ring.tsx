"use client";

/**
 * ProgressRing — SVG circle that fills to show progress.
 *
 * Used in the "find" phase to celebrate how much a kid has noticed.
 * Fills clockwise from the top. Color shifts warmly as progress grows.
 *
 * Used by: Timer Challenge (countdown), Scavenger Hunt (items found).
 */

export interface ProgressRingProps {
  /** 0–1, where 1 = fully complete */
  progress: number;
  /** pixel diameter of the ring */
  size?: number;
  /** ring stroke width */
  strokeWidth?: number;
  /** stroke color at rest (start) */
  color?: string;
  /** optional urgent color (used when progress > urgentThreshold) */
  urgentColor?: string;
  /** progress value at which urgent color kicks in (0–1, default 0.85) */
  urgentThreshold?: number;
  /** content rendered inside the ring (e.g., a number) */
  children?: React.ReactNode;
  /** accessible label for screen readers */
  label?: string;
  /** pulse animation when urgent (default true) */
  pulseWhenUrgent?: boolean;
}

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "var(--wv-sienna)",
  urgentColor = "var(--wv-redwood)",
  urgentThreshold = 0.85,
  children,
  label,
  pulseWhenUrgent = true,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const isUrgent = clamped >= urgentThreshold;
  const activeColor = isUrgent ? urgentColor : color;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  const pct = Math.round(clamped * 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${pct}% complete`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={isUrgent && pulseWhenUrgent ? "progress-ring-urgent" : ""}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(39, 50, 72, 0.06)"
          strokeWidth={strokeWidth}
        />

        {/* progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: `stroke-dashoffset 400ms ${SPRING}, stroke 300ms ease`,
          }}
        />
      </svg>

      {/* center content */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}

      <style>{`
        @keyframes ringUrgentPulse {
          0%, 100% { transform: rotate(-90deg) scale(1); }
          50%      { transform: rotate(-90deg) scale(1.03); }
        }
        .progress-ring-urgent {
          animation: ringUrgentPulse 1.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .progress-ring-urgent { animation: none; transform: rotate(-90deg); }
        }
      `}</style>
    </div>
  );
}
