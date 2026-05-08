/**
 * strategy-tab.tsx — default tab.
 * Executive narrative + 90-day phases + budget + cadence.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BUDGET,
  BUDGET_TOTAL,
  PHASES,
  WEEKLY_CADENCE,
} from "@/lib/strategy-data";

export function StrategyTab() {
  return (
    <div className="space-y-6">
      {/* exec narrative */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#273248]">
            market positioning + revenue plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            winded.vertigo is at an inflection point. we have products, clients,
            and a platform — what we lack is visibility outside our warm network.
            the gap between where we are ($34k cash, 4-month runway) and where we
            need to be ($500k in signed contracts by september) is real but not
            impossible.
          </p>
          <p>
            this strategy treats marketing as a direct revenue function. every
            campaign, every post, every email is tied to a specific contract
            opportunity or pipeline stage. we are not building brand in a
            vacuum — we are building{" "}
            <span className="text-[#b15043] font-medium">credibility</span> in
            the communities where our clients live.
          </p>
          <p>
            three layers:{" "}
            <strong className="text-foreground">immediate activation</strong>{" "}
            (may: warm network + harbour launch),{" "}
            <strong className="text-foreground">amplification</strong>{" "}
            (june–july: conference presence + community),{" "}
            <strong className="text-foreground">scaling</strong> (aug–sept:
            convert wins to retainers + product revenue).
          </p>
        </CardContent>
      </Card>

      {/* 90-day phases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#273248]">
            90-day phases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PHASES.map((phase) => (
              <div
                key={phase.month}
                className={`rounded-lg border p-4 ${phase.color}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {phase.month}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-current"
                  >
                    {phase.label}
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {phase.milestones.map((m) => (
                    <li
                      key={m}
                      className="text-xs flex items-start gap-1.5"
                    >
                      <span className="mt-0.5 shrink-0">·</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* budget + cadence side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#273248]">budget overview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>category</TableHead>
                  <TableHead className="tabular-nums text-right">amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BUDGET.map((row) => (
                  <TableRow key={row.category} className="text-sm">
                    <TableCell>
                      <div className="font-medium">{row.category}</div>
                      <div className="text-[10px] text-muted-foreground">{row.detail}</div>
                    </TableCell>
                    <TableCell className="tabular-nums text-right font-medium text-xs">
                      {row.amount}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/30">
                  <TableCell>total</TableCell>
                  <TableCell className="tabular-nums text-right">
                    {BUDGET_TOTAL}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t bg-muted/20 text-[10px] text-muted-foreground">
              funded from PRME revenue ($145k contract · $48k received)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#273248]">weekly cadence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {WEEKLY_CADENCE.map((row, i) => (
              <div key={row.when}>
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium shrink-0">{row.when}</span>
                  <span className="text-muted-foreground text-right">{row.what}</span>
                </div>
                {i < WEEKLY_CADENCE.length - 1 && (
                  <div className="border-t border-border/50 mt-2" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
