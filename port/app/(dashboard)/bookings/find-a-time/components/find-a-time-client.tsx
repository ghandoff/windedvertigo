"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { findTimesAction, bookTeamMeetingAction } from "../actions";
import type { FindTimesResult } from "@/lib/booking/site-internal";

interface HostLite {
  id: string;
  slug: string;
  display_name: string;
}

interface Props {
  hosts: HostLite[];
}

const DURATIONS = [30, 60, 90];
const VIEWER_TZ = "America/Los_Angeles";

function todayLocalIso(): string {
  // Default `from` = now, rounded to next hour
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString();
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: VIEWER_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const datePart = s.toLocaleDateString("en-US", {
    timeZone: VIEWER_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const sTime = s.toLocaleTimeString("en-US", {
    timeZone: VIEWER_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  const eTime = e.toLocaleTimeString("en-US", {
    timeZone: VIEWER_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart.toLowerCase()} · ${sTime}–${eTime}`;
}

interface ResultGroup {
  /** Number of selected hosts free in this group */
  freeCount: number;
  /** Slugs that are free in every window in this group (note: across windows
   * the free set varies — this isn't quite right; we recompute per-window). */
  rows: { start: string; end: string; freeSlugs: string[]; missingSlugs: string[] }[];
}

export function FindATimeClient({ hosts }: Props) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(hosts.map((h) => h.slug));
  const [duration, setDuration] = useState<number>(30);
  const [fromIso, setFromIso] = useState<string>(todayLocalIso());
  const [toIso, setToIso] = useState<string>(plusDaysIso(14));
  const [minRequired, setMinRequired] = useState<number>(2);
  const [result, setResult] = useState<FindTimesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // booking dialog state
  const [bookingRow, setBookingRow] = useState<{
    start: string;
    end: string;
    freeSlugs: string[];
  } | null>(null);
  const [title, setTitle] = useState("collective sync");
  const [description, setDescription] = useState("");
  const [primarySlug, setPrimarySlug] = useState<string>("garrett");
  const [bookErr, setBookErr] = useState<string | null>(null);
  const [bookOk, setBookOk] = useState<{ htmlLink: string | null; meetUrl: string | null } | null>(
    null,
  );
  const [booking, startBooking] = useTransition();

  const slugById = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of hosts) m.set(h.id, h.slug);
    return m;
  }, [hosts]);

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function search() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await findTimesAction({
        hostSlugs: selectedSlugs,
        duration,
        fromIso,
        toIso,
        minRequired,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setResult(res.result);
      }
    });
  }

  // Group windows by freeCount (highest first)
  const groups: ResultGroup[] = useMemo(() => {
    if (!result) return [];
    const map = new Map<number, ResultGroup["rows"]>();
    for (const w of result.windows) {
      const freeSlugs = w.freeHostIds
        .map((hid) => slugById.get(hid))
        .filter((s): s is string => Boolean(s));
      const missingSlugs = selectedSlugs.filter((s) => !freeSlugs.includes(s));
      const arr = map.get(freeSlugs.length) ?? [];
      arr.push({ start: w.start, end: w.end, freeSlugs, missingSlugs });
      map.set(freeSlugs.length, arr);
    }
    const counts = Array.from(map.keys()).sort((a, b) => b - a);
    return counts.map((c) => ({ freeCount: c, rows: map.get(c)! }));
  }, [result, selectedSlugs, slugById]);

  function openBookingDialog(row: { start: string; end: string; freeSlugs: string[] }) {
    setBookingRow(row);
    setBookErr(null);
    setBookOk(null);
    setTitle("collective sync");
    setDescription("");
    if (!row.freeSlugs.includes(primarySlug)) {
      setPrimarySlug(row.freeSlugs[0]);
    }
  }

  function confirmBooking() {
    if (!bookingRow) return;
    setBookErr(null);
    setBookOk(null);
    startBooking(async () => {
      const attendees = bookingRow.freeSlugs.filter((s) => s !== primarySlug);
      const res = await bookTeamMeetingAction({
        primaryHostSlug: primarySlug,
        attendeeHostSlugs: attendees,
        start: bookingRow.start,
        end: bookingRow.end,
        title: title.trim() || "collective sync",
        description: description.trim(),
        timezone: VIEWER_TZ,
      });
      if (!res.ok) {
        setBookErr(res.error);
      } else {
        setBookOk({ htmlLink: res.result.htmlLink, meetUrl: res.result.meetUrl });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* form */}
      <section className="rounded-md border p-5 space-y-4">
        <div>
          <div className="text-xs text-muted-foreground mb-2">members</div>
          <div className="flex flex-wrap gap-2">
            {hosts.map((h) => {
              const active = selectedSlugs.includes(h.slug);
              return (
                <button
                  key={h.slug}
                  type="button"
                  onClick={() => toggleSlug(h.slug)}
                  className={
                    active
                      ? "rounded-full bg-foreground text-background text-xs px-3 py-1.5"
                      : "rounded-full border text-xs px-3 py-1.5 hover:bg-muted"
                  }
                >
                  {h.display_name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">duration</div>
            <div className="inline-flex border rounded-md">
              {DURATIONS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={
                    (d === duration ? "bg-foreground text-background " : "hover:bg-muted ") +
                    "text-xs px-3 py-1.5 " +
                    (i === 0 ? "rounded-l-md " : "") +
                    (i === DURATIONS.length - 1 ? "rounded-r-md " : "border-l ")
                  }
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">min free</div>
            <div className="inline-flex border rounded-md">
              {[2, 3, 4, 5].slice(0, Math.max(2, selectedSlugs.length - 0)).map((n, i, arr) => {
                if (n > selectedSlugs.length) return null;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMinRequired(n)}
                    className={
                      (n === minRequired ? "bg-foreground text-background " : "hover:bg-muted ") +
                      "text-xs px-3 py-1.5 " +
                      (i === 0 ? "rounded-l-md " : "border-l ") +
                      (i === arr.length - 1 ? "rounded-r-md " : "")
                    }
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="text-xs">
            <div className="text-muted-foreground mb-1">from</div>
            <Input
              type="datetime-local"
              value={toLocalInputValue(fromIso)}
              onChange={(e) => setFromIso(new Date(e.target.value).toISOString())}
              className="h-8 text-xs"
            />
          </label>
          <label className="text-xs">
            <div className="text-muted-foreground mb-1">to</div>
            <Input
              type="datetime-local"
              value={toLocalInputValue(toIso)}
              onChange={(e) => setToIso(new Date(e.target.value).toISOString())}
              className="h-8 text-xs"
            />
          </label>
          <Button onClick={search} disabled={pending || selectedSlugs.length < 2}>
            {pending ? "searching…" : "find times"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>

      {/* results */}
      {result && (
        <section className="space-y-6">
          {result.windows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              no shared windows found in this range. try a shorter duration, broader range, or fewer
              members.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.freeCount}>
              <h3 className="text-sm font-medium mb-2">
                {g.freeCount === selectedSlugs.length
                  ? `all ${g.freeCount} free`
                  : `${g.freeCount} of ${selectedSlugs.length} free`}
                <span className="ml-2 text-xs text-muted-foreground">
                  {g.rows.length} option{g.rows.length === 1 ? "" : "s"}
                </span>
              </h3>
              <ul className="space-y-1">
                {g.rows.slice(0, 30).map((row) => (
                  <li key={row.start}>
                    <button
                      type="button"
                      onClick={() => openBookingDialog(row)}
                      className="w-full text-left rounded border px-3 py-2 hover:bg-muted text-sm flex items-center justify-between gap-3"
                    >
                      <span>{fmtTimeRange(row.start, row.end)}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.freeSlugs.join(", ")}
                        {row.missingSlugs.length > 0 && (
                          <span className="ml-2 text-red-400">
                            no {row.missingSlugs.join(", ")}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {g.rows.length > 30 && (
                <p className="text-xs text-muted-foreground mt-1">
                  + {g.rows.length - 30} more — narrow the range to see them
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* booking dialog */}
      <Dialog
        open={bookingRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBookingRow(null);
            setBookOk(null);
            setBookErr(null);
          }
        }}
      >
        <DialogContent>
          {bookingRow && (
            <>
              <DialogHeader>
                <DialogTitle>schedule team meeting</DialogTitle>
                <DialogDescription>
                  {fmtDateTime(bookingRow.start)} – {fmtTimeRange(bookingRow.start, bookingRow.end).split("·")[1]?.trim()}
                </DialogDescription>
              </DialogHeader>
              {bookOk ? (
                <div className="space-y-3 text-sm">
                  <p className="text-green-500">scheduled. invites sent.</p>
                  {bookOk.htmlLink && (
                    <p>
                      <a
                        href={bookOk.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        open in google calendar
                      </a>
                    </p>
                  )}
                  {bookOk.meetUrl && (
                    <p>
                      meet link:{" "}
                      <a
                        href={bookOk.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {bookOk.meetUrl}
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs">
                    <span className="text-muted-foreground">title</span>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="text-muted-foreground">description (optional)</span>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </label>
                  <div className="text-xs">
                    <div className="text-muted-foreground mb-1">primary host (owns event)</div>
                    <div className="flex flex-wrap gap-2">
                      {bookingRow.freeSlugs.map((slug) => (
                        <button
                          key={slug}
                          type="button"
                          onClick={() => setPrimarySlug(slug)}
                          className={
                            slug === primarySlug
                              ? "rounded-full bg-foreground text-background px-3 py-1"
                              : "rounded-full border px-3 py-1 hover:bg-muted"
                          }
                        >
                          {slug}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    attendees: {bookingRow.freeSlugs.filter((s) => s !== primarySlug).join(", ") || "(none)"}
                  </p>
                  {bookErr && <p className="text-xs text-red-500">{bookErr}</p>}
                </div>
              )}
              <DialogFooter>
                {bookOk ? (
                  <Button onClick={() => setBookingRow(null)}>done</Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setBookingRow(null)}
                      disabled={booking}
                    >
                      cancel
                    </Button>
                    <Button onClick={confirmBooking} disabled={booking}>
                      {booking ? "scheduling…" : "schedule"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Convert an ISO string to the format expected by <input type="datetime-local">,
 * which is "YYYY-MM-DDTHH:MM" in the *local* timezone.
 */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
