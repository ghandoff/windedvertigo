import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { kvGet } from "@/lib/kv";
import { getSupabase } from "@/lib/supabase/client";
import type { ContentItem, CampaignMetrics, PipelineSummary } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────
   Static fallback data
   ───────────────────────────────────────────────────────────────── */

const PLACEHOLDER_CONTENT: ContentItem[] = [
  {
    id: "placeholder-1",
    title: "why creative confidence is a business skill",
    channel: "linkedin",
    scheduledDate: "2026-05-05",
    status: "draft",
  },
  {
    id: "placeholder-2",
    title: "whirlpool #12 recap — play as method",
    channel: "newsletter",
    scheduledDate: "2026-05-07",
    status: "review",
  },
  {
    id: "placeholder-3",
    title: "creaseworks spring cohort — open enrollment",
    channel: "bluesky",
    scheduledDate: "2026-05-09",
    status: "approved",
  },
  {
    id: "placeholder-4",
    title: "IDB Salvador milestone post",
    channel: "linkedin",
    scheduledDate: "2026-05-12",
    status: "scheduled",
  },
  {
    id: "placeholder-5",
    title: "learning design as competitive advantage",
    channel: "blog",
    scheduledDate: "2026-05-15",
    status: "draft",
  },
];

const EMPTY_PIPELINE: PipelineSummary = {
  identified: 0,
  pitched: 0,
  proposal: 0,
  won: 0,
  lost: 0,
};

/* ─────────────────────────────────────────────────────────────────
   Data helpers
   ───────────────────────────────────────────────────────────────── */

async function fetchContentItems(): Promise<ContentItem[]> {
  try {
<<<<<<< HEAD
    const { data } = await getSupabase()
=======
    const sb = getSupabase();
    if (!sb) return PLACEHOLDER_CONTENT;
    const { data } = await sb
>>>>>>> 260fe89 (fix(ops): align supabase client to getSupabase() null-return pattern)
      .from("social_drafts")
      .select("notion_page_id, content, platform, status, scheduled_for")
      .order("scheduled_for", { ascending: true })
      .limit(20);

    if (!data || data.length === 0) return PLACEHOLDER_CONTENT;

    return data.map((row) => ({
      id: row.notion_page_id ?? crypto.randomUUID(),
      title: (row.content ?? "").slice(0, 80) || "untitled draft",
      channel: row.platform ?? "unknown",
      body: row.content ?? undefined,
      scheduledDate: row.scheduled_for ?? undefined,
      status: row.status ?? "draft",
    }));
  } catch {
    return PLACEHOLDER_CONTENT;
  }
}

/* ─────────────────────────────────────────────────────────────────
   Status badge helpers
   ───────────────────────────────────────────────────────────────── */

function contentStatusStyle(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status.toLowerCase()) {
    case "draft":
      return {
        bg: "bg-white/5",
        text: "text-ops-text-muted",
        border: "border-white/10",
      };
    case "review":
      return {
        bg: "bg-amber-400/10",
        text: "text-amber-400",
        border: "border-amber-400/20",
      };
    case "approved":
      return {
        bg: "bg-emerald-400/10",
        text: "text-emerald-400",
        border: "border-emerald-400/20",
      };
    case "published":
      return {
        bg: "bg-blue-400/10",
        text: "text-blue-400",
        border: "border-blue-400/20",
      };
    case "scheduled":
      return {
        bg: "bg-purple-400/10",
        text: "text-purple-400",
        border: "border-purple-400/20",
      };
    default:
      return {
        bg: "bg-white/5",
        text: "text-ops-text-muted",
        border: "border-white/10",
      };
  }
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    linkedin: "LinkedIn",
    bluesky: "Bluesky",
    twitter: "Twitter",
    newsletter: "Newsletter",
    blog: "Blog",
    instagram: "Instagram",
  };
  return map[channel.toLowerCase()] ?? channel;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/* ─────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────── */

export default async function MarketingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [contentItems, campaignMetrics, pipelineSummary] = await Promise.all([
    fetchContentItems(),
    kvGet<CampaignMetrics[]>("marketing:campaign-metrics").then(
      (d) => d ?? ([] as CampaignMetrics[])
    ),
    kvGet<PipelineSummary>("marketing:pipeline-summary").then(
      (d) => d ?? EMPTY_PIPELINE
    ),
  ]);

  const pipelineStages: { label: string; key: keyof Omit<PipelineSummary, "totalValue">; color: string }[] = [
    { label: "identified", key: "identified", color: "bg-ops-text-muted/30" },
    { label: "pitched", key: "pitched", color: "bg-blue-400/40" },
    { label: "proposal", key: "proposal", color: "bg-amber-400/40" },
    { label: "won", key: "won", color: "bg-emerald-400/40" },
    { label: "lost", key: "lost", color: "bg-red-400/30" },
  ];

  const totalPipelineDeals =
    pipelineSummary.identified +
    pipelineSummary.pitched +
    pipelineSummary.proposal +
    pipelineSummary.won +
    pipelineSummary.lost;

  return (
    <div className="min-h-screen flex flex-col bg-ops-bg text-ops-text">

      {/* ── header ─────────────────────────────────────────────── */}
      <header className="border-b border-ops-border/60 sticky top-0 bg-ops-bg/90 backdrop-blur-md z-50">
        <div className="max-w-6xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-sm font-semibold text-ops-heading lowercase tracking-tight hover:opacity-80 transition-opacity"
            >
              winded.vertigo <span className="text-ops-text-muted font-normal ml-1">ops</span>
            </a>
            <span className="text-ops-border/60 text-xs">/</span>
            <span className="text-[13px] text-ops-text-muted lowercase">marketing</span>
          </div>
          <nav className="flex items-center gap-4 text-[11px] text-ops-text-muted">
            <a href="/" className="hover:text-ops-text transition-colors lowercase">dashboard</a>
            <a href="/marketing" className="text-ops-heading lowercase">marketing</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-5 py-6 flex-1 space-y-6">

        {/* ── page title ──────────────────────────────────────── */}
        <div>
          <h1 className="text-lg font-semibold text-ops-heading lowercase tracking-tight">
            marketing overview
          </h1>
          <p className="text-[12px] text-ops-text-muted mt-0.5">
            content calendar · campaign performance · pipeline
          </p>
        </div>

        {/* ── content calendar ────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ops-text-muted">
              content calendar
            </h2>
            <span className="text-[10px] text-ops-text-muted/60 tabular-nums">
              {contentItems.length} items
            </span>
          </div>

          <div className="rounded-xl border border-ops-border bg-ops-card overflow-hidden">
            {/* table header */}
            <div className="grid grid-cols-[90px_110px_1fr_90px] sm:grid-cols-[100px_120px_1fr_100px] gap-x-4 px-4 py-2 border-b border-ops-border/50 bg-ops-bg/40">
              {["date", "channel", "title / hook", "status"].map((h) => (
                <span
                  key={h}
                  className="text-[10px] uppercase tracking-[0.1em] text-ops-text-muted"
                >
                  {h}
                </span>
              ))}
            </div>

            {/* rows */}
            <div className="divide-y divide-ops-border/30">
              {contentItems.map((item) => {
                const { bg, text, border } = contentStatusStyle(item.status);
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[90px_110px_1fr_90px] sm:grid-cols-[100px_120px_1fr_100px] gap-x-4 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-[12px] text-ops-text-muted tabular-nums">
                      {formatDate(item.scheduledDate)}
                    </span>
                    <span className="text-[12px] text-ops-text-muted">
                      {channelLabel(item.channel)}
                    </span>
                    <span className="text-[13px] text-ops-text truncate">
                      {item.title}
                    </span>
                    <span
                      className={[
                        "inline-flex items-center justify-center rounded-full border px-2 py-0.5",
                        "text-[10px] uppercase tracking-wide w-fit",
                        bg, text, border,
                      ].join(" ")}
                    >
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── campaign performance ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ops-text-muted">
              campaign performance
            </h2>
            {campaignMetrics.length > 0 && (
              <span className="text-[10px] text-ops-text-muted/60 tabular-nums">
                {campaignMetrics.length} campaigns
              </span>
            )}
          </div>

          <div className="rounded-xl border border-ops-border bg-ops-card overflow-hidden">
            {campaignMetrics.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center justify-center text-center gap-2">
                <span className="text-[11px] text-ops-text-muted">no campaign data yet</span>
                <span className="text-[10px] text-ops-text-muted/50">
                  campaign metrics will appear here once the weekly-cmo-review dispatch runs
                </span>
              </div>
            ) : (
              <>
                {/* table header */}
                <div className="grid grid-cols-[1fr_80px_70px_70px_70px_80px] gap-x-4 px-4 py-2 border-b border-ops-border/50 bg-ops-bg/40">
                  {["campaign", "sent", "open", "click", "reply", "status"].map((h) => (
                    <span
                      key={h}
                      className="text-[10px] uppercase tracking-[0.1em] text-ops-text-muted"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                <div className="divide-y divide-ops-border/30">
                  {campaignMetrics.map((c) => {
                    const isActive = c.status.toLowerCase() === "active";
                    return (
                      <div
                        key={c.campaignId}
                        className={[
                          "grid grid-cols-[1fr_80px_70px_70px_70px_80px] gap-x-4 px-4 py-3 items-center",
                          isActive ? "bg-blue-400/[0.03]" : "hover:bg-white/[0.02]",
                          "transition-colors",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          )}
                          <span className="text-[13px] text-ops-text truncate">{c.name}</span>
                        </div>
                        <span className="text-[12px] text-ops-text tabular-nums">
                          {c.emailsSent.toLocaleString()}
                        </span>
                        <span className="text-[12px] text-ops-text tabular-nums">
                          {pct(c.openRate)}
                        </span>
                        <span className="text-[12px] text-ops-text tabular-nums">
                          {pct(c.clickRate)}
                        </span>
                        <span className="text-[12px] text-ops-text tabular-nums">
                          {pct(c.replyRate)}
                        </span>
                        <span
                          className={[
                            "inline-flex items-center justify-center rounded-full border px-2 py-0.5 w-fit",
                            "text-[10px] uppercase tracking-wide",
                            isActive
                              ? "bg-blue-400/10 text-blue-400 border-blue-400/20"
                              : "bg-white/5 text-ops-text-muted border-white/10",
                          ].join(" ")}
                        >
                          {c.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── pipeline summary ─────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ops-text-muted">
              pipeline
            </h2>
            {pipelineSummary.totalValue !== undefined && (
              <span className="text-[11px] text-ops-text tabular-nums">
                total value{" "}
                <span className="text-ops-heading font-semibold">
                  ${pipelineSummary.totalValue.toLocaleString()}
                </span>
              </span>
            )}
          </div>

          <div className="rounded-xl border border-ops-border bg-ops-card p-5">
            {totalPipelineDeals === 0 ? (
              <p className="text-[11px] text-ops-text-muted text-center py-4">
                no pipeline data yet — check back after the next cmo dispatch
              </p>
            ) : (
              <>
                {/* horizontal stage strip */}
                <div className="flex items-stretch gap-2 sm:gap-3">
                  {pipelineStages.map(({ label, key, color }) => {
                    const count = pipelineSummary[key] as number;
                    const widthPct =
                      totalPipelineDeals > 0
                        ? Math.max((count / totalPipelineDeals) * 100, count > 0 ? 8 : 0)
                        : 0;
                    return (
                      <div
                        key={key}
                        className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
                      >
                        {/* bar */}
                        <div className="w-full h-8 rounded-md bg-ops-border/30 overflow-hidden flex items-end">
                          <div
                            className={`w-full ${color} rounded-md transition-all duration-500`}
                            style={{ height: `${widthPct}%` }}
                          />
                        </div>
                        {/* count */}
                        <span className="text-[18px] font-bold text-ops-text tabular-nums leading-none">
                          {count}
                        </span>
                        {/* label */}
                        <span className="text-[10px] uppercase tracking-[0.08em] text-ops-text-muted text-center">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* arrow connector labels */}
                <div className="flex items-center gap-1 mt-4 text-[10px] text-ops-text-muted/50">
                  {pipelineStages.slice(0, -2).map(({ label }, i) => (
                    <span key={label} className="flex items-center gap-1">
                      {i > 0 && <span>→</span>}
                      <span className="capitalize">{label}</span>
                    </span>
                  ))}
                  <span className="ml-auto flex items-center gap-1">
                    <span className="text-emerald-400/50">↓ won</span>
                    <span className="text-red-400/50 ml-1">↓ lost</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

      </main>

      {/* ── footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-ops-border/40 mt-auto">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <span className="text-[10px] text-ops-text-muted/50 lowercase">
            winded.vertigo ops · marketing
          </span>
          <span className="text-[10px] text-ops-text-muted/40 tabular-nums lowercase">
            data from kv + supabase social_drafts
          </span>
        </div>
      </footer>

    </div>
  );
}
