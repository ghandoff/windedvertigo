import Link from "next/link";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RfpOpportunity } from "@/lib/notion/types";

export const revalidate = 300;

const TERMINAL_STATUSES: RfpOpportunity["status"][] = ["won", "lost", "no-go", "missed deadline"];

/** Days between today (midnight) and a date string. Negative = in the past. */
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function UrgencyBadge({ days }: { days: number }) {
  if (days <= 7) {
    return (
      <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200">
        {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
      </Badge>
    );
  }
  if (days <= 30) {
    return (
      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
        {days}d left
      </Badge>
    );
  }
  if (days <= 60) {
    return (
      <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
        {days}d left
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
      {days}d left
    </Badge>
  );
}

export default async function DeadlinesPage() {
  const { data: all } = await queryRfpOpportunities(undefined, { pageSize: 100 });

  const upcoming = all
    .filter((rfp) => {
      if (!rfp.dueDate?.start) return false;
      if (TERMINAL_STATUSES.includes(rfp.status)) return false;
      const days = daysUntil(rfp.dueDate.start);
      // Keep items within a 7-day grace window into the past
      return days >= -7;
    })
    .sort((a, b) => {
      const da = a.dueDate!.start;
      const db = b.dueDate!.start;
      return da < db ? -1 : da > db ? 1 : 0;
    });

  return (
    <>
      <PageHeader
        title="deadline tracker"
        description="upcoming RFP due dates — sorted soonest first"
      />

      <div className="mb-4">
        <Link
          href="/rfp-radar"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← back to RFP lighthouse
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          no upcoming deadlines
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>opportunity</TableHead>
                <TableHead>status</TableHead>
                <TableHead>due date</TableHead>
                <TableHead>urgency</TableHead>
                <TableHead>orgs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.map((rfp) => {
                const days = daysUntil(rfp.dueDate!.start);
                return (
                  <TableRow key={rfp.id}>
                    <TableCell className="font-medium">
                      {rfp.url ? (
                        <a
                          href={rfp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {rfp.opportunityName}
                        </a>
                      ) : (
                        rfp.opportunityName
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {rfp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(rfp.dueDate!.start)}
                    </TableCell>
                    <TableCell>
                      <UrgencyBadge days={days} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rfp.organizationIds.length > 0
                        ? `${rfp.organizationIds.length} org${rfp.organizationIds.length !== 1 ? "s" : ""}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
