import { PDFDocument, StandardFonts } from "pdf-lib";
import type { DrawCtx } from "./types";
import { PAGE_W, PAGE_H, MARGIN } from "./constants";
import {
  drawCoverPage,
  drawTableOfContents,
  drawPlaydatePage,
  drawPageNumber,
} from "./sections";

interface Collection {
  id: string;
  title: string;
  description: string | null;
  slug: string;
}

interface PlaydateData {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primary_function: string | null;
  friction_dial: number | null;
  start_in_120s: boolean | null;
  arc_emphasis: string | null;
  required_forms: string | null;
  slots_optional: string | null;
  rails_sentence: string | null;
  find: string | null;
  fold: string | null;
  unfold: string | null;
  find_again_mode: string | null;
  find_again_prompt: string | null;
  slots_notes: string | null;
  substitutions_notes: string | null;
}

interface Material {
  title: string;
  form_primary: string | null;
}

interface SessionData {
  userId: string;
  orgId: string | null;
  orgName: string | null;
  email: string;
  isInternal: boolean;
}

export async function generateCollectionPDF(
  collection: Collection,
  playdates: PlaydateData[],
  materialsByPlaydate: { [key: string]: Material[] },
  session: SessionData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  let pageNumber = 0;

  // ── draw cover page ─────────────────────────────────────
  const coverPage = doc.addPage([PAGE_W, PAGE_H]);
  pageNumber++;

  const coverCtx: DrawCtx = {
    doc,
    page: coverPage,
    y: PAGE_H - MARGIN,
    font,
    fontBold,
    fontItalic,
    fontBoldItalic,
  };

  drawCoverPage(coverCtx, collection, playdates.length);

  // ── draw table of contents ──────────────────────────────
  const tocPage = doc.addPage([PAGE_W, PAGE_H]);
  pageNumber++;

  const tocCtx: DrawCtx = {
    doc,
    page: tocPage,
    y: PAGE_H - MARGIN,
    font,
    fontBold,
    fontItalic,
    fontBoldItalic,
  };

  drawTableOfContents(tocCtx, collection, playdates);

  // ── draw each playdate on a new page ────────────────────
  for (const playdate of playdates) {
    const materials = materialsByPlaydate[playdate.id] || [];
    const playdatePage = doc.addPage([PAGE_W, PAGE_H]);
    pageNumber++;

    const ctx: DrawCtx = {
      doc,
      page: playdatePage,
      y: PAGE_H - MARGIN,
      font,
      fontBold,
      fontItalic,
      fontBoldItalic,
    };

    // Draw the playdate content
    drawPlaydatePage(ctx, playdate, materials, collection.title);

    // Draw page number in footer
    drawPageNumber(ctx, pageNumber, collection.title);
  }

  const pdfBytes = await doc.save();
  return pdfBytes;
}
