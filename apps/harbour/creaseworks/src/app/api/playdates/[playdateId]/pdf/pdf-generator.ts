import { PDFDocument, StandardFonts } from "pdf-lib";
import type { DrawCtx } from "./types";
import { PAGE_W, PAGE_H, MARGIN } from "./constants";
import {
  drawHeader,
  drawTitle,
  drawAtAGlance,
  drawBigIdea,
  drawHowToPlay,
  drawMaterials,
  drawLinkedMaterials,
  drawWatermark,
} from "./sections";

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

interface PackData {
  id: string;
  title: string;
}

export async function generatePlaydatePDF(
  playdate: PlaydateData,
  materials: Material[],
  session: SessionData,
  pack: PackData | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  const ctx: DrawCtx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
    font,
    fontBold,
    fontItalic,
    fontBoldItalic,
  };

  // ── render sections in order ─────────────────────────────────────
  drawHeader(ctx, fontBold);
  drawTitle(ctx, playdate, fontBold, fontItalic);
  drawAtAGlance(ctx, playdate, font, fontBold);
  drawBigIdea(ctx, playdate, fontBold, fontItalic);
  drawHowToPlay(ctx, playdate, font, fontBold);
  drawMaterials(ctx, playdate, font, fontBold);
  drawLinkedMaterials(ctx, materials, font, fontBold);
  drawWatermark(ctx, session, pack?.title || null);

  const pdfBytes = await doc.save();
  return pdfBytes;
}
