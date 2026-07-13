"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw } from "lucide-react";
import { updatePollAction } from "./actions";
import type { Poll, PollOption } from "@/lib/booking/types";
import type { SuggestedSlot } from "@/lib/booking/collective-slots";

interface SlotMeta {
  option: PollOption;
  responseCount: number;
}

interface Props {
  poll: Poll;
  slotMeta: SlotMeta[];
  suggestedSlots: SuggestedSlot[];
  creatorTz?: string;
  initialFrom?: string;
  initialTo?: string;
  initialFromTime?: string;
  initialToTime?: string;
}

function parseTimeMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "a" : "p";
  if (m === 0) return `${display}${ampm}`;
  return `${display}:${String(m).padStart(2, "0")}${ampm}`;
}

function fmtDateHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

function slotKey(s: string, e: string) { return `${s}|${e}`; }

function offsetDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function formatSlot(startsAt: string, tz = "America/Los_Angeles") {
  const d = new Date(startsAt);
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: tz,
  });
}

export function EditPollForm({
  poll,
  slotMeta,
  suggestedSlots,
  creatorTz,
  initialFrom,
  initialTo,
  initialFromTime,
  initialToTime,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(poll.title);
  const [description, setDescription] = useState(poll.description ?? "");
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [newSelected, setNewSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(initialFrom ?? offsetDateStr(1));
  const [toDate, setToDate] = useState(initialTo ?? offsetDateStr(28));
  const [fromTime, setFromTime] = useState(initialFromTime ?? "");
  const [toTime, setToTime] = useState(initialToTime ?? "");
  const dragOpRef = useRef<"select" | "deselect" | null>(null);

  function buildUrl(fd: string, td: string, ft: string, tt: string) {
    const p = new URLSearchParams();
    if (fd) p.set("from", fd);
    if (td) p.set("to", td);
    if (ft) p.set("fromTime", ft);
    if (tt) p.set("toTime", tt);
    return `/bookings/polls/${poll.id}/edit?${p.toString()}`;
  }

  const { dates, timeRows, cellMap } = useMemo(() => {
    if (suggestedSlots.length === 0) return { dates: [], timeRows: [] as number[], cellMap: new Map<string, SuggestedSlot>() };
    const byDate = new Map<string, SuggestedSlot[]>();
    for (const s of suggestedSlots) {
      const date = s.startsAt.split("T")[0];
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(s);
    }
    const dates = [...byDate.keys()].sort();
    const allStartMins = suggestedSlots.map((s) => parseTimeMins(s.startsAt.split("T")[1]));
    const allEndMins = suggestedSlots.map((s) => parseTimeMins(s.endsAt.split("T")[1]));
    const minMins = Math.min(...allStartMins);
    const maxMins = Math.max(...allEndMins);
    const timeRows: number[] = [];
    for (let m = minMins; m < maxMins; m += 30) timeRows.push(m);
    const cellMap = new Map<string, SuggestedSlot>();
    for (const s of suggestedSlots) {
      const date = s.startsAt.split("T")[0];
      const m = parseTimeMins(s.startsAt.split("T")[1]);
      cellMap.set(`${date}|${m}`, s);
    }
    return { dates, timeRows, cellMap };
  }, [suggestedSlots]);

  const toggleNew = useCallback((s: SuggestedSlot) => {
    const k = slotKey(s.startsAt, s.endsAt);
    setNewSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }, []);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const addSlots = [...newSelected].map((k) => {
      const [s, e] = k.split("|");
      return { startsAt: s, endsAt: e };
    });
    const result = await updatePollAction(poll.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      removeOptionIds: [...pendingDeletes],
      addSlots: addSlots.length ? addSlots : undefined,
    });
    setSaving(false);
    if (result.ok) {
      router.push(`/bookings/polls/${poll.id}`);
    } else {
      setError(result.error ?? "save failed");
    }
  }

  const tz = creatorTz ?? "America/Los_Angeles";

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Title + description */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="lowercase"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">
            description{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Existing slots */}
      <div className="space-y-3">
        <Label>current slots</Label>
        {slotMeta.length === 0 ? (
          <p className="text-xs text-muted-foreground">no slots yet — add some below.</p>
        ) : (
          <div className="space-y-2">
            {slotMeta.map(({ option, responseCount }) => {
              const marked = pendingDeletes.has(option.id);
              const canDelete = responseCount === 0;
              return (
                <div
                  key={option.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                    marked ? "border-destructive/40 bg-destructive/5 opacity-60 line-through" : ""
                  }`}
                >
                  <span className="text-muted-foreground">
                    {formatSlot(option.starts_at, tz)}
                  </span>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {responseCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {responseCount} response{responseCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {canDelete ? (
                      <button
                        type="button"
                        title={marked ? "undo remove" : "remove slot"}
                        onClick={() =>
                          setPendingDeletes((prev) => {
                            const next = new Set(prev);
                            if (next.has(option.id)) next.delete(option.id);
                            else next.add(option.id);
                            return next;
                          })
                        }
                        className={`text-muted-foreground hover:text-destructive transition-colors ${marked ? "text-destructive" : ""}`}
                      >
                        {marked ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60" title="can't remove — has responses">locked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pendingDeletes.size > 0 && (
          <p className="text-xs text-destructive/80">
            {pendingDeletes.size} slot{pendingDeletes.size !== 1 ? "s" : ""} will be removed on save.
          </p>
        )}
      </div>

      {/* Add more slots via collective grid */}
      {suggestedSlots.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>add more slots</Label>
            {newSelected.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {newSelected.size} slot{newSelected.size !== 1 ? "s" : ""} to add
              </span>
            )}
          </div>

          {/* Date + time range controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>date range</span>
            <Input type="date" value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); if (e.target.value && toDate > e.target.value) router.push(buildUrl(e.target.value, toDate, fromTime, toTime)); }}
              className="h-7 text-xs w-36 px-2" />
            <span>–</span>
            <Input type="date" value={toDate}
              onChange={(e) => { setToDate(e.target.value); if (fromDate && e.target.value > fromDate) router.push(buildUrl(fromDate, e.target.value, fromTime, toTime)); }}
              className="h-7 text-xs w-36 px-2" />
            <span className="ml-2">time range</span>
            <Input type="time" value={fromTime}
              onChange={(e) => { setFromTime(e.target.value); router.push(buildUrl(fromDate, toDate, e.target.value, toTime)); }}
              className="h-7 text-xs w-28 px-2" />
            <span>–</span>
            <Input type="time" value={toTime}
              onChange={(e) => { setToTime(e.target.value); router.push(buildUrl(fromDate, toDate, fromTime, e.target.value)); }}
              className="h-7 text-xs w-28 px-2" />
            {creatorTz && <span className="text-[10px] opacity-60">{creatorTz}</span>}
          </div>

          <p className="text-xs text-muted-foreground">
            click or drag to select new slots to add. each cell = 30 min.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `44px repeat(${dates.length}, minmax(58px, 1fr))`,
                gridTemplateRows: `28px repeat(${timeRows.length}, 20px)`,
                minWidth: `${44 + dates.length * 58}px`,
              }}
            >
              <div style={{ gridRow: 1, gridColumn: 1 }} className="border-b border-r border-border" />
              {dates.map((d, ci) => (
                <div key={d} style={{ gridRow: 1, gridColumn: ci + 2 }}
                  className="border-b border-r border-border px-1 flex items-center justify-center text-[10px] text-muted-foreground font-medium truncate">
                  {fmtDateHeader(d)}
                </div>
              ))}
              {timeRows.map((rowMins, ri) => (
                <div key={`lbl-${rowMins}`} style={{ gridRow: ri + 2, gridColumn: 1 }}
                  className="border-r border-border flex items-center justify-end pr-1.5 text-[10px] text-muted-foreground">
                  {rowMins % 60 === 0 ? fmtMins(rowMins) : ""}
                </div>
              ))}
              {timeRows.map((rowMins, ri) =>
                dates.map((date, ci) => {
                  const s = cellMap.get(`${date}|${rowMins}`);
                  const isSel = s ? newSelected.has(slotKey(s.startsAt, s.endsAt)) : false;
                  return (
                    <div
                      key={`${date}-${rowMins}`}
                      style={{ gridRow: ri + 2, gridColumn: ci + 2 }}
                      onMouseDown={s ? (e) => {
                        e.preventDefault();
                        const k = slotKey(s.startsAt, s.endsAt);
                        const op = newSelected.has(k) ? "deselect" : "select";
                        dragOpRef.current = op;
                        setNewSelected((prev) => {
                          const next = new Set(prev);
                          if (op === "select") next.add(k); else next.delete(k);
                          return next;
                        });
                      } : undefined}
                      onMouseEnter={s ? () => {
                        if (dragOpRef.current !== null) {
                          const k = slotKey(s.startsAt, s.endsAt);
                          setNewSelected((prev) => {
                            const next = new Set(prev);
                            if (dragOpRef.current === "select") next.add(k); else next.delete(k);
                            return next;
                          });
                        }
                      } : undefined}
                      title={s ? `${s.label}${isSel ? " — deselect" : " — select"}` : undefined}
                      className={`border-r border-b border-border/40 transition-colors ${
                        s ? isSel
                          ? "bg-primary/60 hover:bg-primary/50 cursor-pointer"
                          : "bg-muted/30 hover:bg-muted/50 cursor-pointer"
                          : ""
                      }`}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !title.trim()} size="sm">
          {saving ? "saving…" : "save changes"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/bookings/polls/${poll.id}`)}>
          cancel
        </Button>
      </div>
    </div>
  );
}
