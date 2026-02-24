/**
 * Evidence PDF builder — generates a branded portfolio PDF.
 *
 * Accepts enriched evidence items (photos already fetched as bytes)
 * and returns a Uint8Array of the finished PDF.
 *
 * Phase D — evidence export (practitioner tier).
 */

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { PortfolioItem } from "@/lib/queries/evidence";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface EvidencePdfItem extends PortfolioItem {
  /** Raw image bytes for photo evidence (jpeg or png). null if fetch failed. */
  photoBytes?: Uint8Array | null;
  /** MIME type of the photo (image/jpeg, image/png). */
  photoMime?: string | null;
}

export interface EvidencePdfOptions {
  orgName?: string | null;
  email: string;
  filters?: {
    type?: string | null;
    playdate?: string | null;
  };
}

/* ------------------------------------------------------------------ */
/*  constants                                                          */
/* ------------------------------------------------------------------ */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;

const CADET = rgb(0.153, 0.196, 0.282);    // #273248
const REDWOOD = rgb(0.694, 0.314, 0.263);   // #b15043
const SIENNA = rgb(0.796, 0.471, 0.345);    // #cb7858
const GREY = rgb(0.5, 0.5, 0.5);
const LIGHT_GREY = rgb(0.85, 0.85, 0.85);

/* ------------------------------------------------------------------ */
/*  main builder                                                       */
/* ------------------------------------------------------------------ */

export async function buildEvidencePdf(
  items: EvidencePdfItem[],
  opts: EvidencePdfOptions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  /* ---- helpers ---- */

  function ensureSpace(needed: number): void {
    if (y < MARGIN + needed) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawText(
    text: string,
    x: number,
    startY: number,
    size: number,
    usedFont: PDFFont,
    colour: ReturnType<typeof rgb>,
    lineHeight: number = size * 1.4,
  ): number {
    const words = text.split(/\s+/);
    let line = "";
    let currentY = startY;
    const textMaxWidth = MAX_WIDTH - (x - MARGIN);

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(test, size);
      if (width > textMaxWidth && line) {
        ensureSpace(40);
        currentY = Math.min(currentY, y);
        page.drawText(line, { x, y: currentY, size, font: usedFont, color: colour });
        currentY -= lineHeight;
        y = currentY;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ensureSpace(40);
      currentY = Math.min(currentY, y);
      page.drawText(line, { x, y: currentY, size, font: usedFont, color: colour });
      currentY -= lineHeight;
      y = currentY;
    }
    return currentY;
  }

  function drawRule(): void {
    ensureSpace(20);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: LIGHT_GREY,
    });
    y -= 12;
  }

  /* ---- header ---- */
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  y = drawText(opts.orgName || "creaseworks", MARGIN, y, 20, fontBold, CADET);
  y -= 2;
  y = drawText("evidence portfolio", MARGIN, y, 14, fontItalic, REDWOOD);
  y -= 2;
  y = drawText(`generated ${dateStr}`, MARGIN, y, 9, font, GREY);

  // applied filters
  const filterParts: string[] = [];
  if (opts.filters?.type) filterParts.push(`type: ${opts.filters.type}`);
  if (opts.filters?.playdate) filterParts.push(`playdate: ${opts.filters.playdate}`);
  if (filterParts.length > 0) {
    y -= 2;
    y = drawText(`filters: ${filterParts.join("  ·  ")}`, MARGIN, y, 9, font, GREY);
  }

  y -= 8;

  // summary
  y = drawText("SUMMARY", MARGIN, y, 9, fontBold, REDWOOD);
  y -= 2;
  y = drawText(`${items.length} evidence item${items.length !== 1 ? "s" : ""}`, MARGIN, y, 10, font, CADET);

  // breakdown by type
  const typeCounts: Record<string, number> = {};
  for (const item of items) {
    typeCounts[item.evidence_type] = (typeCounts[item.evidence_type] || 0) + 1;
  }
  const typeList = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}s (${c})`)
    .join(", ");
  if (typeList) {
    y = drawText(`by type: ${typeList}`, MARGIN, y, 10, font, CADET);
  }

  y -= 12;
  drawRule();
  y -= 4;

  /* ---- evidence items ---- */
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    ensureSpace(80);

    // item header: type badge + playdate + date
    const typeBadge = item.evidence_type.toUpperCase();
    const playdateLabel = item.playdate_title ?? item.run_title;
    const itemDate = item.run_date
      ? new Date(item.run_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    y = drawText(typeBadge, MARGIN, y, 8, fontBold, SIENNA);
    y -= 1;
    y = drawText(
      `${playdateLabel}${itemDate ? `  ·  ${itemDate}` : ""}`,
      MARGIN,
      y,
      10,
      fontBold,
      CADET,
    );
    y -= 4;

    // item content by type
    if (item.evidence_type === "photo" && item.photoBytes) {
      await drawPhoto(pdfDoc, page, item.photoBytes, item.photoMime ?? "image/jpeg");
    } else if (item.evidence_type === "photo") {
      // Photo couldn't be fetched — show placeholder text
      y = drawText("[photo not available]", MARGIN, y, 9, fontItalic, GREY);
    }

    if (item.evidence_type === "quote") {
      const quoteText = item.quote_text ? `\u201C${item.quote_text}\u201D` : "";
      if (quoteText) {
        y = drawText(quoteText, MARGIN + 8, y, 11, fontItalic, CADET);
      }
      if (item.quote_attribution) {
        y = drawText(`\u2014 ${item.quote_attribution}`, MARGIN + 8, y, 9, font, GREY);
      }
    }

    if (item.evidence_type === "observation" || item.evidence_type === "artifact") {
      if (item.prompt_key) {
        y = drawText(
          item.prompt_key.replace(/_/g, " "),
          MARGIN,
          y,
          9,
          fontBold,
          SIENNA,
        );
        y -= 1;
      }
      if (item.body) {
        y = drawText(item.body, MARGIN + 8, y, 10, font, CADET);
      }
    }

    y -= 8;

    // separator
    if (i < items.length - 1) {
      drawRule();
      y -= 2;
    }
  }

  /* ---- photo embedding helper ---- */
  async function drawPhoto(
    doc: PDFDocument,
    _page: PDFPage,
    bytes: Uint8Array,
    mime: string,
  ): Promise<void> {
    try {
      const image =
        mime === "image/png"
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);

      // Scale to fit within content width, max 350px tall
      const maxImgWidth = MAX_WIDTH;
      const maxImgHeight = 350;
      const scale = Math.min(
        maxImgWidth / image.width,
        maxImgHeight / image.height,
        1,
      );
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;

      ensureSpace(drawHeight + 20);

      page.drawImage(image, {
        x: MARGIN,
        y: y - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });
      y -= drawHeight + 8;
    } catch {
      // If embedding fails (unsupported format, corruption), show placeholder
      y = drawText("[photo could not be embedded]", MARGIN, y, 9, fontItalic, GREY);
    }
  }

  /* ---- watermark on every page ---- */
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const watermark = [
    opts.orgName || "personal",
    opts.email,
    `${dd}/${mm}/${yyyy}`,
  ].join("  \u00B7  ");

  const pages = pdfDoc.getPages();
  for (const pg of pages) {
    pg.drawText(watermark, {
      x: MARGIN,
      y: 20,
      size: 7,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
    pg.drawText("creaseworks \u00B7 windedvertigo.com", {
      x: MARGIN,
      y: 10,
      size: 6,
      font: fontItalic,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  return pdfDoc.save();
}
