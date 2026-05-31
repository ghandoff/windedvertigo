/**
 * RingGauge — SVG ring gauge showing a ratio against a benchmark target.
 *
 * Uses stroke-dasharray + stroke-dashoffset to fill an arc proportionally.
 * A tick mark at the target position shows the benchmark zone boundary.
 * No charting library — pure SVG + Tailwind tokens.
 *
 * Usage:
 *   <RingGauge value={0.15} target={0.20} label="DAM / MAM" />
 */

const R  = 36;   // ring radius
const CX = 50;   // centre x
const CY = 50;   // centre y
const CIRC = 2 * Math.PI * R;  // full circumference

interface RingGaugeProps {
  /** Current ratio (0–1). */
  value: number;
  /** Benchmark target (0–1). */
  target: number;
  /** Short label shown below the gauge. */
  label: string;
  /** Absolute count shown in the centre (e.g. "47"). */
  count?: number;
}

function polarToXY(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

export function RingGauge({ value, target, label, count }: RingGaugeProps) {
  const pct      = Math.min(1, Math.max(0, value));
  const fillDash = pct * CIRC;
  const gap      = CIRC - fillDash;

  // Target tick angle (0° = top)
  const tickAngle    = target * 360;
  const tickOuter    = polarToXY(tickAngle, R + 6);
  const tickInner    = polarToXY(tickAngle, R - 6);

  // Colour: green if at/above target, amber if within 5pp, red if >5pp below
  const diff = pct - target;
  const arcColour =
    diff >= 0          ? "stroke-green-500"
    : diff >= -0.05    ? "stroke-amber-400"
    :                    "stroke-red-500";

  const pctLabel = `${Math.round(pct * 100)}%`;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 100 100"
        className="w-28 h-28"
        aria-label={`${label}: ${pctLabel} (target ${Math.round(target * 100)}%)`}
        role="img"
      >
        {/* Track (full circle) */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          strokeWidth={10}
          className="stroke-muted"
          strokeLinecap="round"
        />

        {/* Filled arc */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          strokeWidth={10}
          className={arcColour}
          strokeLinecap="round"
          strokeDasharray={`${fillDash} ${gap}`}
          transform={`rotate(-90 ${CX} ${CY})`}
        />

        {/* Target tick */}
        <line
          x1={tickInner.x} y1={tickInner.y}
          x2={tickOuter.x} y2={tickOuter.y}
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          strokeDasharray="2 1"
        />

        {/* Centre: percentage */}
        <text
          x={CX} y={CY - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground text-base font-semibold"
          fontSize={16}
        >
          {pctLabel}
        </text>
        {/* Centre: count */}
        {count !== undefined && (
          <text
            x={CX} y={CY + 13}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize={9}
          >
            {count.toLocaleString()} users
          </text>
        )}
      </svg>

      <p className="text-xs text-muted-foreground text-center leading-tight">
        {label}
        <br />
        <span className="text-[10px]">target {Math.round(target * 100)}%</span>
      </p>
    </div>
  );
}
