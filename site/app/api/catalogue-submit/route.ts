import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const CATALOGUE_DB = "62bbc91d-9be7-4b94-8268-967cdbe81e4c";

type RichTextItem = { text: { content: string } };

function toRichText(text: string): RichTextItem[] {
  const chunks: RichTextItem[] = [];
  for (let i = 0; i < text.length; i += 2000) {
    chunks.push({ text: { content: text.slice(i, i + 2000) } });
  }
  return chunks.length > 0 ? chunks : [{ text: { content: "" } }];
}

interface SubmitPayload {
  name: string;
  tagline?: string;
  author?: string;
  dimensions: string[];
  duration?: string;
  formats?: string[];
  levels?: string[];
  objective?: string;
  instructions: string;
  materials?: string;
}

export async function POST(req: NextRequest) {
  let body: SubmitPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { name, tagline, author, dimensions, duration, formats, levels, objective, instructions, materials } = body;

  if (!name?.trim() || !instructions?.trim() || !dimensions?.length) {
    return NextResponse.json(
      { error: "missing required fields: name, dimensions, and instructions" },
      { status: 400 },
    );
  }

  try {
    await notion.pages.create({
      parent: { database_id: CATALOGUE_DB },
      properties: {
        "practice name": {
          title: [{ text: { content: String(name).slice(0, 200) } }],
        },
        "regenerative dimension": {
          multi_select: dimensions.map((d: string) => ({ name: d })),
        },
        "step-by-step instructions": {
          rich_text: toRichText(String(instructions)),
        },
        ...(tagline?.trim()
          ? { tagline: { rich_text: toRichText(String(tagline)) } }
          : {}),
        ...(duration?.trim()
          ? { duration: { select: { name: String(duration) } } }
          : {}),
        ...(formats?.length
          ? {
              format: {
                multi_select: formats.map((f: string) => ({ name: f })),
              },
            }
          : {}),
        ...(levels?.length
          ? {
              "learning level": {
                multi_select: levels.map((l: string) => ({ name: l })),
              },
            }
          : {}),
        ...(objective?.trim()
          ? { objective: { rich_text: toRichText(String(objective)) } }
          : {}),
        ...(materials?.trim()
          ? {
              "materials needed": {
                rich_text: toRichText(String(materials)),
              },
            }
          : {}),
        ...(author?.trim()
          ? {
              "practice author": {
                rich_text: [
                  { text: { content: String(author).slice(0, 200) } },
                ],
              },
            }
          : {}),
      },
    });
  } catch (err) {
    console.error("[catalogue-submit] failed:", err);
    return NextResponse.json({ error: "submission failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
