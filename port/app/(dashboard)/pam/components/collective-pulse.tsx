import Link from "next/link";
import { Briefcase, Megaphone, BookOpen, Activity, ArrowUpRight, CircleCheck, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { memberStyle } from "@/lib/pam/members";
import type { CollectivePulse, PulseSignal } from "@/lib/pam/pulse";

const SIGNAL_ICON = {
  biz: Briefcase,
  mo: Megaphone,
  carl: BookOpen,
  opsy: Activity,
} as const;

function Avatar({ who, size = 24 }: { who: string; size?: number }) {
  const m = memberStyle(who);
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full font-medium shrink-0"
      style={{ width: size, height: size, background: m.bg, color: m.fg, fontSize: size * 0.42 }}
    >
      {m.initial}
    </span>
  );
}

function SignalCard({ s }: { s: PulseSignal }) {
  const Icon = SIGNAL_ICON[s.key];
  const colour = memberStyle(s.key).fg;
  return (
    <Link
      href={s.href}
      className="rounded-lg border border-border bg-card p-2.5 hover:bg-muted/40 transition-colors group"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color: colour }} />
        <span className="text-xs font-medium">{s.key}</span>
        <ArrowUpRight className="h-3 w-3 ml-auto text-muted-foreground/50 group-hover:text-muted-foreground" />
      </div>
      <p className={cn("text-xs", s.tone === "danger" ? "text-red-600" : s.tone === "ok" ? "text-emerald-600" : "")}>
        {s.line1}
      </p>
      <p className="text-[11px] text-muted-foreground">{s.line2}</p>
    </Link>
  );
}

export function CollectivePulse({ pulse }: { pulse: CollectivePulse }) {
  const maxSpend = Math.max(0.01, ...pulse.agents.map((a) => a.spendUsd));

  return (
    <div className="space-y-6">
      {/* cross-system signals */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">across the collective</p>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {pulse.signals.map((s) => (
            <SignalCard key={s.key} s={s} />
          ))}
        </div>
      </div>

      {/* people */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-2 border-t border-border pt-3">this week · people</p>
        {pulse.people.length === 0 ? (
          <p className="text-xs text-muted-foreground">no commitments in this cycle yet.</p>
        ) : (
          <div className="space-y-1.5">
            {pulse.people.map((p) => (
              <div key={p.who} className="flex items-center gap-2.5">
                <Avatar who={p.who} size={22} />
                <span className="text-xs font-medium w-16 capitalize">{p.who}</span>
                <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1">
                  <CircleCheck className="h-3 w-3" /> {p.done} done
                </span>
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <CircleDot className="h-3 w-3" /> {p.inFlight} in flight
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* agents */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-2 border-t border-border pt-3">
          this week · agents · ${pulse.totalSpendUsd.toFixed(2)} in tokens
        </p>
        <div className="space-y-1.5">
          {pulse.agents.map((a) => {
            const m = memberStyle(a.agent);
            return (
              <div key={a.agent} className="flex items-center gap-2.5">
                <Avatar who={a.agent} size={22} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-medium capitalize">{a.agent}</span>{" "}
                    <span className="text-muted-foreground">{a.output}</span>
                  </p>
                  <div className="mt-1 h-[3px] rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((a.spendUsd / maxSpend) * 100)}%`, background: m.fg }}
                    />
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
                  ${a.spendUsd.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
