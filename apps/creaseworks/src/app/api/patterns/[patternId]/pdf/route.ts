/**
 * Server-side PDF generation for entitled pattern cards.
 *
 * GET /api/patterns/[patternId]/pdf?pack=packSlug
 *
 * Generates a branded PDF with:
 * - pattern title + headline
 * - find, fold, unfold flow
 * - rails sentence
 * - find again mode + prompt
 * - watermark: org name, user email, pack name, dd/mm/yyyy date
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { requireAuth } from "@/lib/auth-helpers";
import { getPackBySlug, isPatternInPack } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import { sql } from "@/lib/db";
import {
  PATTERN_ENTITLED_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";

/**
 * Sanitise text for pdf-lib StandardFonts (WinAnsi / Windows-1252).
 * Replaces common Unicode characters that aren't in the WinAnsi set,
 * then strips anything still outside the safe range.
 */
function sanitize(text: string): string {
  return text
    .replace(/\u2014/g, "-")   // em dash
    .replace(/\u2013/g, "-")   // en dash
    .replace(/\u2018/g, "'")   // left single quote
    .replace(/\u2019/g, "'")   // right single quote / apostrophe
    .replace(/\u201C/g, '"')   // left double quote
    .replace(/\u201D/g, '"')   // right double quote
    .replace(/\u2026/g, "...")  // ellipsis
    .replace(/\u00A0/g, " ")   // non-breaking space
    // Strip anything outside printable ASCII + Latin-1 Supplement (WinAnsi safe)
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

interface Props {
  params: Promise<{ patternId: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await requireAuth();
  const { patternId } = await params;
  const packSlug = req.nextUrl.searchParams.get("pack");

  let pack: { id: string; title: string; slug: string } | null = null;

  if (session.isInternal) {
    // Internal users bypass pack/entitlement gate — they can download any ready pattern
    if (packSlug) {
      pack = await getPackBySlug(packSlug);
    }
  } else {
    // External users: require pack + active entitlement
    if (!packSlug) {
      return NextResponse.json({ error: "missing pack parameter" }, { status: 400 });
    }

    pack = await getPackBySlug(packSlug);
    if (!pack) {
      return NextResponse.json({ error: "pack not found" }, { status: 404 });
    }

    const isEntitled = await checkEntitlement(session.orgId, pack.id);
    if (!isEntitled) {
      return NextResponse.json({ error: "not entitled" }, { status: 403 });
    }

    const inPack = await isPatternInPack(patternId, pack.id);
    if (!inPack) {
      return NextResponse.json({ error: "pattern not in pack" }, { status: 404 });
    }
  }

  // fetch full pattern
  const cols = columnsToSql(PATTERN_ENTITLED_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols} FROM patterns_cache WHERE id = $1 AND status = 'ready' LIMIT 1`,
    [patternId],
  );
  const pattern = result.rows[0];
  if (!pattern) {
    return NextResponse.json({ error: "pattern not found" }, { status: 404 });
  }

  // generate PDF — wrapped in try/catch so encoding errors return 500 with detail
  try {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const cadet = rgb(0.153, 0.196, 0.282); // #273248
  const redwood = rgb(0.694, 0.314, 0.263); // #b15043
  const grey = rgb(0.5, 0.5, 0.5);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // helper: wrap and draw text, return new y position
  function drawText(
    rawText: string,
    x: number,
    startY: number,
    size: number,
    usedFont: typeof font,
    colour: typeof cadet,
    lineHeight: number = size * 1.4,
  ): number {
    const text = sanitize(rawText);
    const words = text.split(/\s+/);
    let line = "";
    let currentY = startY;

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        if (currentY < margin + 40) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }
        page.drawText(line, { x, y: currentY, size, font: usedFont, color: colour });
        currentY -= lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      if (currentY < margin + 40) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }
      page.drawText(line, { x, y: currentY, size, font: usedFont, color: colour });
      currentY -= lineHeight;
    }
    return currentY;
  }

  // title
  y = drawText(pattern.title, margin, y, 22, fontBold, cadet);
  y -= 4;

  // headline
  if (pattern.headline) {
    y = drawText(pattern.headline, margin, y, 12, fontItalic, grey);
    y -= 8;
  }

  // rails sentence
  if (pattern.rails_sentence) {
    y = drawText("rails sentence", margin, y, 9, fontBold, redwood);
    y = drawText(pattern.rails_sentence, margin, y, 11, fontItalic, cadet);
    y -= 12;
  }

  // find, fold, unfold
  const steps = [
    { label: "find", text: pattern.find },
    { label: "fold", text: pattern.fold },
    { label: "unfold", text: pattern.unfold },
  ];

  for (const step of steps) {
    if (!step.text) continue;
    y = drawText(step.label.toUpperCase(), margin, y, 9, fontBold, redwood);
    y = drawText(step.text, margin, y, 10, font, cadet);
    y -= 10;
  }

  // find again
  if (pattern.find_again_mode) {
    y = drawText(`find again â ${pattern.find_again_mode}`, margin, y, 9, fontBold, redwood);
    if (pattern.find_again_prompt) {
      y = drawText(pattern.find_again_prompt, margin, y, 10, font, cadet);
    }
    y -= 10;
  }

  // watermark on every page
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const watermark = sanitize([
    session.orgName || "personal",
    session.email,
    pack?.title || "internal",
    `${dd}/${mm}/${yyyy}`,
  ].join("  \u00b7  "));

  const pages = pdfDoc.getPages();
  for (const pg of pages) {
    pg.drawText(watermark, {
      x: margin,
      y: 20,
      size: 7,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
    pg.drawText("creaseworks \u00b7 windedvertigo.com", {
      x: margin,
      y: 10,
      size: 6,
      font: fontItalic,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  const pdfBytes = await pdfDoc.save();

  // log download (M1: capture IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    pattern.id,
    pack?.id || null,
    "download_pdf",
    ip,
    ["find", "fold", "unfold", "rails_sentence", "find_again_mode", "find_again_prompt"],
  );

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pattern.slug || "pattern"}.pdf"`,
    },
  });

  } catch (err: any) {
    console.error("[pdf] generation failed:", err);
    return NextResponse.json(
      { error: `pdf generation failed: ${err.message}` },
      { status: 500 },
    );
  }
}

