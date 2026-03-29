'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
}

export default function Sparkline({
  data,
  width = 64,
  height = 20,
  color = '#d4d4d8',
  showDot = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const last = points[points.length - 1];
  const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`;

  // Build the closed polygon path for the gradient fill
  const fillPath = [
    `M${points[0].x},${points[0].y}`,
    ...points.slice(1).map((p) => `L${p.x},${p.y}`),
    `L${last.x},${height}`,
    `L${points[0].x},${height}`,
    'Z',
  ].join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.1} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={fillPath} fill={`url(#${gradientId})`} />

      <polyline
        points={polyline}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {showDot && (
        <circle cx={last.x} cy={last.y} r={2} fill={color} />
      )}
    </svg>
  );
}
