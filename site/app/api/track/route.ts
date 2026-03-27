/**
 * POST /api/track
 *
 * Logs a page view to the Notion "Page Views" database with UTM attribution.
 * Called by the client-side TrackPageView component on each navigation.
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const COOKIE_NAME = "__wv_utm";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_VIEWS_DB = process.env.PAGE_VIEWS_DB_ID;

interface TrackPayload {
  url: string;
  referrer: string;
}

export async function POST(req: NextRequest) {
  if (!PAGE_VIEWS_DB) {
    return NextResponse.json({ ok: false, error: "tracking not configured" }, { status: 503 });
  }

  let payload: TrackPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Read UTM cookie
  const utmCookie = req.cookies.get(COOKIE_NAME)?.value;
  let utm: Record<string, string> = {};
  if (utmCookie) {
    try {
      utm = JSON.parse(utmCookie);
    } catch {
      // Corrupted cookie — ignore
    }
  }

  const ua = req.headers.get("user-agent") ?? "";

  // Skip bots
  if (/bot|crawl|spider|slurp|facebookexternalhit/i.test(ua)) {
    return NextResponse.json({ ok: true, note: "bot" });
  }

  try {
    await notion.pages.create({
      parent: { database_id: PAGE_VIEWS_DB },
      properties: {
        URL: { title: [{ text: { content: payload.url.slice(0, 200) } }] },
        Referrer: { rich_text: [{ text: { content: (payload.referrer || "direct").slice(0, 200) } }] },
        "UTM Source": { rich_text: [{ text: { content: utm.utm_source ?? "" } }] },
        "UTM Medium": { rich_text: [{ text: { content: utm.utm_medium ?? "" } }] },
        "UTM Campaign": { rich_text: [{ text: { content: utm.utm_campaign ?? "" } }] },
        "UTM Content": { rich_text: [{ text: { content: utm.utm_content ?? "" } }] },
        "User Agent": { rich_text: [{ text: { content: ua.slice(0, 200) } }] },
        "Timestamp": { date: { start: new Date().toISOString() } },
      },
    });
  } catch (err) {
    console.error("[track] failed to log page view:", err);
    // Don't fail the request — tracking is non-critical
  }

  return NextResponse.json({ ok: true });
}
