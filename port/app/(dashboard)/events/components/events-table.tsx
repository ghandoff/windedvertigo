/**
 * events-table.tsx — dense sortable table for the /events table view.
 *
 * Column-sort is stored in URL params: ?sort=deadline&dir=asc.
 * Clicking a header link toggles direction and stays server-rendered — no JS
 * required for the sort itself (Next.js Link navigation).
 *
 * Phase 11 of the conference intelligence pipeline.
 */

import Link from "next/link";
import { getEventsFromSupabase } from "@/lib/supabase/events";
import {
  EventStatusBadge,
  EventLifecycleBanner,
} from "../../campaigns/components/event-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/app/components/clickable-row";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { EventTableEditCell } from "./events-table-edit-cell";
import type { ConferenceStatus } from "@/lib/notion/types";

// ── helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── sort header ────────────────────────────────────────────────────

const SORTABLE_COLS = {
  event:     "event",
  type:      "type",
  deadline:  "proposal_deadline",
  location:  "location",
  fit_score: "fit_score",
  discovered_via: "discovered_via",
} as const;

type SortKey = keyof typeof SORTABLE_COLS;

interface SortHeaderProps {
  label: string;
  colKey: SortKey;
  activeSort: string | undefined;
  activeDir: string | undefined;
  currentParams: Record<string, string | undefined>;
}

function SortHeader({ label, colKey, activeSort, activeDir, currentParams }: SortHeaderProps) {
  const isActive = activeSort === colKey;
  const nextDir  = isActive && activeDir === "asc" ? "desc" : "asc";

  // Build a URL that preserves all other params and updates sort/dir.
  const params = new URLSearchParams(
    Object.entries({ ...currentParams, sort: colKey, dir: nextDir })
      .filter(([, v]) => v !== undefined) as [string, string][],
  );

  const Icon = isActive
    ? activeDir === "asc" ? ArrowUp : ArrowDown
    : ArrowUpDown;

  return (
    <Link
      href={`?${params.toString()}`}
      className="flex items-center gap-1 group text-xs font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
    >
      {label}
      <Icon className={`h-3 w-3 ${isActive ? "text-foreground" : "opacity-40 group-hover:opacity-100"} transition-opacity`} />
    </Link>
  );
}

// ── component ──────────────────────────────────────────────────────

interface Props {
  searchParams: Record<string, string | undefined>;
}

export async function EventsTable({ searchParams }: Props) {
  const explicitStatus = searchParams.status as ConferenceStatus | undefined;
  const sortKey = (searchParams.sort ?? "event") as SortKey;
  const sortDir = (searchParams.dir === "desc" ? "desc" : "asc") as "asc" | "desc";

  // Map frontend sort key → supabase column name.
  const supabaseSortCol = SORTABLE_COLS[sortKey] ?? "event";

  const { data: events } = await getEventsFromSupabase(
    {
      ...(searchParams.eventType       && { type: searchParams.eventType }),
      ...(searchParams.whoShouldAttend && { whoShouldAttend: searchParams.whoShouldAttend }),
      ...(searchParams.search          && { search: searchParams.search }),
      ...(explicitStatus               && { status: explicitStatus }),
    },
    { pageSize: 500, sortBy: supabaseSortCol, sortDir },
  );

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no events match these filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">
              <SortHeader label="event" colKey="event" activeSort={searchParams.sort} activeDir={searchParams.dir} currentParams={searchParams} />
            </TableHead>
            <TableHead className="w-[110px]">
              <SortHeader label="type" colKey="type" activeSort={searchParams.sort} activeDir={searchParams.dir} currentParams={searchParams} />
            </TableHead>
            <TableHead className="w-[100px]">status</TableHead>
            <TableHead className="w-[100px]">lifecycle</TableHead>
            <TableHead className="w-[160px]">
              <SortHeader label="deadline" colKey="deadline" activeSort={searchParams.sort} activeDir={searchParams.dir} currentParams={searchParams} />
            </TableHead>
            <TableHead className="min-w-[120px]">
              <SortHeader label="location" colKey="location" activeSort={searchParams.sort} activeDir={searchParams.dir} currentParams={searchParams} />
            </TableHead>
            <TableHead className="w-[100px]">owner</TableHead>
            <TableHead className="w-[90px]">
              <SortHeader label="fit" colKey="fit_score" activeSort={searchParams.sort} activeDir={searchParams.dir} currentParams={searchParams} />
            </TableHead>
            <TableHead className="w-[110px]">
              <SortHeader label="source" colKey="discovered_via" activeSort={searchParams.sort} activeDir={searchParams.dir} currentParams={searchParams} />
            </TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((evt) => {
            const days = daysUntil(evt.proposalDeadline?.start);
            const deadlineUrgent = days !== null && days >= 0 && days <= 14;

            return (
              <ClickableRow key={evt.id} href={`/events/${evt.id}/edit`}>
                {/* Name + cancelled banner */}
                <TableCell className="font-medium text-sm">
                  <EventLifecycleBanner lifecycle={evt.lifecycleState} />
                  {evt.event}
                </TableCell>

                <TableCell>
                  {evt.type && (
                    <Badge variant="outline" className="text-xs whitespace-nowrap">{evt.type}</Badge>
                  )}
                </TableCell>

                <TableCell>
                  <EventStatusBadge status={evt.status} />
                </TableCell>

                <TableCell>
                  <Badge variant="secondary" className="text-xs capitalize whitespace-nowrap">
                    {evt.lifecycleState ?? "upcoming"}
                  </Badge>
                </TableCell>

                <TableCell>
                  {evt.proposalDeadline?.start ? (
                    <span className={`text-xs ${deadlineUrgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {formatDate(evt.proposalDeadline.start)}
                      {days !== null && days >= 0 && (
                        <span className="ml-1 text-[10px]">({days}d)</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {evt.location || "—"}
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {evt.ownerUserId ?? "—"}
                </TableCell>

                <TableCell>
                  {evt.fitScore && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] whitespace-nowrap ${
                        evt.fitScore === "high fit"
                          ? "border-green-400 text-green-700 dark:text-green-400"
                          : evt.fitScore === "medium fit"
                          ? "border-amber-400 text-amber-700 dark:text-amber-400"
                          : "border-muted text-muted-foreground"
                      }`}
                    >
                      {evt.fitScore}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-xs text-muted-foreground capitalize">
                  {evt.discoveredVia?.replace(/-/g, " ") ?? "manual"}
                </TableCell>

                {/* Edit icon — click stops row navigation (client component handles stopPropagation) */}
                <EventTableEditCell href={`/events/${evt.id}/edit`} />
              </ClickableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
