/**
 * Event ROI report — Phase 8 of the conference intelligence pipeline.
 *
 * Joins `crm_events` ↔ `rfp_opportunities.influenced_by_event_ids` (and
 * `deals.influenced_by_event_ids`) to answer: "which conferences influenced
 * which opportunities/deals, and what did those convert into?"
 *
 * Surfaced on /strategy?tab=pipeline as the "events that influenced won
 * deals" panel. Read-only — humans populate `influencedByEventIds` from
 * the RFP edit form (and future deal edit form) when they remember which
 * conference led to which conversation.
 *
 * The 14-day attribution window most CRMs default to misses 60–70% of
 * actual influence (per the CRM-baseline audit on 2026-05-07), so this
 * helper imposes NO time horizon — once linked, the influence persists
 * for the lifetime of the row.
 */

import { supabase } from "@/lib/supabase/client";

export interface EventRoiRow {
  /** crm_events.notion_page_id */
  eventId: string;
  /** Display name */
  eventName: string;
  /** ISO date — null when the event has no recorded start. */
  eventStart: string | null;
  /** All linked opportunities — won, lost, in-flight. */
  opportunities: Array<{
    id: string;
    name: string;
    status: string;
    estimatedValue: number | null;
    wvFitScore: string | null;
  }>;
  /** All linked deals (separate from opportunities). */
  deals: Array<{
    id: string;
    name: string;
    status: string | null;
    value: number | null;
  }>;
  /** Convenience rollup. */
  rollup: {
    opportunityCount: number;
    wonCount: number;
    lostCount: number;
    inFlightCount: number;
    /** Sum of estimatedValue for won opportunities + value for won deals. */
    realizedRevenue: number;
    /** Sum for in-flight opps. */
    pipelineValue: number;
  };
}

/**
 * Fetch every event that's been linked from at least one opportunity OR
 * deal, with the linked rows attached. Skips events with no incoming links.
 *
 * Returns rows ordered by realized revenue descending — biggest impact at
 * the top. Cap at 50 rows to keep the report fast; tweak if needed.
 */
export async function getEventRoi(): Promise<EventRoiRow[]> {
  // 1. Pull every opportunity + deal that has at least one linked event.
  //    The `not.is.null` + `not.eq.{}` combo skips empty arrays.
  const [oppsRes, dealsRes] = await Promise.all([
    supabase
      .from("rfp_opportunities")
      .select("notion_page_id, opportunity_name, status, estimated_value, wv_fit_score, influenced_by_event_ids")
      .not("influenced_by_event_ids", "is", null)
      .not("influenced_by_event_ids", "eq", "{}"),
    supabase
      .from("deals")
      .select("notion_page_id, deal, status, value, influenced_by_event_ids")
      .not("influenced_by_event_ids", "is", null)
      .not("influenced_by_event_ids", "eq", "{}"),
  ]);

  if (oppsRes.error) {
    console.error("[event-roi] opps query failed:", oppsRes.error.message);
  }
  if (dealsRes.error) {
    console.error("[event-roi] deals query failed:", dealsRes.error.message);
  }

  type OppRow = {
    notion_page_id: string;
    opportunity_name: string;
    status: string | null;
    estimated_value: number | null;
    wv_fit_score: string | null;
    influenced_by_event_ids: string[];
  };
  type DealRow = {
    notion_page_id: string;
    deal: string;
    status: string | null;
    value: number | null;
    influenced_by_event_ids: string[];
  };

  const opps = (oppsRes.data ?? []) as OppRow[];
  const deals = (dealsRes.data ?? []) as DealRow[];

  // 2. Collect the union of linked event ids and fetch the events.
  const eventIds = new Set<string>();
  for (const o of opps) for (const id of o.influenced_by_event_ids) eventIds.add(id);
  for (const d of deals) for (const id of d.influenced_by_event_ids) eventIds.add(id);

  if (eventIds.size === 0) return [];

  const { data: eventsData, error: evtErr } = await supabase
    .from("crm_events")
    .select("notion_page_id, event, event_start")
    .in("notion_page_id", Array.from(eventIds));

  if (evtErr) {
    console.error("[event-roi] events query failed:", evtErr.message);
    return [];
  }

  type EvtRow = { notion_page_id: string; event: string; event_start: string | null };
  const eventsById = new Map<string, EvtRow>(
    ((eventsData ?? []) as EvtRow[]).map((e) => [e.notion_page_id, e]),
  );

  // 3. Build a per-event accumulator.
  const acc = new Map<string, EventRoiRow>();
  for (const id of eventIds) {
    const evt = eventsById.get(id);
    if (!evt) continue; // event was deleted but link remains; skip silently
    acc.set(id, {
      eventId: id,
      eventName: evt.event,
      eventStart: evt.event_start,
      opportunities: [],
      deals: [],
      rollup: {
        opportunityCount: 0,
        wonCount: 0,
        lostCount: 0,
        inFlightCount: 0,
        realizedRevenue: 0,
        pipelineValue: 0,
      },
    });
  }

  // 4. Distribute opps + deals into per-event rows.
  for (const o of opps) {
    for (const evtId of o.influenced_by_event_ids) {
      const row = acc.get(evtId);
      if (!row) continue;
      row.opportunities.push({
        id: o.notion_page_id,
        name: o.opportunity_name,
        status: o.status ?? "radar",
        estimatedValue: o.estimated_value ?? null,
        wvFitScore: o.wv_fit_score ?? null,
      });
      row.rollup.opportunityCount++;
      if (o.status === "won") {
        row.rollup.wonCount++;
        row.rollup.realizedRevenue += o.estimated_value ?? 0;
      } else if (o.status === "lost" || o.status === "no-go" || o.status === "missed deadline") {
        row.rollup.lostCount++;
      } else {
        row.rollup.inFlightCount++;
        row.rollup.pipelineValue += o.estimated_value ?? 0;
      }
    }
  }
  for (const d of deals) {
    for (const evtId of d.influenced_by_event_ids) {
      const row = acc.get(evtId);
      if (!row) continue;
      row.deals.push({
        id: d.notion_page_id,
        name: d.deal,
        status: d.status,
        value: d.value,
      });
      // deals with status='won' (or 'closed-won', depending on table conventions)
      // contribute to realizedRevenue too — we accept either for forward-compat.
      if (d.status === "won" || d.status === "closed-won") {
        row.rollup.realizedRevenue += d.value ?? 0;
      } else if (d.status && (d.status === "open" || d.status === "negotiating")) {
        row.rollup.pipelineValue += d.value ?? 0;
      }
    }
  }

  // 5. Order by realizedRevenue desc, fallback to pipelineValue.
  return Array.from(acc.values())
    .sort((a, b) => {
      const aScore = a.rollup.realizedRevenue * 1_000_000 + a.rollup.pipelineValue;
      const bScore = b.rollup.realizedRevenue * 1_000_000 + b.rollup.pipelineValue;
      return bScore - aScore;
    })
    .slice(0, 50);
}
