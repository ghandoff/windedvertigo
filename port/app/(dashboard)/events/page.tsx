import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { UrlTabs } from "@/app/components/url-tabs";
import { CardGridSkeleton } from "@/app/components/skeletons";
import { ConferenceIngestDialog } from "@/app/components/conference-ingest-dialog";
import { EventsGallery } from "./components/events-gallery";
import { EventsCountdown } from "./components/events-countdown";
import { EventsTable } from "./components/events-table";
import { EventsCalendarPage } from "./components/events-calendar-page";
import {
  EVENT_TYPE_OPTIONS,
  TEAM_OPTIONS,
  EVENT_STATUS_OPTIONS,
  VIEWS,
  type EventView,
} from "./constants";
import { Plus } from "lucide-react";

export const revalidate = 300;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function EventsPage(props: Props) {
  const params = await props.searchParams;

  // Legacy redirect: any link that still uses ?tab=events → strip it, stay on /events
  if (params.tab === "events") {
    const next = new URLSearchParams(
      Object.entries(params).filter(([k]) => k !== "tab") as [string, string][],
    );
    const qs = next.toString();
    redirect(`/events${qs ? `?${qs}` : ""}`);
  }

  const activeView: EventView =
    VIEWS.some((v) => v.key === params.view)
      ? (params.view as EventView)
      : "calendar";

  const viewDescriptions: Record<EventView, string> = {
    gallery:   "track upcoming events, proposal deadlines, and who should attend",
    countdown: "events sorted by CFP deadline — what's closing soon",
    table:     "bulk view and edit all events",
    calendar:  "events by date — agenda or month grid",
  };

  return (
    <>
      <PageHeader
        title="events"
        description={viewDescriptions[activeView]}
      >
        <ConferenceIngestDialog />
        <Link
          href="/events/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          add event
        </Link>
      </PageHeader>

      {/* View-switcher (paramKey="view" avoids collision with ?tab and filter params) */}
      <Suspense>
        <UrlTabs tabs={VIEWS} activeTab={activeView} paramKey="view" />
      </Suspense>

      {/* Filter bar — shared across all views */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search events..." />
          <FilterSelect paramKey="eventType"       placeholder="type"     options={EVENT_TYPE_OPTIONS} />
          <FilterSelect paramKey="whoShouldAttend" placeholder="attendee" options={TEAM_OPTIONS} />
          <FilterSelect paramKey="status"          placeholder="status"   options={EVENT_STATUS_OPTIONS} />
        </Suspense>
      </div>

      {/* ── gallery view ─────────────────────────────────────── */}
      {activeView === "gallery" && (
        <Suspense fallback={<CardGridSkeleton />}>
          <EventsGallery searchParams={params} />
        </Suspense>
      )}

      {/* ── countdown view ───────────────────────────────────── */}
      {activeView === "countdown" && (
        <Suspense fallback={<CardGridSkeleton />}>
          <EventsCountdown searchParams={params} />
        </Suspense>
      )}

      {/* ── table view ───────────────────────────────────────── */}
      {activeView === "table" && (
        <Suspense fallback={<CardGridSkeleton />}>
          <EventsTable searchParams={params} />
        </Suspense>
      )}

      {/* ── calendar view ────────────────────────────────────── */}
      {activeView === "calendar" && (
        <Suspense fallback={<CardGridSkeleton />}>
          <EventsCalendarPage searchParams={params} />
        </Suspense>
      )}
    </>
  );
}
