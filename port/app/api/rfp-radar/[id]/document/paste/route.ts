/**
 * POST /api/rfp-radar/[id]/document/paste
 *
 * Accepts pasted TOR text as JSON `{ text: string }`, stores it as a .txt
 * file in R2, and attaches it to the RFP (same effect as file upload).
 *
 * Mirrors the pattern in `../route.ts`:
 *   1. Validate text length (100–200,000 chars)
 *   2. Store to R2 under `campaigns/rfp-tors/{id}/{timestamp}-pasted.txt`
 *   3. Extract structured fields via Claude (fail-open — file still attaches)
 *   4. Update Notion: rfpDocumentUrl (always), requirementsSnapshot (if sparse),
 *      dueDate/estimatedValue (if currently null)
 *   5. Fire inngest `rfp/document.uploaded` event (fire-and-forget)
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { uploadAsset } from "@/lib/r2/upload";
import { getRfpOpportunity, updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { recordUsage } from "@/lib/ai/usage-store";
import { auth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishJob } from "@windedvertigo/job-queue";
import type { RfpDocumentUploadedJob } from "@windedvertigo/job-queue/types";
import type { PortCfEnv } from "@/lib/cf-env";

const anthropic = new Anthropic();

const MIN_CHARS = 100;
const MAX_CHARS = 200_000;

interface ExtractionResult {
  requirementsSnapshot: string | null;
  dueDate: string | null;
  estimatedValue: number | null;
}

async function extractFromText(
  text: string,
  rfpName: string,
  userId: string,
): Promise<ExtractionResult> {
  const system = `You are a procurement analyst. Extract structured information from RFP documents.
Return ONLY valid JSON with exactly these fields:
{
  "requirementsSnapshot": "3-5 sentence description of what work/services are being procured, the key objectives, and any notable constraints. Write in plain English.",
  "dueDate": "YYYY-MM-DD submission deadline, or null if not found",
  "estimatedValue": integer USD budget/contract value or null if not found
}`;

  const userText = `Extract procurement details from this RFP document titled "${rfpName}".`;

  // Truncate to protect both the token window and response latency. 8k chars
  // is roughly the same ceiling used in the sibling route's text branch.
  const truncated = text.slice(0, 8000);

  const start = Date.now();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system,
    messages: [
      {
        role: "user",
        content: `${userText}\n\nDocument content:\n${truncated}`,
      },
    ],
  });

  const durationMs = Date.now() - start;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;

  recordUsage({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    feature: "rfp-document-extraction",
    model: "claude-haiku-4-5-20251001",
    inputTokens,
    outputTokens,
    costUsd,
    userId,
    durationMs,
  }).catch(() => {});

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { requirementsSnapshot: null, dueDate: null, estimatedValue: null };
    return JSON.parse(jsonMatch[0]) as ExtractionResult;
  } catch {
    return { requirementsSnapshot: null, dueDate: null, estimatedValue: null };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.email ?? "system";

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (text.length < MIN_CHARS) {
    return NextResponse.json(
      { error: `pasted text is too short — please paste at least ${MIN_CHARS} characters of TOR content (got ${text.length})` },
      { status: 400 },
    );
  }

  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `pasted text is too long — maximum ${MAX_CHARS.toLocaleString()} characters (got ${text.length.toLocaleString()})` },
      { status: 400 },
    );
  }

  // Fetch current record to check existing fields
  let rfp;
  try {
    rfp = await getRfpOpportunity(id);
  } catch {
    return NextResponse.json({ error: "rfp not found" }, { status: 404 });
  }

  // Store pasted text as a .txt file in R2. The campaigns/ prefix is required
  // — the R2 API token is scoped to campaigns/* (top-level rfp-tors/ returns
  // AccessDenied 403).
  const key = `campaigns/rfp-tors/${id}/${Date.now()}-pasted.txt`;
  const buffer = Buffer.from(text, "utf-8");

  let publicUrl: string;
  try {
    publicUrl = await uploadAsset(buffer, key, "text/plain; charset=utf-8");
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    const name: string = e?.name ?? "Error";
    const message: string = e?.message ?? String(err);
    const code: string | undefined = e?.Code;
    const statusCode: number | undefined = e?.$metadata?.httpStatusCode;
    console.error(
      `[rfp/document/paste] R2 upload failed: name=${name} code=${code ?? "-"} status=${statusCode ?? "-"} message=${message}`,
      err,
    );
    return NextResponse.json(
      {
        error: `file storage failed (${name}${statusCode ? ` ${statusCode}` : ""}): ${message}`,
        r2Error: { name, code, statusCode },
      },
      { status: 500 },
    );
  }

  // Extract via Claude — best-effort. Identical fail-open pattern as the
  // sibling document/route.ts: if Claude hiccups, the file still attaches.
  let extraction: ExtractionResult = {
    requirementsSnapshot: null,
    dueDate: null,
    estimatedValue: null,
  };
  let extractionError: string | null = null;
  try {
    extraction = await extractFromText(text, rfp.opportunityName, userId);
  } catch (err) {
    extractionError = err instanceof Error ? err.message : "extraction failed";
    console.error("[rfp/document/paste] extraction failed (file still attached):", extractionError);
  }

  // Only overwrite requirementsSnapshot if the current one is sparse (< 60 chars)
  const shouldUpdateSnapshot =
    extraction.requirementsSnapshot &&
    (!rfp.requirementsSnapshot || rfp.requirementsSnapshot.length < 60);

  const updates: Parameters<typeof updateRfpOpportunity>[1] = {
    rfpDocumentUrl: publicUrl,
    ...(shouldUpdateSnapshot && {
      requirementsSnapshot: extraction.requirementsSnapshot!,
    }),
    ...(!rfp.dueDate?.start && extraction.dueDate && {
      dueDate: { start: extraction.dueDate, end: null },
    }),
    ...(!rfp.estimatedValue && extraction.estimatedValue && {
      estimatedValue: extraction.estimatedValue,
    }),
  };

  try {
    await updateRfpOpportunity(id, updates);
  } catch (err) {
    console.error("[rfp/document/paste] Notion update failed:", err);
    const msg = err instanceof Error ? err.message : "notion update failed";
    return NextResponse.json(
      { ok: true, url: publicUrl, notionUpdated: false, extraction, error: `file attached, but Notion update failed: ${msg}` },
      { status: 207 },
    );
  }

  // Fire question parsing job (fire-and-forget — never blocks the response).
  // G.2.3: CF Workers → CF Queue; Vercel canary → Inngest fallback
  const docPayload: RfpDocumentUploadedJob = {
    type: "rfp/document-uploaded",
    rfpId: id,
    documentUrl: publicUrl,
    contentType: "text/plain",
    uploadedAt: new Date().toISOString(),
  };
  try {
    const { env } = getCloudflareContext();
    publishJob(env.RFP_DOCUMENT_QUEUE, docPayload).catch(() => {});
  } catch {
    inngest.send({ name: "rfp/document.uploaded", data: { rfpId: id, documentUrl: publicUrl, contentType: "text/plain" } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, url: publicUrl, notionUpdated: true, extraction });
}
