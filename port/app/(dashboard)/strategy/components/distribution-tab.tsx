/**
 * distribution-tab.tsx — 12-project distribution matrix.
 *
 * Filters by `?member=` URL param (set from team-pulse-strip).
 * Server component — no internal state. The pulse strip drives filtering.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DISTRIBUTION, TEAM, WV_COLOURS } from "@/lib/strategy-data";

export interface DistributionTabProps {
  memberFilter: string | null;
}

export function DistributionTab({ memberFilter }: DistributionTabProps) {
  const visible = memberFilter
    ? DISTRIBUTION.filter(
        (d) =>
          d.owner === memberFilter || d.support.includes(memberFilter),
      )
    : DISTRIBUTION;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[#273248]">
          project distribution matrix
          {memberFilter && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              · {memberFilter} owns or supports {visible.length} of {DISTRIBUTION.length}
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
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                      >
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
  );
}
