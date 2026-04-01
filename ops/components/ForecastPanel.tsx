'use client';

import { useState, useMemo, useCallback } from 'react';

export interface ForecastPanelProps {
  cash: number;
  monthlyBurn: number;
  monthlyRevenue: number;
  burnHistory?: number[];
  revenueHistory?: number[];
}

const MONTHS = 12;
const COLORS = {
  base: '#d4d4d8',
  optimistic: '#34d399',
  conservative: '#fbbf24',
  zero: 'rgba(248,113,113,0.3)',
  grid: 'rgba(30,42,56,0.2)',
  card: '#111920',
  border: '#1e2a38',
  text: '#d4d4d8',
  muted: '#71717a',
};

function projectCash(
  cash: number,
  burn: number,
  revenue: number,
  months: number,
  burnGrowth: number,
  revenueGrowth: number
): number[] {
  const projections = [cash];
  let currentBurn = burn;
  let currentRevenue = revenue;
  for (let i = 1; i <= months; i++) {
    currentBurn *= 1 + burnGrowth;
    currentRevenue *= 1 + revenueGrowth;
    const next = projections[i - 1] - currentBurn + currentRevenue;
    projections.push(Math.max(next, 0));
  }
  return projections;
}

function getMonthLabels(): string[] {
  const now = new Date();
  const labels: string[] = [];
  for (let i = 0; i <= MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    labels.push(d.toLocaleString('en-US', { month: 'short' }));
  }
  return labels;
}

function findMilestone(
  projections: number[],
  monthLabels: string[]
): { label: string; color: string } {
  const zeroMonth = projections.findIndex((v, i) => i > 0 && v === 0);
  if (zeroMonth !== -1) {
    return { label: `Zero by ${monthLabels[zeroMonth]}`, color: '#f87171' };
  }
  return { label: 'Runway > 12 months', color: COLORS.optimistic };
}

function runwayMonths(projections: number[]): number {
  const idx = projections.findIndex((v, i) => i > 0 && v === 0);
  return idx === -1 ? MONTHS : idx;
}

function formatCash(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function MiniSparkline({
  data,
  color,
  width = 120,
  height = 40,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface TooltipData {
  x: number;
  y: number;
  month: string;
  base: number;
  optimistic: number;
  conservative: number;
}

export function ForecastPanel({
  cash,
  monthlyBurn,
  monthlyRevenue,
}: ForecastPanelProps) {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const monthLabels = useMemo(() => getMonthLabels(), []);

  const baseData = useMemo(
    () => projectCash(cash, monthlyBurn, monthlyRevenue, MONTHS, 0, 0),
    [cash, monthlyBurn, monthlyRevenue]
  );

  const optimisticData = useMemo(
    () => projectCash(cash, monthlyBurn, monthlyRevenue, MONTHS, 0, 0.2),
    [cash, monthlyBurn, monthlyRevenue]
  );

  const conservativeData = useMemo(
    () => projectCash(cash, monthlyBurn, monthlyRevenue, MONTHS, 0.1, 0),
    [cash, monthlyBurn, monthlyRevenue]
  );

  const baseMilestone = useMemo(
    () => findMilestone(baseData, monthLabels),
    [baseData, monthLabels]
  );
  const optimisticMilestone = useMemo(
    () => findMilestone(optimisticData, monthLabels),
    [optimisticData, monthLabels]
  );
  const conservativeMilestone = useMemo(
    () => findMilestone(conservativeData, monthLabels),
    [conservativeData, monthLabels]
  );

  // Combined chart dimensions
  const chartWidth = 600;
  const chartHeight = 120;
  const padX = 40;
  const padY = 10;
  const innerW = chartWidth - padX * 2;
  const innerH = chartHeight - padY * 2;

  const allValues = [...baseData, ...optimisticData, ...conservativeData];
  const maxVal = Math.max(...allValues, 1);

  const toPoint = useCallback(
    (i: number, v: number) => {
      const x = padX + (i / MONTHS) * innerW;
      const y = padY + innerH - (v / maxVal) * innerH;
      return { x, y };
    },
    [maxVal, innerW, innerH]
  );

  const buildPath = useCallback(
    (data: number[]) =>
      data
        .map((v, i) => {
          const { x, y } = toPoint(i, v);
          return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' '),
    [toPoint]
  );

  const zeroY = padY + innerH - (0 / maxVal) * innerH;

  const handleChartMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
      const relX = mouseX - padX;
      if (relX < 0 || relX > innerW) {
        setTooltip(null);
        return;
      }
      const idx = Math.round((relX / innerW) * MONTHS);
      const clampedIdx = Math.max(0, Math.min(MONTHS, idx));
      const pt = toPoint(clampedIdx, baseData[clampedIdx]);
      setTooltip({
        x: pt.x,
        y: 10,
        month: monthLabels[clampedIdx],
        base: baseData[clampedIdx],
        optimistic: optimisticData[clampedIdx],
        conservative: conservativeData[clampedIdx],
      });
    },
    [baseData, optimisticData, conservativeData, monthLabels, toPoint, innerW]
  );

  const handleChartLeave = useCallback(() => setTooltip(null), []);

  const scenarios = [
    {
      key: 'base',
      name: 'Base Case',
      color: COLORS.base,
      data: baseData,
      runway: runwayMonths(baseData),
      milestone: baseMilestone,
    },
    {
      key: 'optimistic',
      name: 'Optimistic',
      color: COLORS.optimistic,
      data: optimisticData,
      runway: runwayMonths(optimisticData),
      milestone: optimisticMilestone,
    },
    {
      key: 'conservative',
      name: 'Conservative',
      color: COLORS.conservative,
      data: conservativeData,
      runway: runwayMonths(conservativeData),
      milestone: conservativeMilestone,
    },
  ];

  const lineOpacity = (key: string) => {
    if (!activeScenario) return 1;
    return activeScenario === key ? 1 : 0.2;
  };

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 24,
      }}
    >
      {/* Section title */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
          color: COLORS.muted,
          marginBottom: 20,
        }}
      >
        FORECAST
      </div>

      {/* Three scenario columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {scenarios.map((s) => (
          <div
            key={s.key}
            onClick={() =>
              setActiveScenario(activeScenario === s.key ? null : s.key)
            }
            style={{
              cursor: 'pointer',
              padding: 16,
              borderRadius: 8,
              border: `1px solid ${
                activeScenario === s.key ? s.color : COLORS.border
              }`,
              background:
                activeScenario === s.key
                  ? 'rgba(255,255,255,0.03)'
                  : 'transparent',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: s.color,
                marginBottom: 8,
              }}
            >
              {s.name}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: COLORS.text,
                marginBottom: 4,
              }}
            >
              {s.runway === MONTHS ? '12+' : s.runway}{' '}
              <span style={{ fontSize: 13, fontWeight: 400, color: COLORS.muted }}>
                months
              </span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <MiniSparkline data={s.data} color={s.color} />
            </div>
            <div
              style={{
                fontSize: 10,
                color: s.milestone.color,
              }}
            >
              {s.milestone.label}
            </div>
          </div>
        ))}
      </div>

      {/* Combined overlay chart */}
      <div style={{ position: 'relative' }}>
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          onMouseMove={handleChartMove}
          onMouseLeave={handleChartLeave}
          style={{ display: 'block' }}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((frac) => {
            const y = padY + innerH * (1 - frac);
            return (
              <line
                key={frac}
                x1={padX}
                y1={y}
                x2={padX + innerW}
                y2={y}
                stroke={COLORS.grid}
                strokeWidth={1}
              />
            );
          })}

          {/* Zero line */}
          <line
            x1={padX}
            y1={zeroY}
            x2={padX + innerW}
            y2={zeroY}
            stroke={COLORS.zero}
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          {/* Month labels */}
          {monthLabels.map((label, i) => {
            if (i % 2 !== 0 && i !== MONTHS) return null;
            const x = padX + (i / MONTHS) * innerW;
            return (
              <text
                key={i}
                x={x}
                y={chartHeight - 1}
                textAnchor="middle"
                fill={COLORS.muted}
                fontSize={8}
              >
                {label}
              </text>
            );
          })}

          {/* Scenario lines */}
          {scenarios.map((s) => (
            <path
              key={s.key}
              d={buildPath(s.data)}
              fill="none"
              stroke={s.color}
              strokeWidth={activeScenario === s.key ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={lineOpacity(s.key)}
              style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }}
            />
          ))}

          {/* Current cash dot */}
          <circle
            cx={padX}
            cy={toPoint(0, cash).y}
            r={3}
            fill={COLORS.text}
          />

          {/* Tooltip hover line */}
          {tooltip && (
            <line
              x1={tooltip.x}
              y1={padY}
              x2={tooltip.x}
              y2={padY + innerH}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          )}
        </svg>

        {/* Tooltip overlay */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: `${(tooltip.x / chartWidth) * 100}%`,
              top: 0,
              transform: 'translateX(-50%)',
              background: '#1a2330',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: '6px 10px',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: COLORS.text,
                marginBottom: 4,
              }}
            >
              {tooltip.month}
            </div>
            <div style={{ fontSize: 9, color: COLORS.base }}>
              Base: {formatCash(tooltip.base)}
            </div>
            <div style={{ fontSize: 9, color: COLORS.optimistic }}>
              Optimistic: {formatCash(tooltip.optimistic)}
            </div>
            <div style={{ fontSize: 9, color: COLORS.conservative }}>
              Conservative: {formatCash(tooltip.conservative)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
