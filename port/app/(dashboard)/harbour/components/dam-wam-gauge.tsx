/**
 * ActivityGauge — SVG ring showing what fraction of registered users
 * were active in a given time window, compared to a healthy target.
 *
 * Plain-English everywhere: no "DAM/MAM/WAM" jargon on screen.
 * The info icon tooltip gives the full explanation on hover.
 */

import { HintIcon } from "./hint-icon";

const R    = 36;
const CX   = 50;
const CY   = 50;
const CIRC = 2 * Math.PI * R;

interface ActivityGaugeProps {
  /** The ratio to display (0–1). */
  value: number;
  /** Target benchmark (0–1). A tick mark is drawn at this position. */
  target: number;
  /** Short label shown below the gauge, e.g. "active today". */
  label: string;
  /** One-sentence tooltip explaining what this metric measures. */
  description: string;
  /** Absolute count shown in the gauge centre. */
  count?: number;
  /** Total (denominator) shown in the gauge centre. */
  total?: number;
}

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

export function ActivityGauge({
  value, target, label, description, count, total,
}: ActivityGaugeProps) {
  const pct      = Math.min(1, Math.max(0, value));
  const fillDash = pct * CIRC;
  const gap      = CIRC - fillDash;
  const tickAngle = target * 360;
  const tickOuter = polarToXY(tickAngle, R + 6);
  const tickInner = polarToXY(tickAngle, R - 6);

  const diff = pct - target;
  const arcColour = diff >= 0 ? "stroke-green-500" : diff >= -0.05 ? "stroke-amber-400" : "stroke-red-500";
  const pctLabel  = `${Math.round(pct * 100)}%`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox="0 0 100 100"
        className="w-28 h-28"
        aria-label={`${label}: ${pctLabel}`}
        role="img"
      >
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" strokeWidth={10} className="stroke-muted" strokeLinecap="round" />
        {/* Arc */}
        <circle
          cx={CX} cy={CY} r={R} fill="none" strokeWidth={10}
          className={arcColour} strokeLinecap="round"
          strokeDasharray={`${fillDash} ${gap}`}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
        {/* Target tick */}
        <line
          x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y}
          className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="2 1"
        />
        {/* Percentage */}
        <text x={CX} y={count !== undefined ? CY - 5 : CY} textAnchor="middle"
          dominantBaseline="middle" className="fill-foreground font-semibold" fontSize={16}>
          {pctLabel}
        </text>
        {/* Raw count / total */}
        {count !== undefined && total !== undefined && (
          <text x={CX} y={CY + 11} textAnchor="middle" dominantBaseline="middle"
            className="fill-muted-foreground" fontSize={8}>
            {count.toLocaleString()} of {total.toLocaleString()}
          </text>
        )}
      </svg>

      {/* Label + hint */}
      <div className="flex items-center gap-1 text-center">
        <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
        <HintIcon text={description} />
      </div>
      <p className="text-[10px] text-muted-foreground">aim for {Math.round(target * 100)}%+</p>
    </div>
  );
}
