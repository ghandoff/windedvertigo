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

export function drawHeader(ctx: DrawCtx, fontBold: PDFFont): void {
  // header bar
  drawRect(ctx.page, 0, PAGE_H - 8, PAGE_W, 8, REDWOOD);

  // brand mark
  ctx.y = PAGE_H - MARGIN - 4;
  ctx.page.drawText("creaseworks", {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: fontBold,
    color: GREY_LIGHT,
  });
  ctx.y -= 20;
}

export function drawTitle(ctx: DrawCtx, playdate: PlaydateData, fontBold: PDFFont, fontItalic: PDFFont): void {
  // title
  drawWrapped(ctx, playdate.title, MARGIN, 24, fontBold, CADET);
  ctx.y -= 2;

  // headline
  if (playdate.headline) {
    drawWrapped(ctx, playdate.headline, MARGIN, 11, fontItalic, GREY);
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

export function drawAtAGlance(ctx: DrawCtx, playdate: PlaydateData, font: PDFFont, fontBold: PDFFont): void {
  const colW = CONTENT_W / 2;
  const items: { label: string; value: string; emoji: string }[] = [];

  if (playdate.primary_function) {
    items.push({ emoji: "", label: "what's it about", value: formatList(playdate.primary_function) });
  }
  if (playdate.friction_dial) {
    items.push({ emoji: "", label: "energy level", value: frictionLabel(playdate.friction_dial) });
  }
  if (playdate.start_in_120s !== null && playdate.start_in_120s !== undefined) {
    items.push({
      emoji: "",
      label: "setup time",
      value: playdate.start_in_120s ? "ready in under 2 minutes" : "needs a little prep",
    });
  }
  if (playdate.arc_emphasis) {
    items.push({ emoji: "", label: "what kids practise", value: formatList(playdate.arc_emphasis) });
  }
  if (playdate.required_forms) {
    items.push({ emoji: "", label: "what you'll gather", value: formatList(playdate.required_forms) });
  }
  if (playdate.slots_optional) {
    items.push({ emoji: "", label: "nice to have", value: formatList(playdate.slots_optional) });
  }

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
        x,
        y: iy,
        size: 7.5,
        font: fontBold,
        color: GREY,
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

export function drawBigIdea(ctx: DrawCtx, playdate: PlaydateData, fontBold: PDFFont, fontItalic: PDFFont): void {
  if (!playdate.rails_sentence) {
    return;
  }

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
    x: MARGIN + 14,
    y: ctx.y - 18,
    size: 9,
    font: fontBold,
    color: CADET,
  });
  // draw the sentence
  const savedY = ctx.y;
  ctx.y = ctx.y - 34;
  drawWrapped(ctx, playdate.rails_sentence, MARGIN + 14, 11, fontItalic, CADET, CONTENT_W - 28, 16);
  ctx.y = savedY - cardH - 10;
}

export function drawHowToPlay(ctx: DrawCtx, playdate: PlaydateData, font: PDFFont, fontBold: PDFFont): void {
  ensureRoom(ctx, 30);
  ctx.page.drawText("how to play", {
    x: MARGIN,
    y: ctx.y,
    size: 13,
    font: fontBold,
    color: CADET,
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
      x: MARGIN + 12,
      y: ctx.y - 16,
      size: 11,
      font: fontBold,
      color: phase.accent,
    });
    // subtitle
    ctx.page.drawText(phase.subtitle, {
      x: MARGIN + 12,
      y: ctx.y - 28,
      size: 7.5,
      font,
      color: GREY,
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
      x: MARGIN + 12,
      y: ctx.y - 16,
      size: 11,
      font: fontBold,
      color: REDWOOD,
    });
    ctx.page.drawText("try it again with a twist", {
      x: MARGIN + 12,
      y: ctx.y - 28,
      size: 7.5,
      font,
      color: GREY,
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

export function drawMaterials(ctx: DrawCtx, playdate: PlaydateData, font: PDFFont, fontBold: PDFFont): void {
  // material tips
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
      x: MARGIN + 12,
      y: ctx.y - 16,
      size: 9,
      font: fontBold,
      color: CADET,
    });
    const savedY = ctx.y;
    ctx.y = ctx.y - 32;
    drawWrapped(ctx, playdate.slots_notes, MARGIN + 12, 10, font, CADET, CONTENT_W - 24, 14);
    ctx.y = savedY - cardH - 8;
  }

  // swap ideas
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
      x: MARGIN + 12,
      y: ctx.y - 16,
      size: 9,
      font: fontBold,
      color: CADET,
    });
    const savedY = ctx.y;
    ctx.y = ctx.y - 32;
    drawWrapped(ctx, playdate.substitutions_notes, MARGIN + 12, 10, font, CADET, CONTENT_W - 24, 14);
    ctx.y = savedY - cardH - 8;
  }
}

export function drawLinkedMaterials(ctx: DrawCtx, materials: Material[], font: PDFFont, fontBold: PDFFont): void {
  if (materials.length > 0) {
    ensureRoom(ctx, 50);
    ctx.y -= 4;
    ctx.page.drawText("what you'll need", {
      x: MARGIN,
      y: ctx.y,
      size: 13,
      font: fontBold,
      color: CADET,
    });
    ctx.y -= 18;

    for (const mat of materials) {
      ensureRoom(ctx, 20);
      const label = sanitize(mat.form_primary || "material");
      const title = sanitize(mat.title);
      ctx.page.drawText(`${label}: ${title}`, {
        x: MARGIN + 8,
        y: ctx.y,
        size: 9,
        font,
        color: CADET,
      });
      ctx.y -= 14;
    }
    ctx.y -= 4;
  }
}

export function drawWatermark(
  ctx: DrawCtx,
  session: { orgName: string | null; email: string },
  packTitle: string | null,
): void {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const watermark = sanitize(
    [session.orgName || "personal", session.email, packTitle || "internal", `${dd}/${mm}/${yyyy}`].join("  \u00b7  "),
  );

  const allPages = ctx.doc.getPages();
  for (const pg of allPages) {
    // bottom accent line
    pg.drawLine({
      start: { x: MARGIN, y: FOOTER_ZONE },
      end: { x: PAGE_W - MARGIN, y: FOOTER_ZONE },
      thickness: 0.5,
      color: GREY_FAINT,
    });
    pg.drawText(watermark, {
      x: MARGIN,
      y: FOOTER_ZONE - 14,
      size: 6.5,
      font: ctx.font,
      color: GREY_LIGHT,
    });
    pg.drawText("creaseworks \u00b7 windedvertigo.com", {
      x: MARGIN,
      y: FOOTER_ZONE - 23,
      size: 6,
      font: ctx.fontItalic,
      color: GREY_FAINT,
    });
  }
}
