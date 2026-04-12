"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";
import type { TreeNode, PersonEvent } from "@/lib/types";

const SEX_COLORS: Record<string, string> = {
  M: "#6B8F9E", // cadet
  F: "#A45A52", // redwood
  X: "#C97B3D", // sienna
  U: "#C97B3D", // sienna
};

const BAR_HEIGHT = 20;
const ROW_GAP = 8;
const ROW_HEIGHT = BAR_HEIGHT + ROW_GAP;
const LABEL_WIDTH = 160;
const AXIS_HEIGHT = 40;
const PADDING_X = 20;
const EVENT_RADIUS = 4;

type TooltipState = {
  x: number;
  y: number;
  content: string;
} | null;

export function TimelineView({
  nodes,
  events,
}: {
  nodes: TreeNode[];
  events: PersonEvent[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);
  const router = useRouter();

  // sort nodes by birth year, filter to those with at least a birth year
  const sortedNodes = useMemo(() => {
    return [...nodes]
      .filter((n) => n.birthYear)
      .sort((a, b) => {
        const ay = parseInt(a.birthYear!, 10);
        const by = parseInt(b.birthYear!, 10);
        return ay - by;
      });
  }, [nodes]);

  // index events by person_id
  const eventsByPerson = useMemo(() => {
    const map = new Map<string, PersonEvent[]>();
    for (const ev of events) {
      if (!map.has(ev.person_id)) map.set(ev.person_id, []);
      map.get(ev.person_id)!.push(ev);
    }
    return map;
  }, [events]);

  // compute year domain
  const currentYear = new Date().getFullYear();
  const { minYear, maxYear } = useMemo(() => {
    if (sortedNodes.length === 0) return { minYear: 1900, maxYear: currentYear };
    let min = Infinity;
    let max = -Infinity;
    for (const n of sortedNodes) {
      const birth = parseInt(n.birthYear!, 10);
      if (birth < min) min = birth;
      const death = n.deathYear ? parseInt(n.deathYear, 10) : currentYear;
      if (death > max) max = death;
    }
    return { minYear: min - 10, maxYear: max + 10 };
  }, [sortedNodes, currentYear]);

  // observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // base x scale (before zoom)
  const xScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([minYear, maxYear])
      .range([LABEL_WIDTH + PADDING_X, dimensions.width - PADDING_X]);
  }, [minYear, maxYear, dimensions.width]);

  // zoomed x scale
  const zoomedXScale = useMemo(() => {
    return transform.rescaleX(xScale);
  }, [transform, xScale]);

  // svg content height
  const contentHeight = Math.max(
    dimensions.height,
    AXIS_HEIGHT + sortedNodes.length * ROW_HEIGHT + 20
  );

  // setup zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .translateExtent([
        [0, 0],
        [dimensions.width * 10, contentHeight],
      ])
      .filter((event) => {
        // allow wheel zoom and drag pan, but not double-click zoom
        if (event.type === "dblclick") return false;
        return true;
      })
      .on("zoom", (event) => {
        // only apply x-axis transform
        const t = event.transform;
        setTransform(d3.zoomIdentity.translate(t.x, 0).scale(t.k));
      });

    zoomRef.current = zoom;
    d3.select(svg).call(zoom);

    return () => {
      d3.select(svg).on(".zoom", null);
    };
  }, [dimensions.width, contentHeight]);

  // generate axis ticks
  const ticks = useMemo(() => {
    const domain = zoomedXScale.domain();
    const start = Math.ceil(domain[0] / 10) * 10;
    const end = Math.floor(domain[1] / 10) * 10;
    const result: { year: number; x: number; isLabel: boolean }[] = [];
    for (let y = start; y <= end; y += 10) {
      result.push({
        year: y,
        x: zoomedXScale(y),
        isLabel: y % 20 === 0,
      });
    }
    return result;
  }, [zoomedXScale]);

  const handleBarClick = useCallback(
    (id: string) => {
      router.push(`/person/${id}`);
    },
    [router]
  );

  const extractEventYear = useCallback((ev: PersonEvent): number | null => {
    const dateStr = ev.sort_date || ev.date?.date;
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : null;
  }, []);

  if (sortedNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        no persons with birth dates to display
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-y-auto overflow-x-hidden">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={contentHeight}
        className="select-none"
        style={{ cursor: "grab" }}
      >
        <defs>
          {/* gradient for living persons */}
          {sortedNodes.map((node) => {
            if (!node.isLiving) return null;
            const color = SEX_COLORS[node.sex || "U"];
            return (
              <linearGradient
                key={`fade-${node.id}`}
                id={`fade-${node.id}`}
                x1="0"
                x2="1"
                y1="0"
                y2="0"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                <stop offset="70%" stopColor={color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>

        {/* clip to chart area */}
        <defs>
          <clipPath id="chart-clip">
            <rect
              x={LABEL_WIDTH}
              y={0}
              width={dimensions.width - LABEL_WIDTH}
              height={contentHeight}
            />
          </clipPath>
        </defs>

        {/* grid lines */}
        <g clipPath="url(#chart-clip)">
          {ticks
            .filter((t) => t.isLabel)
            .map((t) => (
              <line
                key={`grid-${t.year}`}
                x1={t.x}
                x2={t.x}
                y1={AXIS_HEIGHT}
                y2={contentHeight}
                stroke="currentColor"
                strokeOpacity={0.06}
                strokeWidth={1}
              />
            ))}
        </g>

        {/* axis */}
        <g>
          {/* axis line */}
          <line
            x1={LABEL_WIDTH}
            x2={dimensions.width}
            y1={AXIS_HEIGHT}
            y2={AXIS_HEIGHT}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
          {ticks.map((t) => (
            <g key={`tick-${t.year}`}>
              <line
                x1={t.x}
                x2={t.x}
                y1={AXIS_HEIGHT - (t.isLabel ? 8 : 4)}
                y2={AXIS_HEIGHT}
                stroke="currentColor"
                strokeOpacity={0.3}
                strokeWidth={1}
              />
              {t.isLabel && (
                <text
                  x={t.x}
                  y={AXIS_HEIGHT - 12}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={10}
                >
                  {t.year}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* person rows */}
        <g clipPath="url(#chart-clip)">
          {sortedNodes.map((node, i) => {
            const birthYear = parseInt(node.birthYear!, 10);
            const deathYear = node.deathYear
              ? parseInt(node.deathYear, 10)
              : currentYear;
            const x1 = zoomedXScale(birthYear);
            const x2 = zoomedXScale(deathYear);
            const y = AXIS_HEIGHT + 10 + i * ROW_HEIGHT;
            const barWidth = Math.max(x2 - x1, 2);
            const color = SEX_COLORS[node.sex || "U"];
            const personEvents = eventsByPerson.get(node.id) || [];

            return (
              <g key={node.id}>
                {/* lifespan bar */}
                <rect
                  x={x1}
                  y={y}
                  width={barWidth}
                  height={BAR_HEIGHT}
                  rx={3}
                  fill={
                    node.isLiving ? `url(#fade-${node.id})` : color
                  }
                  fillOpacity={node.isLiving ? 1 : 0.85}
                  className="cursor-pointer"
                  onClick={() => handleBarClick(node.id)}
                  onMouseEnter={(e) => {
                    const birth = node.birthYear || "?";
                    const death = node.isLiving
                      ? "living"
                      : node.deathYear || "?";
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      content: `${node.displayName}\n${birth} – ${death}`,
                    });
                  }}
                  onMouseMove={(e) => {
                    setTooltip((prev) =>
                      prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
                    );
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />

                {/* event dots */}
                {personEvents.map((ev) => {
                  const evYear = extractEventYear(ev);
                  if (evYear === null) return null;
                  const ex = zoomedXScale(evYear);
                  if (ex < x1 || ex > x1 + barWidth) return null;
                  return (
                    <circle
                      key={ev.id}
                      cx={ex}
                      cy={y + BAR_HEIGHT / 2}
                      r={EVENT_RADIUS}
                      fill="white"
                      stroke={color}
                      strokeWidth={1.5}
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        const dateStr = ev.date?.display || ev.sort_date || "";
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          content: `${ev.event_type}${dateStr ? ` — ${dateStr}` : ""}`,
                        });
                      }}
                      onMouseMove={(e) => {
                        setTooltip((prev) =>
                          prev
                            ? { ...prev, x: e.clientX, y: e.clientY }
                            : prev
                        );
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>

        {/* name labels (outside clip so they're always visible) */}
        <g>
          {sortedNodes.map((node, i) => {
            const y = AXIS_HEIGHT + 10 + i * ROW_HEIGHT;
            return (
              <text
                key={`label-${node.id}`}
                x={LABEL_WIDTH - 8}
                y={y + BAR_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="central"
                className="fill-foreground cursor-pointer"
                fontSize={11}
                onClick={() => handleBarClick(node.id)}
              >
                {node.displayName.length > 20
                  ? node.displayName.slice(0, 19) + "…"
                  : node.displayName}
              </text>
            );
          })}
        </g>
      </svg>

      {/* tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-md bg-popover text-popover-foreground text-xs shadow-md border border-border whitespace-pre-line"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 8,
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
