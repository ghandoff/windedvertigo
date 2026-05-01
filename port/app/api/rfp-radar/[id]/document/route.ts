/**
 * POST /api/rfp-radar/[id]/document
 *
 * Accepts a PDF or TXT file upload for an RFP opportunity.
 * 1. Stores the file in R2 under `rfp-docs/{id}/{timestamp}-{slug}`
 * 2. Sends the document to Claude to extract a requirements snapshot
 * 3. Updates the Notion record: `rfpDocumentUrl` (always) and
 *    `requirementsSnapshot` (only if sparse or empty)
 *
 * Supports multipart/form-data with a single `file` field.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { uploadAsset } from "@/lib/r2/upload";
import { getRfpOpportunity, updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { recordUsage } from "@/lib/ai/usage-store";
import { auth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishJob } from "@windedvertigo/job-queue";
import type { RfpProposalJob, RfpDocumentUploadedJob } from "@windedvertigo/job-queue/types";
import type { PortCfEnv } from "@/lib/cf-env";

const anthropic = new Anthropic();

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",                                                         // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   // .docx
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ExtractionResult {
  requirementsSnapshot: string | null;
  dueDate: string | null;
  estimatedValue: number | null;
}

async function extractFromDocument(
  content: Buffer,
  contentType: string,
  rfpName: string,
  userId: string,
): Promise<ExtractionResult> {
  // Word-doc path: Anthropic's DocumentBlockParam doesn't natively understand
  // .doc/.docx — only PDF and text. We use mammoth to convert the Word binary
  // into plain text, then fall through to the existing text-based Claude
  // extraction prompt below. mammoth handles modern .docx cleanly; older .doc
  // files are only partially supported — on failure we fail-open with nulls
  // so the file still attaches.
  let docxText: string | null = null;
  if (
    contentType === "application/msword" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer: content });
      docxText = (result.value ?? "").trim();
      if (!docxText) {
        console.warn("[rfp/document] mammoth extracted empty text — falling back to no-extraction");
        return { requirementsSnapshot: null, dueDate: null, estimatedValue: null };
      }
      console.log(
        `[rfp/document] mammoth extracted ${docxText.length} chars from ${contentType}`,
      );
    } catch (err) {
      console.warn(
        `[rfp/document] mammoth failed for ${contentType} — file still attached:`,
        err instanceof Error ? err.message : err,
      );
      return { requirementsSnapshot: null, dueDate: null, estimatedValue: null };
    }
  }

  const system = `You are a procurement analyst. Extract structured information from RFP documents.
Return ONLY valid JSON with exactly these fields:
{
  "requirementsSnapshot": "3-5 sentence description of what work/services are being procured, the key objectives, and any notable constraints. Write in plain English.",
  "dueDate": "YYYY-MM-DD submission deadline, or null if not found",
  "estimatedValue": integer USD budget/contract value or null if not found
}`;

  const userText = `Extract procurement details from this RFP document titled "${rfpName}".`;

  const start = Date.now();
  let response;

  if (contentType === "application/pdf") {
    const base64 = content.toString("base64");
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            } as Anthropic.DocumentBlockParam,
            { type: "text", text: userText },
          ],
        },
      ],
    });
  } else {
    // Plain text OR mammoth-extracted Word content. Prefer the docxText we
    // already extracted above; fall back to treating the buffer as UTF-8.
    // 8000 chars is ~2000 tokens — enough for a front-of-RFP TOR; longer
    // documents get a best-effort summary from the first 8k chars.
    const text = (docxText ?? content.toString("utf-8")).slice(0, 8000);
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [
        {
          role: "user",
          content: `${userText}\n\nDocument content:\n${text}`,
        },
      ],
    });
  }

  const durationMs = Date.now() - start;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;

  // Track usage (fire-and-forget)
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid multipart request" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "unsupported file type — upload PDF or TXT" },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file too large — maximum 20 MB" },
      { status: 413 },
    );
  }

  // Fetch current record to read existing requirementsSnapshot
  let rfp;
  try {
    rfp = await getRfpOpportunity(id);
  } catch {
    return NextResponse.json({ error: "rfp not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Mirror the EXACT key pattern that campaign image uploads use (generateAssetKey
  // in lib/r2/upload.ts): campaigns/YYYY/MM/<ts>-<slug>. Our earlier attempt at
  // campaigns/rfp-docs/... still returned AccessDenied 403 — the R2 token is
  // scoped to campaigns/<YYYY>/<MM>/ specifically, not campaigns/* broadly.
  // Prefixing with "rfp-<id>-" in the filename portion preserves the logical
  // separation from campaign image assets.
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const key = `campaigns/${year}/${month}/${Date.now()}-rfp-${id}-${slugify(file.name)}`;

  // Upload to R2. Extract the full S3 SDK error shape so Garrett (and us) can
  // see WHICH failure mode it is — AccessDenied on the rfp-docs/ prefix,
  // NoSuchBucket, credential invalid, etc. Each implies a different Cloudflare
  // dashboard action to fix.
  let publicUrl: string;
  try {
    publicUrl = await uploadAsset(buffer, key, contentType);
  } catch (err) {
    // S3 SDK errors carry .name (e.g. "AccessDenied"), .message, and
    // .$metadata.httpStatusCode. Surface all three — to logs for the deep
    // debug, and to the response so the user sees the actual failure mode.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    const name: string = e?.name ?? "Error";
    const message: string = e?.message ?? String(err);
    const code: string | undefined = e?.Code;
    const statusCode: number | undefined = e?.$metadata?.httpStatusCode;
    console.error(
      `[rfp/document] R2 upload failed: name=${name} code=${code ?? "-"} status=${statusCode ?? "-"} message=${message}`,
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

  // Extract requirements via Claude — best-effort. If this fails (rate limit,
  // bad PDF, timeout, quota) we STILL attach the file and return success. The
  // previous behaviour — an unwrapped await — produced an uncaught 500 on any
  // Claude hiccup, which the client UI swallowed silently. Garrett's "go
  // through selection but it doesn't attach" was exactly this.
  let extraction: ExtractionResult = {
    requirementsSnapshot: null,
    dueDate: null,
    estimatedValue: null,
  };
  let extractionError: string | null = null;
  try {
    extraction = await extractFromDocument(
      buffer,
      contentType,
      rfp.opportunityName,
      userId,
    );
  } catch (err) {
    extractionError = err instanceof Error ? err.message : "extraction failed";
    console.error("[rfp/document] extraction failed (file still attached):", extractionError);
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
    console.error("[rfp/document] Notion update failed:", err);
    // Return partial success — file is stored, Notion update failed
    const msg = err instanceof Error ? err.message : "notion update failed";
    return NextResponse.json(
      { ok: true, url: publicUrl, notionUpdated: false, extraction, error: `file attached, but Notion update failed: ${msg}` },
      { status: 207 },
    );
  }

  // Fire question parsing job (fire-and-forget — never blocks the response)
  // G.2.3: CF Workers → CF Queue; Vercel canary → Inngest fallback
  const docPayload: RfpDocumentUploadedJob = {
    type: "rfp/document-uploaded",
    rfpId: id,
    documentUrl: publicUrl,
    contentType,
    uploadedAt: new Date().toISOString(),
  };
  try {
    const { env } = getCloudflareContext();
    publishJob(env.RFP_DOCUMENT_QUEUE, docPayload).catch(() => {});
  } catch {
    inngest.send({ name: "rfp/document.uploaded", data: { rfpId: id, documentUrl: publicUrl, contentType } }).catch(() => {});
  }

  // If the opportunity is already "pursuing" and a TOR just arrived, re-trigger
  // proposal generation so the draft incorporates the actual document content.
  // Guard: skip if already generating/queued to avoid collisions.
  const alreadyPursuing = rfp.status === "pursuing";
  const proposalIdle =
    rfp.proposalStatus !== "generating" && rfp.proposalStatus !== "queued";

  if (alreadyPursuing && proposalIdle) {
    const triggeredBy = userId;
    // Advance proposalStatus so the UI shows feedback immediately
    updateRfpOpportunity(id, { proposalStatus: "generating" }).catch(() => {});
    const proposalPayload: RfpProposalJob = {
      type: "rfp/generate-proposal",
      rfpId: id,
      triggeredBy,
      requestedAt: new Date().toISOString(),
    };
    try {
      const { env } = getCloudflareContext();
      publishJob(env.PROPOSAL_QUEUE, proposalPayload).catch((err) => {
        console.warn("[rfp/document] failed to re-trigger proposal generation:", err);
      });
    } catch {
      inngest.send({ name: "rfp/pursuing.triggered", data: { rfpId: id, triggeredBy } }).catch((err) => {
        console.warn("[rfp/document] failed to re-trigger proposal generation:", err);
      });
    }
  }

  return NextResponse.json({
    ok: true,
    url: publicUrl,
    notionUpdated: true,
    extraction,
    proposalRetriggered: alreadyPursuing && proposalIdle,
  });
}
