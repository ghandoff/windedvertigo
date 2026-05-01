import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import { supabase } from "@/lib/supabase/client";
import type { CampaignMetrics, PipelineSummary, ContentItem } from "@/lib/types";

const EMPTY_PIPELINE: PipelineSummary = {
  identified: 0,
  pitched: 0,
  proposal: 0,
  won: 0,
  lost: 0,
};

export async function GET() {
  const [campaignMetrics, pipelineSummary, draftsResult] = await Promise.all([
    kvGet<CampaignMetrics[]>("marketing:campaign-metrics"),
    kvGet<PipelineSummary>("marketing:pipeline-summary"),
    supabase
      .from("social_drafts")
      .select("notion_page_id, content, platform, status, scheduled_for, updated_at")
      .order("scheduled_for", { ascending: true })
      .limit(20),
  ]);

  const rows = draftsResult.data ?? [];
  const contentItems: ContentItem[] = rows.map((row) => ({
    id: (row.notion_page_id as string | null) ?? crypto.randomUUID(),
    title: ((row.content as string | null) ?? "").slice(0, 80) || "untitled draft",
    channel: (row.platform as string | null) ?? "unknown",
    body: (row.content as string | null) ?? undefined,
    scheduledDate: (row.scheduled_for as string | null) ?? undefined,
    status: (row.status as string | null) ?? "draft",
  }));

  return NextResponse.json({
    campaignMetrics: campaignMetrics ?? [],
    pipelineSummary: pipelineSummary ?? EMPTY_PIPELINE,
    contentItems,
  });
}
