import { Suspense } from "react";
import Link from "next/link";
import { queryEvents } from "@/lib/notion/events";
import { PageHeader } from "@/app/components/page-header";
import { SearchInput } from "@/app/components/search-input";
import { FilterSelect } from "@/app/components/filter-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, MapPin, Users, Clock } from "lucide-react";
import type { EventFilters } from "@/lib/notion/types";

export const revalidate = 300;

const TYPE_OPTIONS = [
  "Conference", "Summit", "Trade Show", "Academic Conference",
  "Awards / Ceremony", "Network Event",
] as const;

const TEAM_OPTIONS = ["Garrett", "María", "Jamie", "Lamis", "Yigal"] as const;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function EventCards({ searchParams, upcoming }: Props & { upcoming: boolean }) {
  const params = await searchParams;
  const filters: EventFilters = {};
  if (upcoming) filters.upcoming = true;
  if (params.type) filters.type = params.type as EventFilters["type"];
  if (params.whoShouldAttend) filters.whoShouldAttend = params.whoShouldAttend as EventFilters["whoShouldAttend"];
  if (params.search) filters.search = params.search;

  const { data: events } = await queryEvents(
    Object.keys(filters).length > 0 ? filters : undefined,
    { pageSize: 50 },
  );

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        no events found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {events.map((evt) => {
        const deadlineDays = daysUntil(evt.proposalDeadline?.start);
        const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14;

        return (
          <Card key={evt.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{evt.event}</CardTitle>
                {evt.type && (
                  <Badge variant="outline" className="text-xs shrink-0">{evt.type}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {evt.eventDates?.start && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {formatDate(evt.eventDates.start)}
                    {evt.eventDates.end && ` – ${formatDate(evt.eventDates.end)}`}
                  </span>
                </div>
              )}

              {evt.proposalDeadline?.start && (
                <div className={`flex items-center gap-2 ${deadlineUrgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    deadline: {formatDate(evt.proposalDeadline.start)}
                    {deadlineDays !== null && deadlineDays >= 0 && (
                      <span className="ml-1">({deadlineDays}d)</span>
                    )}
                  </span>
                </div>
              )}

              {evt.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{evt.location}</span>
                </div>
              )}

              {evt.whoShouldAttend.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {evt.whoShouldAttend.map((name) => (
                      <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {evt.quadrantRelevance.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {evt.quadrantRelevance.map((q) => (
                    <Badge key={q} variant="outline" className="text-[10px]">{q}</Badge>
                  ))}
                </div>
              )}

              {evt.whyItMatters && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {evt.whyItMatters}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1 border-t">
                <Link
                  href={`/campaigns/new?event=${evt.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  start campaign
                </Link>
                {evt.url && (
                  <a
                    href={evt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-accent hover:underline"
                  >
                    event website
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default async function EventsPage(props: Props) {
  return (
    <>
      <PageHeader
        title="events & conferences"
        description="track upcoming events, proposal deadlines, and who should attend"
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Suspense>
          <SearchInput placeholder="search events..." />
          <FilterSelect paramKey="type" placeholder="type" options={TYPE_OPTIONS} />
          <FilterSelect paramKey="whoShouldAttend" placeholder="attendee" options={TEAM_OPTIONS} />
        </Suspense>
      </div>
      <Tabs defaultValue="upcoming">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">upcoming</TabsTrigger>
          <TabsTrigger value="all">all events</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
            <EventCards searchParams={props.searchParams} upcoming={true} />
          </Suspense>
        </TabsContent>
        <TabsContent value="all">
          <Suspense fallback={<div className="text-muted-foreground py-8 text-center">loading...</div>}>
            <EventCards searchParams={props.searchParams} upcoming={false} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </>
  );
}
