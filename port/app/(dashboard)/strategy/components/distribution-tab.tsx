/**
 * distribution-tab.tsx — 12-activity distribution matrix + live PM project portfolio.
 *
 * Filters by `?member=` URL param (set from team-pulse-strip).
 * Server component — no internal state. The pulse strip drives filtering.
 *
 * Bi-directional wiring:
 *   • When a distribution row has `linkedProjectId`, its name links to /projects/[id].
 *   • Below the matrix, the "active project portfolio" section shows live PM project
 *     data from Supabase (passed as `pmProjects`), each linking back to its detail page.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TEAM, WV_COLOURS, type DistributionProject } from "@/lib/strategy-data";
import type { Project } from "@/lib/notion/types";

const PROJECT_STATUS_COLORS: Record<string, string> = {
  "in progress":  "bg-blue-100 text-blue-700 border-blue-200",
  "in queue":     "bg-gray-100 text-gray-600 border-gray-200",
  "under review": "bg-amber-100 text-amber-700 border-amber-200",
  complete:       "bg-green-100 text-green-700 border-green-200",
  suspended:      "bg-orange-100 text-orange-700 border-orange-200",
  icebox:         "bg-slate-100 text-slate-500 border-slate-200",
  cancelled:      "bg-red-100 text-red-600 border-red-200",
  planning:       "bg-purple-100 text-purple-700 border-purple-200",
};

export interface DistributionTabProps {
  memberFilter: string | null;
  /** Distribution items fetched from Supabase by strategy/page.tsx. */
  items: DistributionProject[];
  /** Live active PM projects from Supabase — drives the "active portfolio" section. */
  pmProjects: Project[];
}

export function DistributionTab({ memberFilter, items, pmProjects }: DistributionTabProps) {
  const visible = memberFilter
    ? items.filter(
        (d) =>
          d.owner === memberFilter || d.support.includes(memberFilter),
      )
    : items;

  return (
    <div className="space-y-6">
      {/* ── distribution matrix ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#273248]">
            project distribution matrix
            {memberFilter && (
              <span className="text-xs text-muted-foreground font-normal ml-2">
                · {memberFilter} owns or supports {visible.length} of {items.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-8 text-center">
              no projects assigned to {memberFilter}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>project</TableHead>
                  <TableHead>owner</TableHead>
                  <TableHead>support</TableHead>
                  <TableHead>next action</TableHead>
                  <TableHead>deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => {
                  const ownerMember = TEAM.find((t) => t.name === p.owner);
                  const ownerColour = ownerMember
                    ? WV_COLOURS[ownerMember.colour]
                    : "#aaa";
                  return (
                    <TableRow key={p.id} className="text-sm">
                      <TableCell className="font-medium">
                        {p.linkedProjectId ? (
                          <Link
                            href={`/projects/${p.linkedProjectId}`}
                            className="hover:underline hover:text-[#273248] transition-colors inline-flex items-center gap-1"
                          >
                            {p.name}
                            <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          </Link>
                        ) : (
                          p.name
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: ownerColour }}
                          />
                          {p.owner}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.support.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {p.support.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">solo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {p.nextAction}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground tabular-nums">
                        {p.deadline}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── active project portfolio — live from Supabase ── */}
      {pmProjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-[#273248]">
                active project portfolio
                <span className="text-xs text-muted-foreground font-normal ml-2">· live</span>
              </CardTitle>
              <Link
                href="/projects"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                all projects <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>project</TableHead>
                  <TableHead>type</TableHead>
                  <TableHead>status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pmProjects.map((proj) => {
                  const statusColor = PROJECT_STATUS_COLORS[proj.status] ?? "bg-gray-100 text-gray-600 border-gray-200";
                  return (
                    <TableRow key={proj.id} className="text-sm">
                      <TableCell className="font-medium">
                        <Link
                          href={`/projects/${proj.id}`}
                          className="hover:underline hover:text-[#273248] transition-colors inline-flex items-center gap-1"
                        >
                          {proj.project}
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        {proj.type && (
                          <span className="text-xs text-muted-foreground">{proj.type}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                          {proj.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
