import type { PDFFont, RGB } from "pdf-lib";
import type { DrawCtx } from "./types";
import {
  CADET,
  REDWOOD,
  CHAMPAGNE,
  CHAMPAGNE_DARK,
  GREY,
  GREY_LIGHT,
  GREY_FAINT,
  FIND_AGAIN_BG,
  PAGE_W,
  PAGE_H,
  MARGIN,
  CONTENT_W,
  FOOTER_ZONE,
} from "./constants";
import {
  sanitize,
  drawRect,
  drawAccentBar,
  drawWrapped,
  ensureRoom,
  frictionLabel,
  formatList,
} from "./utils";

interface Collection {
  title: string;
  description: string | null;
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

/* ──────────────────────────────────────────────────────────────── */
/*  COVER PAGE                                                       */
/* ──────────────────────────────────────────────────────────────── */

export function drawCoverPage(ctx: DrawCtx, collection: Collection, playdateCount: number): void {
  // Header bar
  drawRect(ctx.page, 0, PAGE_H - 8, PAGE_W, 8, REDWOOD);

  // Vertical spacing from top
  ctx.y = PAGE_H - MARGIN - 40;

  // Collection title (large)
  drawWrapped(ctx, collection.title, MARGIN, 36, ctx.fontBold, CADET);
  ctx.y -= 8;

  // Collection description
  if (collection.description) {
    drawWrapped(ctx, collection.description, MARGIN, 14, ctx.fontItalic, GREY);
    ctx.y -= 12;
  }

  // Divider
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: GREY_FAINT,
  });
  ctx.y -= 20;

  // Playdate count
  ctx.page.drawText(`${playdateCount} playdate${playdateCount !== 1 ? "s" : ""}`, {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.font,
    color: CADET,
  });
  ctx.y -= 24;

  // Branding at bottom
  ctx.y = FOOTER_ZONE + 4;
  ctx.page.drawText("Generated from creaseworks", {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: ctx.font,
    color: GREY_LIGHT,
  });
}

/* ──────────────────────────────────────────────────────────────── */
/*  TABLE OF CONTENTS                                                */
/* ──────────────────────────────────────────────────────────────── */

export function drawTableOfContents(ctx: DrawCtx, collection: Collection, playdates: PlaydateData[]): void {
  // Header
  drawRect(ctx.page, 0, PAGE_H - 8, PAGE_W, 8, REDWOOD);

  ctx.y = PAGE_H - MARGIN - 4;
  ctx.page.drawText("creaseworks", {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: ctx.fontBold,
    color: GREY_LIGHT,
  });
  ctx.y -= 20;

  // Title
  drawWrapped(ctx, "Table of Contents", MARGIN, 18, ctx.fontBold, CADET);
  ctx.y -= 12;

  // Divider
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: GREY_FAINT,
  });
  ctx.y -= 16;

  // List of playdates
  playdates.forEach((playdate, idx) => {
    ensureRoom(ctx, 16);

    const pageNum = idx + 3; // Cover = 1, TOC = 2, first playdate = 3

    ctx.page.drawText(`${playdate.title}`, {
      x: MARGIN,
      y: ctx.y,
      size: 11,
      font: ctx.font,
      color: CADET,
    });

    // Page number on right
    const pageNumStr = `${pageNum}`;
    const pageNumWidth = ctx.fontBold.widthOfTextAtSize(pageNumStr, 10);
    ctx.page.drawText(pageNumStr, {
      x: PAGE_W - MARGIN - pageNumWidth,
      y: ctx.y,
      size: 10,
      font: ctx.fontBold,
      color: GREY_LIGHT,
    });

    ctx.y -= 14;
  });
}

/* ──────────────────────────────────────────────────────────────── */
/*  PLAYDATE PAGE                                                    */
/* ──────────────────────────────────────────────────────────────── */

export function drawPlaydatePage(
  ctx: DrawCtx,
  playdate: PlaydateData,
  materials: Material[],
  collectionTitle: string,
): void {
  // Header bar with collection name
  drawRect(ctx.page, 0, PAGE_H - 8, PAGE_W, 8, REDWOOD);

  ctx.y = PAGE_H - MARGIN - 4;
  ctx.page.drawText(collectionTitle, {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: ctx.fontBold,
    color: GREY_LIGHT,
  });
  ctx.y -= 20;

  // Draw the same content structure as the single playdate PDF
  drawTitle(ctx, playdate);
  drawAtAGlance(ctx, playdate);
  drawBigIdea(ctx, playdate);
  drawHowToPlay(ctx, playdate);
  drawMaterials(ctx, playdate);
  drawLinkedMaterials(ctx, materials);
}

/* ──────────────────────────────────────────────────────────────── */
/*  PAGE NUMBER FOOTER                                               */
/* ──────────────────────────────────────────────────────────────── */

export function drawPageNumber(ctx: DrawCtx, pageNum: number, collectionTitle: string): void {
  // Draw page number in footer
  const pageNumStr = `page ${pageNum}`;
  ctx.page.drawText(pageNumStr, {
    x: MARGIN,
    y: 20,
    size: 8,
    font: ctx.font,
    color: GREY_LIGHT,
  });
}

/* ──────────────────────────────────────────────────────────────── */
/*  PLAYDATE CONTENT SECTIONS (reused from single PDF)               */
/* ──────────────────────────────────────────────────────────────── */

function drawTitle(ctx: DrawCtx, playdate: PlaydateData): void {
  // title
  drawWrapped(ctx, playdate.title, MARGIN, 24, ctx.fontBold, CADET);
  ctx.y -= 2;

  // headline
  if (playdate.headline) {
    drawWrapped(ctx, playdate.headline, MARGIN, 11, ctx.fontItalic, GREY);
    ctx.y -= 6;
  }

  // thin divider
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: GREY_FAINT,
  });
  ctx.y -= 16;
}

function drawAtAGlance(ctx: DrawCtx, playdate: PlaydateData): void {
  const colW = CONTENT_W / 2;
  const items: { label: string; value: string; emoji: string }[] = [];

  if (playdate.primary_function) {
    items.push({ emoji: "", label: "what's it about", value: formatList(playdate.primary_function) });
  }
  if (playdate.friction_dial) {
    items.push({ emoji: "", label: "energy level", value: frictionLabel(playdate.friction_dial) });
  }
  if (playdate.start_in_120s) {
    items.push({ emoji: "", label: "setup time", value: "under 2 minutes" });
  }
  if (playdate.required_forms) {
    items.push({ emoji: "", label: "skills", value: formatList(playdate.required_forms) });
  }
  if (playdate.slots_optional) {
    items.push({ emoji: "", label: "materials", value: formatList(playdate.slots_optional) });
  }

  // Draw items in 2-column grid
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * colW;
    const cardY = ctx.y - row * 36;

    ensureRoom(ctx, 38);

    // Card background
    drawRect(ctx.page, x, cardY - 32, colW - 6, 32, CHAMPAGNE_DARK);

    // Label
    ctx.page.drawText(sanitize(item.label), {
      x: x + 8,
      y: cardY - 10,
      size: 7,
      font: ctx.fontBold,
      color: GREY,
    });

    // Value
    const valueWords = item.value.split(/\s+/).filter(Boolean);
    let valueLine = "";
    for (const word of valueWords) {
      const test = valueLine ? `${valueLine} ${word}` : word;
      const testWidth = ctx.font.widthOfTextAtSize(test, 10);
      if (testWidth > colW - 16 && valueLine) {
        ctx.page.drawText(valueLine, {
          x: x + 8,
          y: cardY - 22,
          size: 10,
          font: ctx.fontBold,
          color: CADET,
        });
        valueLine = word;
        cardY;
      } else {
        valueLine = test;
      }
    }
    if (valueLine) {
      ctx.page.drawText(valueLine, {
        x: x + 8,
        y: cardY - 22,
        size: 10,
        font: ctx.fontBold,
        color: CADET,
      });
    }
  }

  ctx.y -= Math.ceil(items.length / 2) * 36 + 8;
}

function drawBigIdea(ctx: DrawCtx, playdate: PlaydateData): void {
  if (!playdate.rails_sentence) return;

  ensureRoom(ctx, 40);

  ctx.page.drawText("The Big Idea", {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.fontBold,
    color: CADET,
  });
  ctx.y -= 16;

  // Background card
  const textY = ctx.y;
  const maxH = 60;
  drawRect(ctx.page, MARGIN, textY - maxH, CONTENT_W, maxH, CHAMPAGNE);

  // Draw rails sentence inside card
  drawWrapped(ctx, playdate.rails_sentence, MARGIN + 8, 11, ctx.fontItalic, CADET, CONTENT_W - 16);
  ctx.y -= 8;
}

function drawHowToPlay(ctx: DrawCtx, playdate: PlaydateData): void {
  ensureRoom(ctx, 20);

  ctx.page.drawText("How to Play", {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.fontBold,
    color: CADET,
  });
  ctx.y -= 14;

  const phases = [
    { label: "find", text: playdate.find },
    { label: "fold", text: playdate.fold },
    { label: "unfold", text: playdate.unfold },
  ];

  for (const phase of phases) {
    if (!phase.text) continue;

    ensureRoom(ctx, 20);

    // Accent bar
    drawAccentBar(ctx.page, MARGIN, ctx.y - 2, 14, REDWOOD);

    // Phase label
    ctx.page.drawText(sanitize(phase.label), {
      x: MARGIN + 8,
      y: ctx.y,
      size: 10,
      font: ctx.fontBold,
      color: CADET,
    });
    ctx.y -= 12;

    // Phase text
    drawWrapped(ctx, phase.text, MARGIN + 8, 10, ctx.font, CADET, CONTENT_W - 16);
    ctx.y -= 8;
  }

  // Find again mode (optional)
  if (playdate.find_again_mode) {
    ensureRoom(ctx, 16);

    // Background
    drawRect(ctx.page, MARGIN, ctx.y - 12, CONTENT_W, 12, FIND_AGAIN_BG);

    ctx.page.drawText("Find Again Mode: " + sanitize(playdate.find_again_mode), {
      x: MARGIN + 4,
      y: ctx.y - 2,
      size: 9,
      font: ctx.fontBold,
      color: CADET,
    });
    ctx.y -= 16;

    if (playdate.find_again_prompt) {
      ensureRoom(ctx, 12);
      drawWrapped(ctx, playdate.find_again_prompt, MARGIN + 8, 9, ctx.fontItalic, CADET, CONTENT_W - 16);
      ctx.y -= 8;
    }
  }
}

function drawMaterials(ctx: DrawCtx, playdate: PlaydateData): void {
  const slots = playdate.required_forms ? formatList(playdate.required_forms) : "";
  const optional = playdate.slots_optional ? formatList(playdate.slots_optional) : "";

  if (!slots && !optional && !playdate.substitutions_notes) return;

  ensureRoom(ctx, 16);

  ctx.page.drawText("Materials & Swaps", {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.fontBold,
    color: CADET,
  });
  ctx.y -= 14;

  if (slots) {
    ensureRoom(ctx, 10);
    ctx.page.drawText("Required:", {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.fontBold,
      color: CADET,
    });
    ctx.y -= 10;

    drawWrapped(ctx, slots, MARGIN + 8, 10, ctx.font, CADET, CONTENT_W - 16);
    ctx.y -= 4;
  }

  if (optional) {
    ensureRoom(ctx, 10);
    ctx.page.drawText("Optional:", {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.fontBold,
      color: CADET,
    });
    ctx.y -= 10;

    drawWrapped(ctx, optional, MARGIN + 8, 10, ctx.font, CADET, CONTENT_W - 16);
    ctx.y -= 4;
  }

  if (playdate.substitutions_notes) {
    ensureRoom(ctx, 10);
    ctx.page.drawText("Swap Ideas:", {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.fontBold,
      color: CADET,
    });
    ctx.y -= 10;

    drawWrapped(ctx, playdate.substitutions_notes, MARGIN + 8, 10, ctx.fontItalic, CADET, CONTENT_W - 16);
    ctx.y -= 4;
  }
}

function drawLinkedMaterials(ctx: DrawCtx, materials: Material[]): void {
  if (materials.length === 0) return;

  ensureRoom(ctx, 16);

  ctx.page.drawText("Linked Materials", {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.fontBold,
    color: CADET,
  });
  ctx.y -= 14;

  for (const mat of materials) {
    ensureRoom(ctx, 12);

    // Bullet
    ctx.page.drawText("•", {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.font,
      color: CADET,
    });

    // Material title
    const title = sanitize(mat.title);
    const form = mat.form_primary ? ` (${mat.form_primary})` : "";

    drawWrapped(ctx, title + form, MARGIN + 8, 10, ctx.font, CADET, CONTENT_W - 16);
    ctx.y -= 2;
  }
}
