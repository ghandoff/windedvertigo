"use client";

import { useState, useEffect, useRef, useMemo } from "react";

interface PollOption {
  id: string;
  starts_at: string;
  ends_at: string;
  sort_order: number;
}

interface PollResponseChoice {
  option_id: string;
  availability: "yes" | "if_need_be" | "no";
}

interface Props {
  pollSlug: string;
  options: PollOption[];
  existingChoices: PollResponseChoice[];
  totalResponses: number;
  lockedOptionId: string | null;
}

// ── timezone helpers ──────────────────────────────────────────────────────────

function getLocalDate(isoStr: string, tz: string): string {
  return new Date(isoStr).toLocaleDateString("en-CA", { timeZone: tz });
}

function getLocalMins(isoStr: string, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoStr));
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return (h >= 24 ? 0 : h) * 60 + m;
}

// ── grid builder ──────────────────────────────────────────────────────────────

interface GridData {
  dates: string[];
  timeRows: number[];
  cellMap: Map<string, string>; // `${date}|${startMins}` → optionId
}

function buildGrid(options: PollOption[], tz: string): GridData {
  const cellMap = new Map<string, string>();

  for (const opt of options) {
    const date = getLocalDate(opt.starts_at, tz);
    const startMins = getLocalMins(opt.starts_at, tz);
    const endMins = getLocalMins(opt.ends_at, tz);
    // Guard: zero-duration options (starts_at == ends_at) should produce no cells.
    // Without this, the `endMins < startMins` midnight-crossing path yields 1440.
    if (endMins === startMins) continue;
    const durationMins =
      endMins > startMins ? endMins - startMins : endMins + 1440 - startMins;

    for (let d = 0; d < durationMins; d += 30) {
      const m = (startMins + d) % 1440;
      cellMap.set(`${date}|${m}`, opt.id);
    }
  }

  const dates = [...new Set([...cellMap.keys()].map((k) => k.split("|")[0]))].sort();
  if (dates.length === 0) return { dates: [], timeRows: [], cellMap };

  const allMins = [...cellMap.keys()].map((k) => parseInt(k.split("|")[1], 10));
  const minMins = Math.min(...allMins);
  const maxMins = Math.max(...allMins) + 30;

  const timeRows: number[] = [];
  for (let m = minMins; m < maxMins; m += 30) timeRows.push(m);

  return { dates, timeRows, cellMap };
}

// ── formatters ────────────────────────────────────────────────────────────────

function fmtDayHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const wd = d.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const mo = d.getMonth() + 1;
  const dy = d.getDate();
  return `${wd} ${mo}/${dy}`;
}

function fmtTimeMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? " am" : " pm";
  if (m !== 0) return "";
  return `${display}${ampm}`;
}

// ── component ─────────────────────────────────────────────────────────────────

export function PollRespondForm({
  pollSlug,
  options,
  existingChoices,
  totalResponses,
  lockedOptionId,
}: Props) {
  const [tz, setTz] = useState("America/Los_Angeles");
  const [name, setName] = useState("");
  const [mySelections, setMySelections] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localChoices, setLocalChoices] = useState<PollResponseChoice[]>(existingChoices);
  const [localTotal, setLocalTotal] = useState(totalResponses);
  // drag-select: "select" or "deselect" — null when not dragging
  const dragOpRef = useRef<"select" | "deselect" | null>(null);

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    const end = () => { dragOpRef.current = null; };
    document.addEventListener("mouseup", end);
    return () => document.removeEventListener("mouseup", end);
  }, []);

  const grid = useMemo(() => buildGrid(options, tz), [options, tz]);

  const heatByOption = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of localChoices) {
      if (c.availability === "yes" || c.availability === "if_need_be") {
        map.set(c.option_id, (map.get(c.option_id) ?? 0) + 1);
      }
    }
    return map;
  }, [localChoices]);

  function toggleOption(optionId: string) {
    if (submitted || lockedOptionId) return;
    setMySelections((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("please enter your name"); return; }
    if (mySelections.size === 0) { setError("select at least one time slot"); return; }
    setSubmitting(true);
    setError(null);

    const choices: Record<string, "yes" | "no"> = {};
    for (const opt of options) {
      choices[opt.id] = mySelections.has(opt.id) ? "yes" : "no";
    }

    try {
      const res = await fetch(`/api/poll/${pollSlug}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), choices }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "something went wrong");
      }
      // Update local heat map without a full page refresh
      const newChoices: PollResponseChoice[] = [];
      for (const [optId, avail] of Object.entries(choices)) {
        newChoices.push({ option_id: optId, availability: avail });
      }
      setLocalChoices((prev) => [...prev, ...newChoices]);
      setLocalTotal((t) => t + 1);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (grid.dates.length === 0) {
    return (
      <div
        className="rounded-xl px-5 py-6 text-center"
        style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          no time slots available
        </p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          the organiser may need to recreate this poll with valid time windows.
        </p>
      </div>
    );
  }

  const isLocked = Boolean(lockedOptionId);
  const CELL_H = 28; // px per 30-min row
  const DAY_COL_W = 96; // px per day column
  const LABEL_COL = 56; // px for time labels

  return (
    <div>
      {/* Response counter */}
      <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        {localTotal === 0
          ? "no responses yet — be the first"
          : `${localTotal} response${localTotal !== 1 ? "s" : ""} · times in ${tz}`}
      </p>

      {/* Calendar grid */}
      <div
        className="overflow-x-auto rounded-xl"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${LABEL_COL}px repeat(${grid.dates.length}, minmax(${DAY_COL_W}px, 1fr))`,
            gridTemplateRows: `40px repeat(${grid.timeRows.length}, ${CELL_H}px)`,
            minWidth: `${LABEL_COL + grid.dates.length * DAY_COL_W}px`,
          }}
        >
          {/* Corner */}
          <div
            style={{
              gridRow: 1,
              gridColumn: 1,
              borderBottom: "1px solid rgba(255,255,255,0.10)",
              borderRight: "1px solid rgba(255,255,255,0.10)",
            }}
          />

          {/* Day headers */}
          {grid.dates.map((d, ci) => (
            <div
              key={d}
              style={{
                gridRow: 1,
                gridColumn: ci + 2,
                borderBottom: "1px solid rgba(255,255,255,0.10)",
                borderRight: ci < grid.dates.length - 1 ? "1px solid rgba(255,255,255,0.10)" : undefined,
                color: "rgba(255,255,255,0.75)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textTransform: "lowercase",
              }}
            >
              {fmtDayHeader(d)}
            </div>
          ))}

          {/* Time labels */}
          {grid.timeRows.map((rowMins, ri) => (
            <div
              key={`lbl-${rowMins}`}
              style={{
                gridRow: ri + 2,
                gridColumn: 1,
                borderRight: "1px solid rgba(255,255,255,0.10)",
                borderTop: rowMins % 60 === 0 ? "1px solid rgba(255,255,255,0.10)" : undefined,
                color: rowMins % 60 === 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                fontSize: 10,
                fontWeight: rowMins % 60 === 0 ? 600 : 400,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-end",
                paddingRight: 8,
                paddingTop: rowMins % 60 === 0 ? 4 : 0,
              }}
            >
              {fmtTimeMins(rowMins)}
            </div>
          ))}

          {/* Cells */}
          {grid.timeRows.map((rowMins, ri) =>
            grid.dates.map((date, ci) => {
              const optionId = grid.cellMap.get(`${date}|${rowMins}`);
              const isMine = optionId ? mySelections.has(optionId) : false;
              const isLockedSlot = optionId === lockedOptionId;
              const heat =
                optionId && localTotal > 0
                  ? (heatByOption.get(optionId) ?? 0) / localTotal
                  : 0;
              const atHourBoundary = rowMins % 60 === 0;
              const isLastCol = ci === grid.dates.length - 1;

              let bg = "transparent";
              let borderColor = "rgba(255,255,255,0.04)";

              if (optionId) {
                if (isMine) {
                  bg = "rgba(45, 212, 191, 0.70)";
                  borderColor = "rgba(45,212,191,0.7)";
                } else if (isLockedSlot) {
                  bg = "rgba(34,197,94,0.35)";
                  borderColor = "rgba(34,197,94,0.5)";
                } else if (heat > 0) {
                  bg = `rgba(45, 212, 191, ${Math.max(0.18, heat * 0.55)})`;
                  borderColor = "rgba(45,212,191,0.3)";
                } else {
                  bg = "rgba(255,255,255,0.11)";
                  borderColor = "rgba(255,255,255,0.14)";
                }
              }

              return (
                <div
                  key={`${date}-${rowMins}`}
                  onMouseDown={optionId && !submitted && !isLocked ? (e) => {
                    e.preventDefault(); // prevent text selection during drag
                    const op = mySelections.has(optionId) ? "deselect" : "select";
                    dragOpRef.current = op;
                    setMySelections((prev) => {
                      const next = new Set(prev);
                      if (op === "select") next.add(optionId);
                      else next.delete(optionId);
                      return next;
                    });
                  } : undefined}
                  style={{
                    gridRow: ri + 2,
                    gridColumn: ci + 2,
                    backgroundColor: bg,
                    borderTop: `1px solid ${atHourBoundary ? "rgba(255,255,255,0.12)" : (optionId ? borderColor : "rgba(255,255,255,0.04)")}`,
                    borderRight: !isLastCol ? `1px solid rgba(255,255,255,0.08)` : undefined,
                    cursor: optionId && !submitted && !isLocked ? "pointer" : "default",
                    transition: dragOpRef.current ? undefined : "background-color 0.12s ease",
                  }}
                  onMouseEnter={optionId && !submitted && !isLocked ? (e) => {
                    if (dragOpRef.current !== null) {
                      // during drag: apply the stored operation
                      setMySelections((prev) => {
                        const next = new Set(prev);
                        if (dragOpRef.current === "select") next.add(optionId);
                        else next.delete(optionId);
                        return next;
                      });
                    } else if (!isMine) {
                      // hover highlight when not dragging
                      (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(45,212,191,0.22)";
                    }
                  } : undefined}
                  onMouseLeave={optionId && !submitted && !isLocked ? (e) => {
                    if (dragOpRef.current === null) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = bg;
                    }
                  } : undefined}
                />
              );
            }),
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 mb-6 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        {!submitted && !isLocked && (
          <span className="flex items-center gap-1.5">
            <span
              style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(45,212,191,0.65)", display: "inline-block" }}
            />
            your selection
          </span>
        )}
        {localTotal > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(45,212,191,0.35)", display: "inline-block" }}
            />
            others available
          </span>
        )}
        {isLocked && (
          <span className="flex items-center gap-1.5">
            <span
              style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(34,197,94,0.35)", display: "inline-block" }}
            />
            confirmed time
          </span>
        )}
      </div>

      {/* Response form */}
      {!isLocked && (
        submitted ? (
          <div
            className="rounded-xl px-5 py-4 text-sm"
            style={{
              background: "rgba(45,212,191,0.08)",
              border: "1px solid rgba(45,212,191,0.25)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <p className="font-medium text-teal-300">availability submitted ✓</p>
            <p className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              thanks {name}! the heat map above now includes your response.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="respondent-name"
                className="block text-xs mb-1.5"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                your name
              </label>
              <input
                id="respondent-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. jamie"
                style={{
                  width: "100%",
                  maxWidth: 280,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>

            {mySelections.size > 0 ? (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {mySelections.size} slot{mySelections.size !== 1 ? "s" : ""} selected —{" "}
                click or drag to adjust, then submit.
              </p>
            ) : (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                click cells to select, or drag across multiple to select a range.
              </p>
            )}

            {error && (
              <p className="text-xs" style={{ color: "#f87171" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? "rgba(45,212,191,0.3)" : "rgba(45,212,191,0.75)",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                letterSpacing: "0.02em",
              }}
            >
              {submitting ? "saving…" : "submit availability →"}
            </button>
          </form>
        )
      )}
    </div>
  );
}
