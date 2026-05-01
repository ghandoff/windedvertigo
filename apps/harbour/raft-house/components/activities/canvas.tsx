"use client";

import { useState, useRef, useCallback } from "react";
import type { CanvasConfig, CanvasPinCategory, Participant } from "@/lib/types";

interface Props {
  config: CanvasConfig;
  role: "facilitator" | "participant";
  onSubmit?: (response: unknown) => void;
  responses?: Record<string, unknown>;
  participants?: Record<string, Participant>;
  submitted?: boolean;
}

interface Pin {
  x: number;
  y: number;
  note?: string;
  categoryId?: string;
}

const COLORS = [
  "#2dd4bf", "#f472b6", "#facc15", "#818cf8", "#fb923c",
  "#34d399", "#f87171", "#a78bfa", "#38bdf8", "#fbbf24",
];

function pinColorByIndex(index: number, total: number): string {
  if (total <= COLORS.length) return COLORS[index % COLORS.length];
  const hue = (index * 360 / total) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/** normalize a stored response into an array of pins (handles legacy single-pin shape) */
function toPinArray(response: unknown): Pin[] {
  if (response == null) return [];
  if (Array.isArray(response)) return response as Pin[];
  return [response as Pin];
}

export function CanvasActivity({
  config,
  role,
  onSubmit,
  responses,
  participants,
  submitted,
}: Props) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(
    config.pinCategories?.[0]?.id,
  );
  const [note, setNote] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  const isMulti = config.multiPin === true;
  const minPins = config.minPins ?? 1;
  const categories = config.pinCategories;

  const categoryById = (id?: string): CanvasPinCategory | undefined =>
    categories?.find((c) => c.id === id);

  const colorForPin = (p: Pin, fallbackIdx = 0, fallbackTotal = 1): string => {
    if (p.categoryId) {
      const cat = categoryById(p.categoryId);
      if (cat) return cat.color;
    }
    if (config.pinColor === "hue-mapped") {
      const hue = Math.round((p.x / config.width) * 360);
      const sat = Math.round((p.y / config.height) * 100);
      return `hsl(${hue}, ${sat}%, 50%)`;
    }
    return pinColorByIndex(fallbackIdx, fallbackTotal);
  };

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * config.width);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * config.height);
      const newPin: Pin = { x, y };
      if (categories && activeCategoryId) newPin.categoryId = activeCategoryId;
      if (isMulti) {
        setPins((prev) => [...prev, newPin]);
      } else {
        setPins([newPin]);
      }
    },
    [config.width, config.height, isMulti, categories, activeCategoryId],
  );

  const undoLast = () => setPins((prev) => prev.slice(0, -1));
  const clearAll = () => setPins([]);

  const canSubmit = pins.length >= minPins;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isMulti) {
      const submitted = pins.map((p) =>
        config.allowNote && note.trim() ? { ...p, note: note.trim() } : p,
      );
      onSubmit?.(submitted);
    } else {
      const p = pins[0];
      const response: Pin = { x: p.x, y: p.y };
      if (p.categoryId) response.categoryId = p.categoryId;
      if (config.allowNote && note.trim()) response.note = note.trim();
      onSubmit?.(response);
    }
  };

  const toPercent = (val: number, max: number) => (val / max) * 100;

  const isHueMapped = config.pinColor === "hue-mapped";
  const labelClass = isHueMapped ? "text-white/60 drop-shadow-sm" : "text-[var(--rh-text-muted)]";

  const axisLabels = (
    <>
      {config.xLow && (
        <span className={`absolute bottom-1 left-2 text-[10px] tracking-wider ${labelClass}`}>
          {config.xLow}
        </span>
      )}
      {config.xHigh && (
        <span className={`absolute bottom-1 right-2 text-[10px] tracking-wider ${labelClass}`}>
          {config.xHigh}
        </span>
      )}
      {config.yLow && (
        <span className={`absolute bottom-2 left-1 -rotate-90 origin-bottom-left text-[10px] tracking-wider whitespace-nowrap ${labelClass}`}>
          {config.yLow}
        </span>
      )}
      {config.yHigh && (
        <span className={`absolute top-2 left-1 -rotate-90 origin-top-left text-[10px] tracking-wider whitespace-nowrap ${labelClass}`}>
          {config.yHigh}
        </span>
      )}
      {config.xLabel && !config.xLow && !config.xHigh && (
        <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider ${labelClass}`}>
          {config.xLabel}
        </span>
      )}
      {config.yLabel && !config.yLow && !config.yHigh && (
        <span className={`absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-wider origin-center ${labelClass}`}>
          {config.yLabel}
        </span>
      )}
    </>
  );

  // ── participant view ────────────────────────────────────────────
  if (role === "participant" && !submitted) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">{config.prompt}</h3>

        <div className="space-y-4">
          {/* category picker */}
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    activeCategoryId === cat.id
                      ? "border-black/40 bg-white shadow-sm"
                      : "border-black/10 bg-white/50"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/50"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* canvas */}
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="relative w-full border border-black/10 rounded-xl cursor-crosshair overflow-hidden select-none"
            style={{
              aspectRatio: `${config.width} / ${config.height}`,
              background: isHueMapped
                ? "linear-gradient(to bottom, rgba(128,128,128,0.9), transparent), linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))"
                : "white",
            }}
          >
            {axisLabels}

            {!isHueMapped && (
              <div className="absolute inset-0 opacity-10">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-black" />
              </div>
            )}

            {config.zones?.map((zone) => (
              <div
                key={zone.id}
                className="absolute border border-dashed border-black/15 rounded-lg flex items-center justify-center"
                style={{
                  left: `${toPercent(zone.x, config.width)}%`,
                  top: `${toPercent(zone.y, config.height)}%`,
                  width: `${toPercent(zone.width, config.width)}%`,
                  height: `${toPercent(zone.height, config.height)}%`,
                }}
              >
                <span className="text-[10px] text-[var(--rh-text-muted)] uppercase tracking-wider">
                  {zone.label}
                </span>
              </div>
            ))}

            {pins.map((p, i) => (
              <div
                key={i}
                className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg z-10"
                style={{
                  left: `${toPercent(p.x, config.width)}%`,
                  top: `${toPercent(p.y, config.height)}%`,
                  backgroundColor: colorForPin(p),
                }}
              />
            ))}
          </div>

          <p className="text-xs text-[var(--rh-text-muted)] text-center">
            {isMulti
              ? `${pins.length} placed${minPins > 1 ? ` · need at least ${minPins}` : ""}${
                  categories ? " · pick a category, then tap to place" : " · tap to add pins"
                }`
              : pins.length > 0
                ? "tap again to reposition"
                : "tap the canvas to place your pin"}
          </p>

          {isMulti && pins.length > 0 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={undoLast}
                className="px-3 py-1.5 rounded-full border border-black/10 text-xs hover:bg-black/5"
              >
                undo last
              </button>
              <button
                onClick={clearAll}
                className="px-3 py-1.5 rounded-full border border-black/10 text-xs hover:bg-black/5"
              >
                clear all
              </button>
            </div>
          )}

          {config.allowNote && pins.length > 0 && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="add a note (optional)..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-black/10 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--rh-cyan)]/30"
            />
          )}

          {pins.length > 0 && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl bg-[var(--rh-cyan)] text-white font-semibold hover:bg-[var(--rh-teal)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canSubmit
                ? isMulti
                  ? `lock in ${pins.length} pins`
                  : "lock in position"
                : `place ${minPins - pins.length} more`}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (role === "participant" && submitted) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">{config.prompt}</h3>
        <div className="text-center py-6 text-[var(--rh-text-muted)]">
          <p className="text-2xl mb-2">📍</p>
          <p className="text-sm">pins locked — waiting for reveal</p>
        </div>
      </div>
    );
  }

  // ── facilitator view ────────────────────────────────────────────
  // flatten responses into a single list of (participantId, pin) entries
  interface PlottedPin extends Pin {
    pid: string;
    name: string;
    pIdx: number;
    pTotal: number;
  }

  const plotted: PlottedPin[] = [];
  if (responses) {
    const pids = Object.keys(responses);
    pids.forEach((pid, pIdx) => {
      const arr = toPinArray(responses[pid]);
      const name =
        participants?.[pid]?.displayName || `participant ${pIdx + 1}`;
      for (const p of arr) {
        plotted.push({ ...p, pid, name, pIdx, pTotal: pids.length });
      }
    });
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">{config.prompt}</h3>
      <div className="space-y-4">
        {responses ? (
          <>
            <div
              className="relative w-full border border-black/10 rounded-xl overflow-hidden"
              style={{
                aspectRatio: `${config.width} / ${config.height}`,
                background: isHueMapped
                  ? "linear-gradient(to bottom, rgba(128,128,128,0.9), transparent), linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))"
                  : "white",
              }}
            >
              {axisLabels}

              {!isHueMapped && (
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black" />
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-black" />
                </div>
              )}

              {config.zones?.map((zone) => (
                <div
                  key={zone.id}
                  className="absolute border border-dashed border-black/15 rounded-lg flex items-center justify-center"
                  style={{
                    left: `${toPercent(zone.x, config.width)}%`,
                    top: `${toPercent(zone.y, config.height)}%`,
                    width: `${toPercent(zone.width, config.width)}%`,
                    height: `${toPercent(zone.height, config.height)}%`,
                  }}
                >
                  <span className="text-[10px] text-[var(--rh-text-muted)] uppercase tracking-wider">
                    {zone.label}
                  </span>
                </div>
              ))}

              {plotted.map((p, i) => {
                const color = colorForPin(p, p.pIdx, p.pTotal);
                return (
                  <div
                    key={i}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group"
                    style={{
                      left: `${toPercent(p.x, config.width)}%`,
                      top: `${toPercent(p.y, config.height)}%`,
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 border-white shadow-lg"
                      style={{ backgroundColor: color }}
                    />
                    <div className="absolute left-6 top-0 whitespace-nowrap bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-medium shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {p.name}
                      {p.note && (
                        <span className="block text-[var(--rh-text-muted)] font-normal">
                          {p.note}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* summary */}
            {(() => {
              if (plotted.length < 2) return null;

              // category breakdown when categories are configured
              if (categories && categories.length > 0) {
                const counts = categories.map((cat) => ({
                  cat,
                  n: plotted.filter((p) => p.categoryId === cat.id).length,
                }));
                return (
                  <div className="p-3 rounded-xl bg-[var(--rh-sand)] border border-black/5 text-sm">
                    <p className="font-medium mb-1">{plotted.length} pins placed</p>
                    <div className="flex flex-wrap gap-3 text-xs text-[var(--rh-text-muted)]">
                      {counts.map(({ cat, n }) => (
                        <span key={cat.id} className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.label}: {n}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }

              const avgX = plotted.reduce((s, p) => s + p.x, 0) / plotted.length;
              const avgY = plotted.reduce((s, p) => s + p.y, 0) / plotted.length;
              const spread = Math.sqrt(
                plotted.reduce((s, p) => s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0) / plotted.length,
              );
              const maxSpread = Math.sqrt(config.width ** 2 + config.height ** 2) / 2;
              const consensus = 1 - Math.min(spread / maxSpread, 1);
              const consensusLabel =
                consensus > 0.75 ? "tight consensus" :
                consensus > 0.5 ? "moderate agreement" :
                consensus > 0.25 ? "spread out" : "wide disagreement";

              const xPos = avgX / config.width;
              const yPos = avgY / config.height;
              const xDesc = config.xLow && config.xHigh
                ? (xPos < 0.33 ? config.xLow : xPos > 0.67 ? config.xHigh : `between ${config.xLow} and ${config.xHigh}`)
                : null;
              const yDesc = config.yLow && config.yHigh
                ? (yPos > 0.67 ? config.yLow : yPos < 0.33 ? config.yHigh : `between ${config.yLow} and ${config.yHigh}`)
                : null;

              return (
                <div className="p-3 rounded-xl bg-[var(--rh-sand)] border border-black/5 text-sm">
                  <p className="font-medium mb-1">group pattern: {consensusLabel}</p>
                  <p className="text-xs text-[var(--rh-text-muted)]">
                    {xDesc && yDesc
                      ? `the group clusters toward ${xDesc}, ${yDesc}`
                      : `${plotted.length} pins placed — ${consensusLabel.toLowerCase()}`}
                  </p>
                </div>
              );
            })()}

            {/* legend */}
            {categories && categories.length > 0 ? null : (
              <div className="flex flex-wrap gap-2">
                {responses && Object.keys(responses).map((pid, i, arr) => {
                  const name =
                    participants?.[pid]?.displayName || `participant ${i + 1}`;
                  const color = pinColorByIndex(i, arr.length);
                  return (
                    <div key={pid} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {name}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--rh-text-muted)]">
            pins are hidden — click &quot;reveal results&quot; to show the map
          </p>
        )}
      </div>
    </div>
  );
}
