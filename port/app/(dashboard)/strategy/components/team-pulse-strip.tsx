"use client";

/**
 * team-pulse-strip.tsx
 *
 * Horizontal team-member filter chip strip + inline detail panel.
 *
 * Click a member to set the `?member=` URL param, which:
 *   1. Filters CAMPAIGNS, DISTRIBUTION, and TIMELINE tabs to that person's work
 *   2. Expands an inline detail panel below the strip showing their role,
 *      responsibilities, owned campaigns, and owned/supported projects —
 *      visible regardless of which tab is active so the click always
 *      produces visible feedback.
 *
 * Each chip carries small campaign-colour dots (Prompt 3) showing which
 * of the 6 campaigns the member is on; colours match the timeline view.
 *
 * The "all" pill clears the filter AND swaps the per-member panel for a
 * team-wide aggregate (Prompt 3 — clicking "all" should never feel empty).
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  CAMPAIGNS,
  DISTRIBUTION,
  TEAM,
  WV_COLOURS,
  type CampaignTimeline,
  type DistributionProject,
} from "@/lib/strategy-data";
import { Users, Megaphone, Folder } from "lucide-react";

export interface TeamPulseStripProps {
  /** lower-case first name, or null for "all" */
  activeMember: string | null;
  /** Campaign timelines — used for colour dots on chips. Fetched from Supabase by page. */
  timelines: CampaignTimeline[];
  /** Distribution items — used for per-member project lists. Fetched from Supabase by page. */
  distributionItems: DistributionProject[];
}

export function TeamPulseStrip({ activeMember, timelines, distributionItems }: TeamPulseStripProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setMember = useCallback(
    (name: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (name === null) {
        params.delete("member");
      } else {
        params.set("member", name);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const member = activeMember
    ? TEAM.find((t) => t.name === activeMember)
    : null;

  // per-member: owned/supported items
  const ownedCampaigns = member
    ? CAMPAIGNS.filter((c) => c.ownerNames.includes(member.name))
    : [];
  const ownedProjects = member
    ? distributionItems.filter((d) => d.owner === member.name)
    : [];
  const supportedProjects = member
    ? distributionItems.filter(
        (d) => d.owner !== member.name && d.support.includes(member.name),
      )
    : [];

  // memoize campaign-by-member map (for chip badges + aggregate panel)
  const campaignsByMember = useMemo(() => {
    const map = new Map<string, typeof CAMPAIGNS>();
    for (const m of TEAM) {
      map.set(
        m.name,
        CAMPAIGNS.filter((c) => c.ownerNames.includes(m.name)),
      );
    }
    return map;
  }, []);

  // campaign colour lookup (timeline view is the source of truth)
  const campaignColour = useCallback((id: string): string => {
    const t = timelines.find((c) => c.id === id);
    return t?.colour ?? WV_COLOURS.navy;
  }, [timelines]);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* header row */}
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>team pulse</span>
        {member ? (
          <span className="ml-auto text-foreground font-medium normal-case tracking-normal">
            filtered by {member.name} · click again to clear
          </span>
        ) : (
          <span className="ml-auto text-muted-foreground normal-case tracking-normal">
            5 collective members · {CAMPAIGNS.length} campaigns · {distributionItems.length} projects
          </span>
        )}
      </div>

      {/* chip strip */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMember(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            activeMember === null
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          all
        </button>
        {TEAM.map((m) => {
          const isActive = activeMember === m.name;
          const color = WV_COLOURS[m.colour];
          const memberCampaigns = campaignsByMember.get(m.name) ?? [];
          return (
            <button
              key={m.name}
              type="button"
              onClick={() => setMember(isActive ? null : m.name)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                isActive
                  ? "text-white border-transparent shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              style={{
                backgroundColor: isActive ? color : "transparent",
                borderColor: isActive ? color : undefined,
              }}
              title={`${m.role} · ${memberCampaigns.length} campaign${memberCampaigns.length === 1 ? "" : "s"}`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: isActive ? "white" : color }}
              />
              {m.displayName.toLowerCase()}
              <span className="text-[10px] opacity-70 hidden sm:inline">
                · {m.role}
              </span>
              {/* campaign badges (Prompt 3) — small dots, one per campaign owned, in timeline colours */}
              {memberCampaigns.length > 0 && (
                <span
                  className="flex items-center gap-0.5 ml-1 pl-1.5 border-l"
                  style={{
                    borderColor: isActive
                      ? "rgba(255, 255, 255, 0.35)"
                      : "rgba(0, 0, 0, 0.12)",
                  }}
                >
                  {memberCampaigns.map((c) => (
                    <span
                      key={c.id}
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: campaignColour(c.id) }}
                      title={c.name}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* per-member detail panel */}
      {member && (
        <div
          className="mt-3 pt-3 border-t border-border space-y-3"
          style={{ borderTopColor: WV_COLOURS[member.colour] + "30" }}
        >
          <div className="flex items-baseline gap-3 flex-wrap">
            <h3 className="text-base font-semibold">
              {member.displayName.toLowerCase()}
            </h3>
            <span
              className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: WV_COLOURS[member.colour] + "20",
                color: WV_COLOURS[member.colour],
              }}
            >
              {member.role}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* responsibilities */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                ongoing responsibilities
              </p>
              <ul className="space-y-1">
                {member.responsibilities.map((r) => (
                  <li
                    key={r}
                    className="text-xs flex items-start gap-1.5 text-foreground leading-snug"
                  >
                    <span
                      className="mt-1 shrink-0 w-1 h-1 rounded-full"
                      style={{ backgroundColor: WV_COLOURS[member.colour] }}
                    />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* campaigns owned */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  campaigns ({ownedCampaigns.length})
                </p>
                {ownedCampaigns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab("campaigns")}
                    className="text-[10px] text-[#b15043] hover:underline"
                  >
                    open campaigns →
                  </button>
                )}
              </div>
              {ownedCampaigns.length > 0 ? (
                <ul className="space-y-1">
                  {ownedCampaigns.map((c) => (
                    <li
                      key={c.id}
                      className="text-xs flex items-start gap-1.5 leading-snug"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: campaignColour(c.id) }}
                      />
                      <span>{c.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  no campaigns owned
                </p>
              )}
            </div>

            {/* projects owned + supported */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  projects ({ownedProjects.length} owned · {supportedProjects.length} support)
                </p>
                {(ownedProjects.length > 0 || supportedProjects.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setTab("distribution")}
                    className="text-[10px] text-[#b15043] hover:underline"
                  >
                    open distribution →
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                {ownedProjects.map((p) => (
                  <li
                    key={p.id}
                    className="text-xs flex items-start gap-1.5 leading-snug"
                  >
                    <Folder
                      className="h-3 w-3 mt-0.5 shrink-0"
                      style={{ color: WV_COLOURS[member.colour] }}
                    />
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground"> · {p.deadline}</span>
                    </span>
                  </li>
                ))}
                {supportedProjects.map((p) => (
                  <li
                    key={p.id}
                    className="text-xs flex items-start gap-1.5 leading-snug text-muted-foreground"
                  >
                    <Folder className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
                    <span>
                      {p.name}
                      <span className="opacity-70"> · supports {p.owner}</span>
                    </span>
                  </li>
                ))}
                {ownedProjects.length === 0 && supportedProjects.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    no project assignments
                  </p>
                )}
              </ul>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
            campaigns · distribution · timeline tabs are filtered to {member.name}'s
            work while this filter is active.
          </p>
        </div>
      )}

      {/* "all" aggregate panel — Prompt 3: clicking "all" should produce
          visible feedback, not just clear state */}
      {!member && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {/* left: campaign × member matrix */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                who's on what campaign
              </p>
              <ul className="space-y-1">
                {CAMPAIGNS.map((c) => (
                  <li
                    key={c.id}
                    className="text-xs flex items-start gap-2 leading-snug"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: campaignColour(c.id) }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {c.ownerNames.map((n, i) => (
                          <span key={n}>
                            {i > 0 && " + "}
                            <button
                              type="button"
                              onClick={() => setMember(n)}
                              className="hover:text-foreground hover:underline"
                            >
                              {n}
                            </button>
                          </span>
                        ))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* right: members × campaign-load */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                campaign load by member
              </p>
              <ul className="space-y-1">
                {TEAM.map((m) => {
                  const list = campaignsByMember.get(m.name) ?? [];
                  return (
                    <li
                      key={m.name}
                      className="text-xs flex items-baseline gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => setMember(m.name)}
                        className="font-medium hover:underline shrink-0"
                        style={{ color: WV_COLOURS[m.colour] }}
                      >
                        {m.displayName.toLowerCase()}
                      </button>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {list.length}×
                      </span>
                      <span className="flex items-center gap-0.5">
                        {list.map((c) => (
                          <span
                            key={c.id}
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: campaignColour(c.id) }}
                            title={c.name}
                          />
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
            click any member or campaign-owner name above to filter campaigns ·
            distribution · timeline.
          </p>
        </div>
      )}
    </div>
  );
}
