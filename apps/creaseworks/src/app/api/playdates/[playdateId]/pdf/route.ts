/**
 * Server-side PDF generation for playdate cards.
 *
 * GET /api/playdates/[playdateId]/pdf?pack=packSlug
 *
 * Generates a branded, visually structured PDF with:
 * - title + headline
 * - at-a-glance grid (function, energy, setup time, skills, materials, nice-to-have)
 * - the big idea (rails sentence)
 * - how to play: find, fold, unfold phases
 * - find again mode + prompt
 * - material tips + swap ideas
 * - watermark: org name, user email, pack name, date
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PDFPage, PDFFont, RGB } from "pdf-lib";
import { requireAuth } from "@/lib/auth-helpers";
import { getPackBySlug, isPlaydateInPack } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import { sql } from "@/lib/db";
import {
  PLAYDATE_ENTITLED_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";

/* ── colour palette ────────────────────────────────────────────── */
const CADET = rgb(0.153, 0.196, 0.282);       // #273248
const REDWOOD = rgb(0.694, 0.314, 0.263);      // #b15043
const CHAMPAGNE = rgb(0.992, 0.976, 0.953);    // #fdf9f3
const CHAMPAGNE_DARK = rgb(0.965, 0.937, 0.902); // slightly darker for cards
const GREY = rgb(0.5, 0.5, 0.5);
const GREY_LIGHT = rgb(0.7, 0.7, 0.7);
const GREY_FAINT = rgb(0.85, 0.85, 0.85);
const WHITE = rgb(1, 1, 1);
const FIND_AGAIN_BG = rgb(0.992, 0.949, 0.937); // warm pinkish tint

/* ── page layout ───────────────────────────────────────────────── */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_ZONE = 42; // reserved for watermark

/**
 * Sanitise text for pdf-lib StandardFonts (WinAnsi / Windows-1252).
 */
function sanitize(text: string): string {
  return text
    .replace(/\u2014/g, " - ")  // em dash
    .replace(/\u2013/g, " - ")  // en dash
    .replace(/\u2018/g, "'")    // left single quote
    .replace(/\u2019/g, "'")    // right single quote
    .replace(/\u201C/g, '"')    // left double quote
    .replace(/\u201D/g, '"')    // right double quote
    .replace(/\u2026/g, "...")   // ellipsis
    .replace(/\u00A0/g, " ")    // non-breaking space
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, "");
}

/* ── PDF drawing helpers ───────────────────────────────────────── */

interface DrawCtx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
  fontBoldItalic: PDFFont;
}

/** Ensure enough room on the current page; if not, add a new page. */
function ensureRoom(ctx: DrawCtx, need: number): void {
  if (ctx.y - need < FOOTER_ZONE + 10) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;
  }
}

/** Word-wrap and draw text. Returns the new Y position. */
function drawWrapped(
  ctx: DrawCtx,
  rawText: string,
  x: number,
  size: number,
  usedFont: PDFFont,
  colour: RGB,
  maxW: number = CONTENT_W,
  lineHeight: number = size * 1.5,
): number {
  const text = sanitize(rawText);
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const width = usedFont.widthOfTextAtSize(test, size);
    if (width > maxW && line) {
      ensureRoom(ctx, lineHeight);
      ctx.page.drawText(line, { x, y: ctx.y, size, font: usedFont, color: colour });
      ctx.y -= lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ensureRoom(ctx, lineHeight);
    ctx.page.drawText(line, { x, y: ctx.y, size, font: usedFont, color: colour });
    ctx.y -= lineHeight;
  }
  return ctx.y;
}

/** Draw a rounded rectangle (simulated with regular rect + clipping). */
function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: RGB,
  borderColor?: RGB,
) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill });
  if (borderColor) {
    page.drawRectangle({
      x, y, width: w, height: h,
      borderColor,
      borderWidth: 0.5,
    });
  }
}

/** Draw a coloured accent bar on the left side of a card. */
function drawAccentBar(page: PDFPage, x: number, y: number, h: number, colour: RGB) {
  page.drawRectangle({ x, y, width: 3, height: h, color: colour });
}

/** Format friction dial to human label. */
function frictionLabel(dial: number | null): string {
  if (!dial) return "";
  if (dial <= 2) return `chill (${dial}/5)`;
  if (dial <= 3) return `medium (${dial}/5)`;
  return `high energy (${dial}/5)`;
}

/** Format array or comma-separated string. */
function formatList(val: unknown): string {
  if (!val) return "";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

interface Props {
  params: Promise<{ playdateId: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await requireAuth();
  const { playdateId } = await params;
  const packSlug = req.nextUrl.searchParams.get("pack");

  let pack: { id: string; title: string; slug: string } | null = null;

  if (session.isInternal) {
    if (packSlug) {
      pack = await getPackBySlug(packSlug);
    }
  } else {
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
    const inPack = await isPlaydateInPack(playdateId, pack.id);
    if (!inPack) {
      return NextResponse.json({ error: "playdate not in pack" }, { status: 404 });
    }
  }

  // fetch full playdate
  const cols = columnsToSql(PLAYDATE_ENTITLED_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols} FROM playdates_cache WHERE id = $1 AND status = 'ready' LIMIT 1`,
    [playdateId],
  );
  const playdate = result.rows[0];
  if (!playdate) {
    return NextResponse.json({ error: "playdate not found" }, { status: 404 });
  }

  // fetch linked materials
  const matResult = await sql.query(
    `SELECT m.title, m.form_primary
     FROM materials_cache m
     JOIN playdate_materials pm ON pm.material_id = m.id
     WHERE pm.playdate_id = $1 AND m.do_not_use = false
     ORDER BY m.title ASC`,
    [playdateId],
  );
  const materials = matResult.rows;

  // ── generate PDF ─────────────────────────────────────────────
  try {
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

    // ── header bar ──────────────────────────────────────────────
    drawRect(ctx.page, 0, PAGE_H - 8, PAGE_W, 8, REDWOOD);

    // ── brand mark ──────────────────────────────────────────────
    ctx.y = PAGE_H - MARGIN - 4;
    ctx.page.drawText("creaseworks", {
      x: MARGIN, y: ctx.y, size: 8, font: fontBold, color: GREY_LIGHT,
    });
    ctx.y -= 20;

    // ── title ───────────────────────────────────────────────────
    drawWrapped(ctx, playdate.title, MARGIN, 24, fontBold, CADET);
    ctx.y -= 2;

    // ── headline ────────────────────────────────────────────────
    if (playdate.headline) {
      drawWrapped(ctx, playdate.headline, MARGIN, 11, fontItalic, GREY);
      ctx.y -= 6;
    }

    // ── thin divider ────────────────────────────────────────────
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y },
      end: { x: PAGE_W - MARGIN, y: ctx.y },
      thickness: 0.5,
      color: GREY_FAINT,
    });
    ctx.y -= 16;

    // ── at a glance grid ────────────────────────────────────────
    {
      const colW = CONTENT_W / 2;
      const items: { label: string; value: string; emoji: string }[] = [];

      if (playdate.primary_function)
        items.push({ emoji: "", label: "what's it about", value: formatList(playdate.primary_function) });
      if (playdate.friction_dial)
        items.push({ emoji: "", label: "energy level", value: frictionLabel(playdate.friction_dial) });
      if (playdate.start_in_120s !== null && playdate.start_in_120s !== undefined)
        items.push({ emoji: "", label: "setup time", value: playdate.start_in_120s ? "ready in under 2 minutes" : "needs a little prep" });
      if (playdate.arc_emphasis)
        items.push({ emoji: "", label: "what kids practise", value: formatList(playdate.arc_emphasis) });
      if (playdate.required_forms)
        items.push({ emoji: "", label: "what you'll gather", value: formatList(playdate.required_forms) });
      if (playdate.slots_optional)
        items.push({ emoji: "", label: "nice to have", value: formatList(playdate.slots_optional) });

      if (items.length > 0) {
        // draw background card
        const rows = Math.ceil(items.length / 2);
        const cardH = rows * 36 + 16;
        ensureRoom(ctx, cardH + 8);
        drawRect(ctx.page, MARGIN, ctx.y - cardH, CONTENT_W, cardH, CHAMPAGNE);

        const startY = ctx.y - 12;
        for (let i = 0; i < items.length; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = MARGIN + 12 + col * colW;
          const iy = startY - row * 36;

          ctx.page.drawText(items[i].label, {
            x, y: iy, size: 7.5, font: fontBold, color: GREY,
          });
          // Wrap value text within column
          const valueMaxW = colW - 24;
          const valueText = sanitize(items[i].value);
          const words = valueText.split(/\s+/).filter(Boolean);
          let line = "";
          let lineY = iy - 13;
          for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(test, 9.5) > valueMaxW && line) {
              ctx.page.drawText(line, { x, y: lineY, size: 9.5, font, color: CADET });
              lineY -= 12;
              line = word;
            } else {
              line = test;
            }
          }
          if (line) {
            ctx.page.drawText(line, { x, y: lineY, size: 9.5, font, color: CADET });
          }
        }
        ctx.y -= cardH + 12;
      }
    }

    // ── the big idea ────────────────────────────────────────────
    if (playdate.rails_sentence) {
      ensureRoom(ctx, 50);
      const ideaText = sanitize(playdate.rails_sentence);
      // Measure height needed
      const words = ideaText.split(/\s+/).filter(Boolean);
      let lineCount = 1;
      let testLine = "";
      for (const w of words) {
        const t = testLine ? `${testLine} ${w}` : w;
        if (fontItalic.widthOfTextAtSize(t, 11) > CONTENT_W - 32) {
          lineCount++;
          testLine = w;
        } else {
          testLine = t;
        }
      }
      const cardH = lineCount * 16 + 38;
      ensureRoom(ctx, cardH);

      drawRect(ctx.page, MARGIN, ctx.y - cardH, CONTENT_W, cardH, CHAMPAGNE_DARK);
      ctx.page.drawText("the big idea", {
        x: MARGIN + 14, y: ctx.y - 18, size: 9, font: fontBold, color: CADET,
      });
      // draw the sentence
      const savedY = ctx.y;
      ctx.y = ctx.y - 34;
      drawWrapped(ctx, playdate.rails_sentence, MARGIN + 14, 11, fontItalic, CADET, CONTENT_W - 28, 16);
      ctx.y = savedY - cardH - 10;
    }

    // ── how to play ─────────────────────────────────────────────
    {
      ensureRoom(ctx, 30);
      ctx.page.drawText("how to play", {
        x: MARGIN, y: ctx.y, size: 13, font: fontBold, color: CADET,
      });
      ctx.y -= 20;

      const phases: { label: string; subtitle: string; text: string | null; bg: RGB; accent: RGB }[] = [
        {
          label: "find",
          subtitle: "gather materials and set the stage",
          text: playdate.find,
          bg: CHAMPAGNE,
          accent: REDWOOD,
        },
        {
          label: "fold",
          subtitle: "the hands-on exploration",
          text: playdate.fold,
          bg: CHAMPAGNE,
          accent: REDWOOD,
        },
        {
          label: "unfold",
          subtitle: "reflect on what happened",
          text: playdate.unfold,
          bg: CHAMPAGNE,
          accent: CADET,
        },
      ];

      for (const phase of phases) {
        if (!phase.text) continue;

        // measure text height
        const bodyText = sanitize(phase.text);
        const words = bodyText.split(/\s+/).filter(Boolean);
        let lineCount = 1;
        let testLine = "";
        for (const w of words) {
          const t = testLine ? `${testLine} ${w}` : w;
          if (font.widthOfTextAtSize(t, 10) > CONTENT_W - 32) {
            lineCount++;
            testLine = w;
          } else {
            testLine = t;
          }
        }
        const cardH = lineCount * 14 + 44;
        ensureRoom(ctx, cardH + 8);

        // card background
        drawRect(ctx.page, MARGIN, ctx.y - cardH, CONTENT_W, cardH, phase.bg);
        // accent bar
        drawAccentBar(ctx.page, MARGIN, ctx.y - cardH, cardH, phase.accent);

        // label
        ctx.page.drawText(phase.label, {
          x: MARGIN + 12, y: ctx.y - 16, size: 11, font: fontBold, color: phase.accent,
        });
        // subtitle
        ctx.page.drawText(phase.subtitle, {
          x: MARGIN + 12, y: ctx.y - 28, size: 7.5, font, color: GREY,
        });

        // body text
        const savedY = ctx.y;
        ctx.y = ctx.y - 40;
        drawWrapped(ctx, phase.text, MARGIN + 12, 10, font, CADET, CONTENT_W - 24, 14);
        ctx.y = savedY - cardH - 8;
      }

      // find again (special warm background)
      if (playdate.find_again_mode) {
        const modeText = `find again - ${sanitize(playdate.find_again_mode)}`;
        const promptText = playdate.find_again_prompt ? sanitize(playdate.find_again_prompt) : "";

        // measure
        let lineCount = 1;
        if (promptText) {
          const words = promptText.split(/\s+/).filter(Boolean);
          let testLine = "";
          for (const w of words) {
            const t = testLine ? `${testLine} ${w}` : w;
            if (font.widthOfTextAtSize(t, 10) > CONTENT_W - 32) {
              lineCount++;
              testLine = w;
            } else {
              testLine = t;
            }
          }
        }
        const cardH = lineCount * 14 + 44;
        ensureRoom(ctx, cardH + 8);

        drawRect(ctx.page, MARGIN, ctx.y - cardH, CONTENT_W, cardH, FIND_AGAIN_BG);
        drawAccentBar(ctx.page, MARGIN, ctx.y - cardH, cardH, REDWOOD);

        ctx.page.drawText(modeText, {
          x: MARGIN + 12, y: ctx.y - 16, size: 11, font: fontBold, color: REDWOOD,
        });
        ctx.page.drawText("try it again with a twist", {
          x: MARGIN + 12, y: ctx.y - 28, size: 7.5, font, color: GREY,
        });

        if (playdate.find_again_prompt) {
          const savedY = ctx.y;
          ctx.y = ctx.y - 40;
          drawWrapped(ctx, playdate.find_again_prompt, MARGIN + 12, 10, font, CADET, CONTENT_W - 24, 14);
          ctx.y = savedY - cardH - 8;
        } else {
          ctx.y -= cardH + 8;
        }
      }
    }

    // ── material tips ───────────────────────────────────────────
    if (playdate.slots_notes) {
      ensureRoom(ctx, 50);
      ctx.y -= 4;

      const bodyText = sanitize(playdate.slots_notes);
      const words = bodyText.split(/\s+/).filter(Boolean);
      let lineCount = 1;
      let testLine = "";
      for (const w of words) {
        const t = testLine ? `${testLine} ${w}` : w;
        if (font.widthOfTextAtSize(t, 10) > CONTENT_W - 32) {
          lineCount++;
          testLine = w;
        } else {
          testLine = t;
        }
      }
      const cardH = lineCount * 14 + 38;
      ensureRoom(ctx, cardH);

      drawRect(ctx.page, MARGIN, ctx.y - cardH, CONTENT_W, cardH, CHAMPAGNE);
      ctx.page.drawText("material tips", {
        x: MARGIN + 12, y: ctx.y - 16, size: 9, font: fontBold, color: CADET,
      });
      const savedY = ctx.y;
      ctx.y = ctx.y - 32;
      drawWrapped(ctx, playdate.slots_notes, MARGIN + 12, 10, font, CADET, CONTENT_W - 24, 14);
      ctx.y = savedY - cardH - 8;
    }

    // ── swap ideas ──────────────────────────────────────────────
    if (playdate.substitutions_notes) {
      ensureRoom(ctx, 50);

      const bodyText = sanitize(playdate.substitutions_notes);
      const words = bodyText.split(/\s+/).filter(Boolean);
      let lineCount = 1;
      let testLine = "";
      for (const w of words) {
        const t = testLine ? `${testLine} ${w}` : w;
        if (font.widthOfTextAtSize(t, 10) > CONTENT_W - 32) {
          lineCount++;
          testLine = w;
        } else {
          testLine = t;
        }
      }
      const cardH = lineCount * 14 + 38;
      ensureRoom(ctx, cardH);

      drawRect(ctx.page, MARGIN, ctx.y - cardH, CONTENT_W, cardH, CHAMPAGNE);
      ctx.page.drawText("swap ideas", {
        x: MARGIN + 12, y: ctx.y - 16, size: 9, font: fontBold, color: CADET,
      });
      const savedY = ctx.y;
      ctx.y = ctx.y - 32;
      drawWrapped(ctx, playdate.substitutions_notes, MARGIN + 12, 10, font, CADET, CONTENT_W - 24, 14);
      ctx.y = savedY - cardH - 8;
    }

    // ── linked materials ────────────────────────────────────────
    if (materials.length > 0) {
      ensureRoom(ctx, 50);
      ctx.y -= 4;
      ctx.page.drawText("what you'll need", {
        x: MARGIN, y: ctx.y, size: 13, font: fontBold, color: CADET,
      });
      ctx.y -= 18;

      for (const mat of materials) {
        ensureRoom(ctx, 20);
        const label = sanitize(mat.form_primary || "material");
        const title = sanitize(mat.title);
        ctx.page.drawText(`${label}: ${title}`, {
          x: MARGIN + 8, y: ctx.y, size: 9, font, color: CADET,
        });
        ctx.y -= 14;
      }
      ctx.y -= 4;
    }

    // ── watermark on every page ─────────────────────────────────
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const watermark = sanitize(
      [session.orgName || "personal", session.email, pack?.title || "internal", `${dd}/${mm}/${yyyy}`]
        .join("  \u00b7  "),
    );

    const allPages = doc.getPages();
    for (const pg of allPages) {
      // bottom accent line
      pg.drawLine({
        start: { x: MARGIN, y: FOOTER_ZONE },
        end: { x: PAGE_W - MARGIN, y: FOOTER_ZONE },
        thickness: 0.5,
        color: GREY_FAINT,
      });
      pg.drawText(watermark, {
        x: MARGIN, y: FOOTER_ZONE - 14, size: 6.5, font, color: GREY_LIGHT,
      });
      pg.drawText("creaseworks \u00b7 windedvertigo.com", {
        x: MARGIN, y: FOOTER_ZONE - 23, size: 6, font: fontItalic, color: GREY_FAINT,
      });
    }

    const pdfBytes = await doc.save();

    // log download
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      playdate.id,
      pack?.id || null,
      "download_pdf",
      ip,
      [
        "find", "fold", "unfold", "rails_sentence", "find_again_mode",
        "find_again_prompt", "slots_notes", "substitutions_notes",
      ],
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${playdate.slug || "playdate"}.pdf"`,
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
