/**
 * /api/transcribe
 *
 * Receives a multipart form:
 *   - audio (Blob)
 *   - title (string)
 *   - date (YYYY-MM-DD)
 *   - category (select enum)
 *   - duration (seconds as string)
 *   - attendeeIds (JSON string array of Notion user IDs)
 *   - projectId (optional Notion project page ID — unused at MVP step)
 *
 * Pipeline:
 *   1. Auth gate — require session
 *   2. Upload audio to Cloudflare R2 via existing lib/r2/upload.ts,
 *      get a public URL
 *   3. Transcribe via OpenAI Whisper  (STUB — wired once OPENAI_API_KEY is set)
 *   4. Summarise via Claude Sonnet   (STUB — using anthropic SDK already in stack)
 *   5. Create a Notion page in the meetings database with: title, date,
 *      category, attendees, meeting lead (current user), status,
 *      ai summary, and a body containing the audio link + transcript
 *   6. Return { pageId, pageUrl }
 *
 * The nightly `lib/meeting-ingest/ingest-meeting-notes.ts` cron picks
 * up the page and extracts action items automatically — no direct
 * work-item creation needed here.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notion } from "@/lib/notion/client";
import { uploadAsset, generateAssetKey } from "@/lib/r2/upload";
import { transcribeAudio } from "@/lib/transcribe/whisper";
import { summariseTranscript } from "@/lib/transcribe/summarise";

// Meetings DB — confirmed via notion-fetch in Phase 14 planning.
const MEETINGS_DB_ID = "224e4ee74ba48174b095e91e32c88f81";

// Whisper has a 25 MB file-size limit. ~25 min of opus-encoded audio.
// Slightly generous here to allow a 5-min buffer for encoding overhead.
// Vercel function size limit is separate and set at the platform level.
export const maxDuration = 300; // seconds — long-running transcription

export async function POST(req: NextRequest) {
  // 1. auth
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. parse form
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid multipart body" }, { status: 400 });
  }

  const audio = form.get("audio");
  const title = (form.get("title") ?? "").toString().trim();
  const date = (form.get("date") ?? "").toString().trim();
  const category = (form.get("category") ?? "check-in").toString().trim();
  const durationStr = (form.get("duration") ?? "0").toString();
  const duration = Number.parseInt(durationStr, 10) || 0;
  const attendeeIdsStr = (form.get("attendeeIds") ?? "[]").toString();
  const projectId = (form.get("projectId") ?? "").toString().trim();

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "audio is required" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  let attendeeIds: string[] = [];
  try {
    const parsed = JSON.parse(attendeeIdsStr);
    if (Array.isArray(parsed)) attendeeIds = parsed.filter((x) => typeof x === "string");
  } catch {
    /* tolerate — empty list is fine */
  }

  try {
    // 3. upload audio to R2
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = audio.type || "audio/webm";
    const extension = contentType.includes("mp4") ? "m4a" : contentType.includes("mpeg") ? "mp3" : "webm";
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const key = `meetings/${date}/${Date.now()}-${slug}.${extension}`;
    // generateAssetKey defaults to campaigns/ prefix — we override with our own key
    void generateAssetKey;
    const audioUrl = await uploadAsset(buffer, key, contentType);

    // 4. transcribe via Whisper
    //    If OPENAI_API_KEY is missing, transcribeAudio returns a clear
    //    {transcript: "", error: "..."} so we can still file the page
    //    with just the audio link — the user can add transcript later.
    const { transcript, error: transcribeError } = await transcribeAudio(
      buffer,
      contentType,
    );

    // 5. summarise via Claude (only if we have a transcript)
    let summary = "";
    let actionItems: string[] = [];
    let decisions: string[] = [];
    if (transcript) {
      const result = await summariseTranscript({
        transcript,
        title,
        attendeeNames: [], // we only have IDs here; names are stored in Notion
      });
      summary = result.summary;
      actionItems = result.actionItems;
      decisions = result.decisions;
    }

    // 6. create Notion meeting page
    const page = await notion.pages.create({
      parent: { database_id: MEETINGS_DB_ID, type: "database_id" },
      properties: {
        meeting: { title: [{ text: { content: title } }] },
        "scheduled time": {
          date: { start: date },
        },
        category: { select: { name: category } },
        status: { status: { name: "documented" } },
        "w.v attendees": {
          people: attendeeIds.map((id) => ({ id })),
        },
        ...(summary
          ? { "ai summary": { rich_text: [{ text: { content: summary } }] } }
          : {}),
      },
      children: buildMeetingPageBlocks({
        audioUrl,
        duration,
        transcript,
        summary,
        actionItems,
        decisions,
        transcribeError,
        projectId,
      }),
    });

    // Notion returns the page URL on the response
    type PageResponse = { id: string; url?: string };
    const pageResponse = page as unknown as PageResponse;
    const pageUrl = pageResponse.url ?? `https://www.notion.so/${pageResponse.id.replace(/-/g, "")}`;

    return NextResponse.json({
      pageId: pageResponse.id,
      pageUrl,
      hasTranscript: !!transcript,
      hasSummary: !!summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("transcribe pipeline failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Notion page body blocks
// ─────────────────────────────────────────────────────────────────

interface BuildBlocksArgs {
  audioUrl: string;
  duration: number;
  transcript: string;
  summary: string;
  actionItems: string[];
  decisions: string[];
  transcribeError?: string;
  projectId: string;
}

function buildMeetingPageBlocks({
  audioUrl,
  duration,
  transcript,
  summary,
  actionItems,
  decisions,
  transcribeError,
  projectId,
}: BuildBlocksArgs) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];

  // Header: audio + metadata
  blocks.push({
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji: "🎙️" },
      color: "gray_background",
      rich_text: [
        {
          type: "text",
          text: {
            content: `recorded with /transcribe · ${formatDuration(duration)} · `,
          },
        },
        {
          type: "text",
          text: { content: "listen", link: { url: audioUrl } },
          annotations: { underline: true },
        },
      ],
    },
  });

  // Summary section (Notion UI already renders ai summary property;
  // this is a visible-in-page copy so readers can scan)
  if (summary) {
    blocks.push(h2("summary"));
    blocks.push(paragraph(summary));
  }

  // Action items (the cron will extract these separately from notes;
  // here we render them as a bulleted list for immediate visibility)
  if (actionItems.length > 0) {
    blocks.push(h2("action items"));
    for (const item of actionItems) {
      blocks.push(bullet(item));
    }
  }

  // Decisions
  if (decisions.length > 0) {
    blocks.push(h2("decisions"));
    for (const d of decisions) {
      blocks.push(bullet(d));
    }
  }

  // Transcript (toggle so the page isn't overwhelmed by a wall of text)
  if (transcript) {
    blocks.push({
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "full transcript" } }],
        children: chunkTranscript(transcript).map((chunk) => paragraph(chunk)),
      },
    });
  } else if (transcribeError) {
    blocks.push(h2("transcript"));
    blocks.push(
      paragraph(
        `[transcription unavailable: ${transcribeError}. add OPENAI_API_KEY to the port vercel project and re-run.]`,
      ),
    );
  }

  // Notes / agenda / decisions placeholders for the human to fill in
  blocks.push(h2("notes"));
  blocks.push(paragraph(""));

  // Footer tag for the ingest pipeline to pick up (not strictly needed,
  // but a hint for humans reading the page)
  if (projectId) {
    blocks.push(
      paragraph(
        `linked project: notion page id ${projectId} (the ingest pipeline will match this automatically).`,
      ),
    );
  }

  return blocks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function h2(text: string): any {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paragraph(text: string): any {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: text
        ? [{ type: "text", text: { content: text } }]
        : [],
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bullet(text: string): any {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Notion rich_text blocks have a 2000-char limit per text node.
 * Split long transcripts into multiple paragraphs to stay under it.
 */
function chunkTranscript(transcript: string, chunkSize = 1900): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < transcript.length) {
    // break at a sentence boundary if possible
    let end = Math.min(i + chunkSize, transcript.length);
    if (end < transcript.length) {
      const nextBreak = transcript.lastIndexOf(". ", end);
      if (nextBreak > i + chunkSize / 2) end = nextBreak + 1;
    }
    chunks.push(transcript.slice(i, end).trim());
    i = end;
  }
  return chunks.filter((c) => c.length > 0);
}
