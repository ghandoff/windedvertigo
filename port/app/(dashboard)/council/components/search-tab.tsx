/**
 * search-tab.tsx — plain-text search across meeting summaries + action items.
 *
 * Submitted via a GET form so no client JS is needed. URL becomes
 * /council?tab=search&q=foo and the page re-renders server-side.
 *
 * pgvector / semantic transcript search lands in a future W4 push when
 * demand emerges; today's LIKE search covers the common "find that thing
 * about X" case adequately.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MessageSquare, FileText, Sparkles } from "lucide-react";
import type { Meeting } from "@/lib/supabase/meetings";
import type { MeetingActionItem } from "@/lib/supabase/meeting-action-items";

export interface SearchTabProps {
  query: string;
  meetingMatches: Meeting[];
  actionMatches: MeetingActionItem[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SearchTab({ query, meetingMatches, actionMatches }: SearchTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[#273248] inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            search across meetings + actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/council" method="get" className="flex gap-2">
            <input type="hidden" name="tab" value="search" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="e.g. PRME pricing, IDB deadline, lamis outreach…"
              className="flex-1 px-3 py-1.5 text-sm rounded border border-border bg-background"
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm rounded border border-[#b15043] text-[#b15043] hover:bg-[#b15043]/5"
            >
              search
            </button>
          </form>
          <p className="text-[10px] text-muted-foreground mt-2">
            text-only match across meeting titles + summaries + action items + context.
            transcript semantic search (pgvector) lands in a future push.
          </p>
        </CardContent>
      </Card>

      {!query.trim() ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            type a query above to search.
          </CardContent>
        </Card>
      ) : meetingMatches.length === 0 && actionMatches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-2">
            <p>no matches for &ldquo;{query}&rdquo;.</p>
            <p className="text-xs inline-flex items-center gap-1.5 justify-center">
              <MessageSquare className="h-3 w-3" />
              for cross-meeting reasoning, ask wv-claw — it can summarize across multiple meetings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {meetingMatches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#273248] inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  meetings ({meetingMatches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {meetingMatches.map((m) => (
                  <Link
                    key={m.id}
                    href={`/council/${m.id}`}
                    className="block py-2 border-b border-border/30 last:border-0 hover:bg-muted/20"
                  >
                    <p className="text-sm text-[#273248]">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(m.startedAt ?? m.createdAt)} · {m.capturedVia}
                    </p>
                    {m.summary && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                        {m.summary}
                      </p>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {actionMatches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#273248] inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#43b187]" />
                  action items ({actionMatches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {actionMatches.map((a) => (
                  <Link
                    key={a.id}
                    href={`/council/${a.meetingId}`}
                    className="block py-2 border-b border-border/30 last:border-0 hover:bg-muted/20"
                  >
                    <p className="text-sm text-[#273248]">{a.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      {a.ownerName && <span>owner: {a.ownerName}</span>}
                      {a.deadline && <span>due: {a.deadline}</span>}
                      <span>status: {a.status}</span>
                    </div>
                    {a.context && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                        {a.context}
                      </p>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
