/**
 * PlayerLeaderboard — top players ranked by total knots.
 *
 * Shows the platform's most engaged users. Knots are harbour-wide
 * (no app dimension), so this always shows the all-platform leaders.
 * Email addresses are partially redacted for privacy in the UI.
 */

import type { PlayerRow } from "@/lib/neon/harbour-observatory";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length > 3 ? local.slice(0, 3) + "…" : local;
  return `${visible}@${domain}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

interface Props {
  players: PlayerRow[];
}

export function PlayerLeaderboard({ players }: Props) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        no knots activity yet — the leaderboard appears once users earn knots.
      </p>
    );
  }

  const maxKnots = players[0]?.knotsTotal ?? 1;

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>player</TableHead>
            <TableHead className="text-right">⚡ total</TableHead>
            <TableHead className="text-right">earned</TableHead>
            <TableHead className="text-right">spent</TableHead>
            <TableHead>last active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p, i) => {
            const barWidth = Math.round((p.knotsTotal / maxKnots) * 100);
            return (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {p.name && (
                      <p className="text-sm font-medium leading-none">{p.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{redactEmail(p.email)}</p>
                    {/* Inline mini-bar */}
                    <div className="h-1 w-24 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary/60 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {p.knotsTotal.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400 text-xs">
                  +{p.knotsEarned.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-orange-500 text-xs">
                  -{p.knotsSpent.toLocaleString()}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(p.lastActive)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
