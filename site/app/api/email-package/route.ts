/**
 * POST /api/email-package
 *
 * Sends the pre-generated quadrant PDF to the user's email via Resend,
 * and logs the lead as a contact in the CRM Notion database.
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { sendPackageEmail } from "@/lib/email/send-package";

/* ── constants ── */

const R2_PUBLIC_BASE =
  process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ??
  "https://pub-c685a810f5794314a106e0f249c740c9.r2.dev";

const VALID_QUADRANTS = new Set([
  "people-design",
  "people-research",
  "product-design",
  "product-research",
]);

const QUADRANT_LABELS: Record<string, string> = {
  "people-design": "people × design",
  "people-research": "people × research",
  "product-design": "product × design",
  "product-research": "product × research",
};

// CRM contacts data source ID
const CRM_CONTACTS_DB = "829cd552-4516-45b7-a65b-2bcd8d47ff81";

/* ── rate limiting (in-memory, per-instance) ── */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_DAY = 3;

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 86_400_000 });
    return false;
  }

  if (entry.count >= MAX_PER_DAY) return true;
  entry.count++;
  return false;
}

/* ── notion contact logging ── */

async function logContactToNotion(params: {
  name: string;
  email: string;
  quadrant: string;
  focus: string[];
  goals: string[];
}): Promise<void> {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.warn("[email-package] NOTION_TOKEN not set — skipping lead log");
    return;
  }

  const notion = new Client({ auth: token });
  const label = QUADRANT_LABELS[params.quadrant] ?? params.quadrant;
  const nextAction = `package inquiry: ${label} — ${params.focus.join(", ")} — ${params.goals.join(", ")}`;
  const today = new Date().toISOString().split("T")[0];

  // check for existing contact by email
  try {
    const existing = await notion.databases.query({
      database_id: CRM_CONTACTS_DB,
      filter: {
        property: "email",
        email: { equals: params.email },
      },
      page_size: 1,
    });

    if (existing.results.length > 0) {
      // update existing contact
      const pageId = existing.results[0].id;
      await notion.pages.update({
        page_id: pageId,
        properties: {
          "last contacted": { date: { start: today } },
          "next action": {
            rich_text: [{ text: { content: nextAction } }],
          },
        },
      });
      return;
    }
  } catch (err) {
    // if query fails (e.g. API version mismatch), fall through to create
    console.warn("[email-package] contact dedup query failed:", err);
  }

  // create new contact
  await notion.pages.create({
    parent: { database_id: CRM_CONTACTS_DB },
    properties: {
      "first & last name": {
        title: [{ text: { content: params.name } }],
      },
      "email": { email: params.email },
      "contact warmth": { select: { name: "lukewarm" } },
      "relationship stage": { select: { name: "introduced" } },
      "last contacted": { date: { start: today } },
      "next action": {
        rich_text: [{ text: { content: nextAction } }],
      },
    },
  });
}

/* ── handler ── */

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const quadrant = typeof body.quadrant === "string" ? body.quadrant : "";
  const focus = Array.isArray(body.focus) ? body.focus.filter((f): f is string => typeof f === "string") : [];
  const goals = Array.isArray(body.goals) ? body.goals.filter((g): g is string => typeof g === "string") : [];

  // validation
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "valid email is required" }, { status: 400 });
  }
  if (!VALID_QUADRANTS.has(quadrant)) {
    return NextResponse.json({ error: "invalid quadrant" }, { status: 400 });
  }

  // rate limit
  if (isRateLimited(email)) {
    return NextResponse.json(
      { error: "you've already received this package today — check your inbox" },
      { status: 429 },
    );
  }

  try {
    // fetch the pre-generated PDF from R2
    const pdfUrl = `${R2_PUBLIC_BASE}/package-pdfs/${quadrant}.pdf`;
    const pdfRes = await fetch(pdfUrl);

    if (!pdfRes.ok) {
      console.error(`[email-package] failed to fetch PDF: ${pdfRes.status} ${pdfUrl}`);
      return NextResponse.json(
        { error: "package PDF not available — please try again later" },
        { status: 502 },
      );
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    // send email + log contact in parallel
    const [emailResult] = await Promise.all([
      sendPackageEmail({ name, email, quadrant, goals, pdfBuffer }),
      logContactToNotion({ name, email, quadrant, focus, goals }).catch((err) => {
        // don't fail the request if CRM logging fails
        console.error("[email-package] failed to log contact:", err);
      }),
    ]);

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error ?? "failed to send email" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email-package] unexpected error:", err);
    return NextResponse.json(
      { error: "something went wrong — please try again" },
      { status: 500 },
    );
  }
}
