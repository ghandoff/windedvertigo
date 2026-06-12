/**
 * Tiny dependency-free SVG sparkline (the port has no chart library).
 * Renders a p95 trend; gaps (nulls) break the line.
 */

interface SparklineProps {
  values: Array<number | null>;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ values, width = 120, height = 28, className }: SparklineProps) {
  const nums = values.filter((v): v is number => v !== null && v > 0);
  if (nums.length < 2) {
    return <div className="text-[10px] text-muted-foreground">collecting…</div>;
  }
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null || v <= 0) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = (i * step).toFixed(1);
    const y = (height - 3 - ((v - min) / range) * (height - 6)).toFixed(1);
    current.push(`${x},${y}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      {segments.map((points, i) => (
        <polyline
          key={i}
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
