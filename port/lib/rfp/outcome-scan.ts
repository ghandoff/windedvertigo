/**
 * RFP outcome scanner — the "Finn tracks outcomes" loop.
 *
 * Reads recent reply emails, asks Haiku whether each reports an outcome for one
 * of our open opportunities (award / rejection / invited-to-propose), and
 * ENQUEUES a proposed status change in the review queue. Nothing is applied
 * until a human approves it at /inbox — so a misread email can't silently flip
 * a deal's status.
 *
 * Mirrors the lib/fin/email-scan pattern (Haiku classify + dedup + enqueue).
 */

import Anthropic from "@anthropic-ai/sdk";
import { getGmailAccessToken, fetchRecentReplies, getMessageWithBody } from "@/lib/gmail";
import { supabase } from "@/lib/supabase/client";
import { enqueueReviewItem } from "@/lib/review-queue";

// Non-terminal statuses — an outcome email is only interesting for an open RFP.
const ACTIVE = ["radar", "reviewing", "pursuing", "submitted", "invited", "interviewing"];

const OUTCOME_TO_STATUS: Record<string, string> = {
  award: "won",
  rejection: "lost",
  invited: "invited",
};

const MAX_EMAILS = 40;
const MIN_CONFIDENCE = 0.6;

interface Classified {
  rfp_name: string | null;
  outcome: "award" | "rejection" | "invited" | "none";
  confidence: number;
}

async function classify(
  subject: string,
  from: string,
  body: string,
  rfpNames: string[],
): Promise<Classified | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });
  const prompt = `You triage replies to winded.vertigo's funding/RFP proposals. Decide whether this email reports an outcome for one of our OPEN opportunities. Return JSON only.

Open opportunities:
${rfpNames.map((n) => `- ${n}`).join("\n")}

Email:
From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 1500)}

Return exactly: {"rfp_name": <exact name from the list, or null>, "outcome": "award"|"rejection"|"invited"|"none", "confidence": 0..1}
- "award": we won / were selected / contract offered.
- "rejection": not selected / awarded to another / unsuccessful.
- "invited": EOI accepted, invited to submit a full proposal, or shortlisted for a next round.
- "none": acknowledgement, clarification, scheduling, or unrelated.
Only set rfp_name when you are confident the email concerns that specific opportunity.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json ? (JSON.parse(json) as Classified) : null;
  } catch {
    return null;
  }
}

export interface OutcomeScanResult {
  seen: number;
  enqueued: number;
  items: string[];
}

export async function scanRfpOutcomes(): Promise<OutcomeScanResult> {
  const token = await getGmailAccessToken();
  const replies = await fetchRecentReplies(14, token);

  const { data: rfps } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, status")
    .in("status", ACTIVE);
  const nameToId = new Map<string, string>(
    (rfps ?? []).map((r) => [r.opportunity_name as string, r.notion_page_id as string]),
  );
  const names = [...nameToId.keys()];
  if (!names.length) return { seen: replies.length, enqueued: 0, items: [] };

  let enqueued = 0;
  const items: string[] = [];

  for (const m of replies.slice(0, MAX_EMAILS)) {
    const full = await getMessageWithBody(m.id, token);
    if (!full) continue;
    const c = await classify(full.subject, full.from, full.body, names);
    if (!c || c.outcome === "none" || !c.rfp_name || c.confidence < MIN_CONFIDENCE) continue;
    const rfpId = nameToId.get(c.rfp_name);
    const status = OUTCOME_TO_STATUS[c.outcome];
    if (!rfpId || !status) continue;
    const created = await enqueueReviewItem({
      kind: "rfp_outcome",
      rfpId,
      proposed: { status },
      summary: `${c.rfp_name} → ${status} · from ${full.from}`,
      sourceEmailId: m.id,
    });
    if (created) {
      enqueued++;
      items.push(`${c.rfp_name} → ${status}`);
    }
  }

  return { seen: replies.length, enqueued, items };
}
