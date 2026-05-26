/**
 * /council — Council meeting hub (W1).
 *
 * Four tabs:
 *   Upcoming   — meetings in the next 7 days, soonest first (default)
 *   Recent     — past meetings, newest first
 *   My Actions — current user's open action items across all meetings
 *   Search     — text search across meetings + actions
 *
 * Data lives in the Council Supabase tables (meetings, meeting_action_items,
 * meeting_transcripts) written by lib/meeting-ingest/ingest-to-supabase.
 * During the W1 trial period (~2 weeks), data is dual-written alongside
 * the legacy Notion work_item path.
 */

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  listRecentMeetings,
  listUpcomingMeetings,
  searchMeetings,
} from "@/lib/supabase/meetings";
import {
  listOpenActionsForOwner,
  searchActionItems,
} from "@/lib/supabase/meeting-action-items";
import Link from "next/link";
import { Mic } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { RecentTab } from "./components/recent-tab";
import { MyActionsTab } from "./components/my-actions-tab";
import { SearchTab } from "./components/search-tab";
import { VisibilityFilterPills } from "./components/visibility-filter-pills";

export const metadata: Metadata = {
  title: "council — the port",
  description: "meeting summaries, action items, and decisions for the w.v collective.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "upcoming", label: "upcoming" },
  { key: "recent",   label: "recent" },
  { key: "actions",  label: "my actions" },
  { key: "search",   label: "search" },
];

export default async function CouncilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab = TABS.find((t) => t.key === tabParam)?.key ?? "upcoming";
  const searchQuery = typeof sp.q === "string" ? sp.q : "";

  // Visibility filter: all (default) | team | private. Honored on the
  // Upcoming + Recent tabs to let a user narrow to just team-shared meetings
  // or just their own private ones.
  const visParam = typeof sp.visibility === "string" ? sp.visibility : "all";
  const visibilityMode: "all" | "team" | "private" =
    visParam === "team" || visParam === "private" ? visParam : "all";

  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? null;

  // Per-tab fetches — keep them targeted so the page stays fast.
  // Pass userEmail to the meeting list calls so visibility=private rows
  // owned by other members are filtered out automatically.
  const [upcoming, recent, myActions, meetingMatches, actionMatches] = await Promise.all([
    activeTab === "upcoming" ? listUpcomingMeetings(25, 7, userEmail, visibilityMode) : Promise.resolve([]),
    activeTab === "recent" ? listRecentMeetings(25, userEmail, visibilityMode) : Promise.resolve([]),
    activeTab === "actions" && userEmail
      ? listOpenActionsForOwner(userEmail)
      : Promise.resolve([]),
    activeTab === "search" && searchQuery
      ? searchMeetings(searchQuery, 15, userEmail)
      : Promise.resolve([]),
    activeTab === "search" && searchQuery
      ? searchActionItems(searchQuery, 15)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="council"
        description="meeting summaries · action items · decisions. ingested from notion AI meeting notes (trial) plus in-browser /transcribe captures."
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <UrlTabs tabs={TABS} activeTab={activeTab} />
        <Link
          href="/transcribe"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#cb7858] text-[#cb7858] hover:bg-[#cb7858]/5 transition-colors"
          title="record a FaceTime / Zoom / in-person meeting in-browser"
        >
          <Mic className="h-3.5 w-3.5" />
          transcribe a meeting
        </Link>
      </div>

      {(activeTab === "upcoming" || activeTab === "recent") && (
        <VisibilityFilterPills
          active={visibilityMode}
          showPrivate={!!userEmail}
        />
      )}

      {activeTab === "upcoming" && (
        <RecentTab
          meetings={upcoming}
          mode="upcoming"
        />
      )}
      {activeTab === "recent" && (
        <RecentTab
          meetings={recent}
          mode="recent"
        />
      )}
      {activeTab === "actions" && (
        <MyActionsTab userEmail={userEmail} actions={myActions} />
      )}
      {activeTab === "search" && (
        <SearchTab
          query={searchQuery}
          meetingMatches={meetingMatches}
          actionMatches={actionMatches}
        />
      )}

      <div className="text-[10px] text-muted-foreground space-y-0.5 px-1 pt-4">
        <p>data source: meetings + meeting_action_items + meeting_transcripts (supabase)</p>
        <p>during the W1 trial, notion AI meeting notes continue running in parallel</p>
      </div>
    </div>
  );
}
