/**
 * POST /api/extract-text
 *
 * Document extraction endpoint for harbour-apps/depth-chart.
 *
 * Why this lives on the port (Vercel/Node) and not on depth-chart's CF Worker:
 * `pdf-parse` (via `pdfjs-dist`) and `mammoth` reference DOM globals like
 * `DOMMatrix` at module-import time. The import alone fails on Cloudflare
 * Workers — even when only TXT is being parsed. Extracting these libraries
 * to a Node.js function on the port lets depth-chart move to CF Workers
 * cleanly while keeping the same UX.
 *
 * Auth: Bearer token (PORT_EXTRACT_TOKEN). Shared secret with depth-chart;
 * not a user-facing endpoint.
 *
 * Pattern mirrors port/app/api/cron/generate-pdfs/route.ts (also Node-only).
 */

import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

// Use the Node.js runtime (not edge) — required for Buffer + pdf-parse
export const runtime = "nodejs";
export const maxDuration = 60;

function verifyBearer(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header) return false;
  const token = header.replace(/^Bearer\s+/, "");
  const expected = process.env.PORT_EXTRACT_TOKEN;
  if (!expected) {
    console.error("[extract-text] PORT_EXTRACT_TOKEN not set");
    return false;
  }
  return token === expected;
}

async function extractPdf(data: ArrayBuffer): Promise<string> {
  const buffer = Buffer.from(data);
  const result = await pdfParse(buffer);
  return result.text ?? "";
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function POST(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    let text: string;
    switch (ext) {
      case "pdf":
        text = await extractPdf(arrayBuffer);
        break;
      case "docx":
        text = await extractDocx(Buffer.from(arrayBuffer));
        break;
      case "txt":
        text = new TextDecoder().decode(arrayBuffer);
        break;
      default:
        return NextResponse.json(
          { error: `unsupported file type: .${ext}` },
          { status: 400 },
        );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[extract-text] failed:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
