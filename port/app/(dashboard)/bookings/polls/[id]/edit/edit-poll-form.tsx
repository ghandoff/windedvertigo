"use client";

import { useState } from "react";
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
import { AvailabilityGrid } from "@/app/(dashboard)/bookings/polls/_components/availability-grid";

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

  function buildUrl(fd: string, td: string, ft: string, tt: string) {
    const p = new URLSearchParams();
    if (fd) p.set("from", fd);
    if (td) p.set("to", td);
    if (ft) p.set("fromTime", ft);
    if (tt) p.set("toTime", tt);
    return `/bookings/polls/${poll.id}/edit?${p.toString()}`;
  }

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

          <AvailabilityGrid
            suggestedSlots={suggestedSlots}
            selected={newSelected}
            setSelected={setNewSelected}
          />
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
