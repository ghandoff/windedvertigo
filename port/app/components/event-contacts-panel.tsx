"use client";

/**
 * EventContactsPanel — collapsible "people at this event" section that
 * sits on the campaigns/events tile.
 *
 * Default: collapsed. Shows a one-line summary
 *   "people: 0 target · 0 met · 0 followed-up"
 * Expanded: chips, list of linked contacts, and a "+ add target contact"
 * combobox that searches /api/contacts?search=...
 *
 * Phase 7 (conference intelligence).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ContactAttendanceStatus,
  EventContactWithDetails,
} from "@/lib/supabase/event-contacts";

interface ContactSearchResult {
  id: string;
  name: string;
  role?: string;
}

interface ContactsApiResponse {
  data: ContactSearchResult[];
}

interface Props {
  eventId: string;
  eventName: string;
  eventEndDate?: string | null;
}

const STATUS_LABEL: Record<ContactAttendanceStatus, string> = {
  target: "target",
  met: "met",
  followed_up: "followed-up",
  dropped: "dropped",
};

const STATUS_CHIP_CLASS: Record<ContactAttendanceStatus, string> = {
  target: "bg-neutral-100 text-neutral-700 border-neutral-200",
  met: "bg-teal-100 text-teal-700 border-teal-200",
  followed_up: "bg-teal-200 text-teal-900 border-teal-300",
  dropped: "bg-muted text-muted-foreground border-border",
};

export function EventContactsPanel({ eventId, eventName, eventEndDate }: Props) {
  // eventEndDate / eventName aren't used yet (auto-task creation is deferred)
  // — keep them on the API so the parent agent can wire the consolidation
  // pass without re-touching this file.
  void eventName;
  void eventEndDate;

  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<EventContactWithDetails[]>([]);
  const [counts, setCounts] = useState({
    target: 0,
    met: 0,
    followedUp: 0,
    dropped: 0,
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const recomputeCounts = useCallback((rows: EventContactWithDetails[]) => {
    const c = { target: 0, met: 0, followedUp: 0, dropped: 0 };
    for (const r of rows) {
      if (r.status === "target") c.target += 1;
      else if (r.status === "met") c.met += 1;
      else if (r.status === "followed_up") c.followedUp += 1;
      else if (r.status === "dropped") c.dropped += 1;
    }
    setCounts(c);
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/event-contacts?eventId=${encodeURIComponent(eventId)}`,
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { contacts: EventContactWithDetails[] };
      setContacts(json.contacts ?? []);
      recomputeCounts(json.contacts ?? []);
      setLoaded(true);
    } catch (err) {
      console.error("[event-contacts] panel refetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId, recomputeCounts]);

  // Load lazily when first opened — avoids hammering the API for every
  // tile on the page.
  useEffect(() => {
    if (open && !loaded) {
      void refetch();
    }
  }, [open, loaded, refetch]);

  async function handleStatusChange(
    id: string,
    status: ContactAttendanceStatus,
  ) {
    try {
      const res = await fetch(`/api/event-contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await refetch();
    } catch (err) {
      console.error("[event-contacts] status change failed:", err);
    }
  }

  async function handleRemove(id: string) {
    try {
      const res = await fetch(`/api/event-contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await refetch();
    } catch (err) {
      console.error("[event-contacts] remove failed:", err);
    }
  }

  async function handleAdd(contactId: string) {
    setAddError(null);
    try {
      const res = await fetch("/api/event-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, contactId }),
      });
      if (res.status === 409) {
        setAddError("already linked");
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      setAdding(false);
      await refetch();
    } catch (err) {
      console.error("[event-contacts] add failed:", err);
      setAddError("failed to add");
    }
  }

  return (
    <div className="border-t border-border/50 mt-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          people: {counts.target} target · {counts.met} met ·{" "}
          {counts.followedUp} followed-up
          {counts.dropped > 0 ? ` · ${counts.dropped} dropped` : ""}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {/* status chips */}
          <div className="flex flex-wrap gap-1.5">
            <StatusChip status="target" count={counts.target} />
            <StatusChip status="met" count={counts.met} />
            <StatusChip status="followed_up" count={counts.followedUp} />
            {counts.dropped > 0 ? (
              <StatusChip status="dropped" count={counts.dropped} />
            ) : null}
          </div>

          {/* list */}
          {loading && contacts.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              loading…
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              no contacts linked yet — add a target below.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  row={c}
                  onChange={(s) => handleStatusChange(c.id, s)}
                  onRemove={() => handleRemove(c.id)}
                />
              ))}
            </ul>
          )}

          {/* add target picker */}
          {adding ? (
            <ContactPicker
              excludeIds={contacts.map((c) => c.contactId)}
              onPick={handleAdd}
              onCancel={() => {
                setAdding(false);
                setAddError(null);
              }}
              errorMessage={addError}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              add target contact
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── subcomponents ─────────────────────────────────────────────────

function StatusChip({
  status,
  count,
}: {
  status: ContactAttendanceStatus;
  count: number;
}) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-normal ${STATUS_CHIP_CLASS[status]}`}
    >
      {count} {STATUS_LABEL[status]}
    </Badge>
  );
}

function ContactRow({
  row,
  onChange,
  onRemove,
}: {
  row: EventContactWithDetails;
  onChange: (status: ContactAttendanceStatus) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Badge
          variant="outline"
          className={`text-[10px] font-normal shrink-0 ${STATUS_CHIP_CLASS[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </Badge>
        <span className="truncate">
          <span className="font-medium">{row.contactName}</span>
          {row.contactRole ? (
            <span className="text-muted-foreground">, {row.contactRole}</span>
          ) : null}
          {row.contactOrgName ? (
            <span className="text-muted-foreground"> · {row.contactOrgName}</span>
          ) : null}
        </span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {row.status !== "met" ? (
          <ActionBtn label="mark met" onClick={() => onChange("met")} />
        ) : null}
        {row.status !== "followed_up" ? (
          <ActionBtn
            label="mark followed-up"
            onClick={() => onChange("followed_up")}
          />
        ) : null}
        {row.status !== "dropped" ? (
          <ActionBtn label="drop" onClick={() => onChange("dropped")} />
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label="remove"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}

function ActionBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-1.5 py-0.5 text-[10px] rounded hover:bg-muted text-muted-foreground hover:text-foreground"
    >
      {label}
    </button>
  );
}

function ContactPicker({
  excludeIds,
  onPick,
  onCancel,
  errorMessage,
}: {
  excludeIds: string[];
  onPick: (contactId: string) => void;
  onCancel: () => void;
  errorMessage: string | null;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/contacts?search=${encodeURIComponent(search.trim())}&pageSize=10`)
        .then((r) => r.json() as Promise<ContactsApiResponse>)
        .then((d) => {
          const items = (d.data ?? []).filter(
            (c) => !excludeIds.includes(c.id),
          );
          setResults(items);
        })
        .catch((err) => {
          console.error("[event-contacts] picker search failed:", err);
          setResults([]);
        })
        .finally(() => setSearching(false));
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, excludeIds]);

  return (
    <div className="space-y-1.5 rounded-md border border-border p-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search contacts…"
          className="h-7 text-xs"
        />
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          aria-label="cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {errorMessage ? (
        <p className="text-[10px] text-destructive">{errorMessage}</p>
      ) : null}
      {searching ? (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          searching…
        </div>
      ) : results.length > 0 ? (
        <ul className="space-y-0.5 max-h-40 overflow-y-auto">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c.id)}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted"
              >
                <span className="font-medium">{c.name}</span>
                {c.role ? (
                  <span className="text-muted-foreground">, {c.role}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : search.trim().length >= 2 ? (
        <p className="text-[10px] text-muted-foreground italic">
          no matches.
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground italic">
          type at least 2 characters.
        </p>
      )}
    </div>
  );
}
