"use client";

import { jsPDF } from "jspdf";
import type {
  ReportData,
  PersonSummary,
  FamilyGroupSheetData,
  AncestorReportData,
  DescendantReportData,
} from "./actions";

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

const MARGIN = 20; // mm
const PAGE_WIDTH = 210; // A4
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_BODY = 10;
const FONT_TITLE = 14;
const FONT_SECTION = 12;
const LINE_HEIGHT = 5; // mm per line at body size

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function formatEvent(e: PersonSummary["events"][number]): string {
  const parts = [e.type + ":"];
  if (e.date) parts.push(e.date);
  if (e.description) parts.push("—", e.description);
  return parts.join(" ");
}

type PdfContext = {
  doc: jsPDF;
  y: number;
  pageCount: number;
};

function ensureSpace(ctx: PdfContext, needed: number): void {
  if (ctx.y + needed > PAGE_HEIGHT - MARGIN) {
    ctx.doc.addPage();
    ctx.pageCount++;
    ctx.y = MARGIN;
  }
}

function drawText(
  ctx: PdfContext,
  text: string,
  x: number,
  fontSize: number,
  style: "normal" | "bold" = "normal",
): void {
  ctx.doc.setFontSize(fontSize);
  ctx.doc.setFont("helvetica", style);
  const lineH = fontSize * 0.45; // approx mm per line
  const lines = ctx.doc.splitTextToSize(text, CONTENT_WIDTH - (x - MARGIN));
  for (const line of lines) {
    ensureSpace(ctx, lineH + 1);
    ctx.doc.text(line, x, ctx.y);
    ctx.y += lineH + 1;
  }
}

function drawSeparator(ctx: PdfContext): void {
  ensureSpace(ctx, 4);
  ctx.y += 2;
  ctx.doc.setDrawColor(180);
  ctx.doc.setLineWidth(0.3);
  ctx.doc.line(MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y);
  ctx.y += 2;
}

function renderPersonBlock(
  ctx: PdfContext,
  person: PersonSummary,
  label: string | undefined,
  indent: number = 0,
): void {
  const x = MARGIN + indent;

  if (label) {
    drawText(ctx, label, x, FONT_BODY, "bold");
  }

  // name line
  let nameLine = person.name;
  if (person.sex) nameLine += ` (${person.sex})`;
  if (person.isLiving) nameLine += " — living";
  drawText(ctx, nameLine, x, FONT_BODY, "bold");

  // events
  for (const e of person.events) {
    drawText(ctx, formatEvent(e), x + 4, FONT_BODY - 1);
  }

  ctx.y += 2;
}

function addHeader(ctx: PdfContext, title: string): void {
  drawText(ctx, title, MARGIN, FONT_TITLE, "bold");
  ctx.doc.setFontSize(FONT_BODY - 1);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setTextColor(120);
  ctx.doc.text(`generated ${new Date().toLocaleDateString()}`, MARGIN, ctx.y);
  ctx.y += LINE_HEIGHT;
  ctx.doc.setTextColor(0);
  ctx.y += 2;
}

function addPageNumbers(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140);
    const text = `page ${i} of ${total}`;
    const w = doc.getTextWidth(text);
    doc.text(text, PAGE_WIDTH - MARGIN - w, PAGE_HEIGHT - 10);
    doc.setTextColor(0);
  }
}

// ---------------------------------------------------------------------------
// report-specific renderers
// ---------------------------------------------------------------------------

function renderFamilyGroupSheet(ctx: PdfContext, data: FamilyGroupSheetData): void {
  addHeader(ctx, "family group sheet");

  renderPersonBlock(ctx, data.principal, "principal");

  for (const s of data.spouses) {
    drawSeparator(ctx);
    renderPersonBlock(ctx, s.person, "spouse / partner");

    if (s.children.length > 0) {
      drawText(ctx, "children", MARGIN + 8, FONT_BODY, "bold");
      for (const c of s.children) {
        renderPersonBlock(ctx, c, undefined, 8);
      }
    }
  }
}

function generationLabel(gen: number): string {
  const labels = [
    "self",
    "parents",
    "grandparents",
    "great-grandparents",
    "2x great-grandparents",
    "3x great-grandparents",
  ];
  return labels[gen] ?? `${gen - 2}x great-grandparents`;
}

function renderAncestorReport(ctx: PdfContext, data: AncestorReportData): void {
  addHeader(ctx, "ancestor report (ahnentafel)");

  renderPersonBlock(ctx, data.principal, "1. self");

  // group by generation
  const byGen = new Map<number, typeof data.ancestors>();
  for (const a of data.ancestors) {
    const list = byGen.get(a.generation) ?? [];
    list.push(a);
    byGen.set(a.generation, list);
  }
  const gens = [...byGen.keys()].sort((a, b) => a - b);

  for (const gen of gens) {
    drawSeparator(ctx);
    drawText(
      ctx,
      `generation ${gen} — ${generationLabel(gen)}`,
      MARGIN,
      FONT_SECTION,
      "bold",
    );
    ctx.y += 1;
    for (const a of byGen.get(gen)!) {
      renderPersonBlock(ctx, a.person, `${a.number}.`, 6);
    }
  }
}

function renderDescendantReport(ctx: PdfContext, data: DescendantReportData): void {
  addHeader(ctx, "descendant report");

  renderPersonBlock(ctx, data.principal, "root");

  for (const d of data.descendants) {
    const indent = d.depth * 6;
    renderPersonBlock(ctx, d.person, undefined, indent);
  }
}

// ---------------------------------------------------------------------------
// main generator
// ---------------------------------------------------------------------------

function generatePdf(data: ReportData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: PdfContext = { doc, y: MARGIN, pageCount: 1 };

  switch (data.type) {
    case "family_group_sheet":
      renderFamilyGroupSheet(ctx, data);
      break;
    case "ancestor_report":
      renderAncestorReport(ctx, data);
      break;
    case "descendant_report":
      renderDescendantReport(ctx, data);
      break;
  }

  addPageNumbers(doc);

  const filename = `${data.type.replace(/_/g, "-")}-${data.principal.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export function PdfExportButton({ data }: { data: ReportData }) {
  return (
    <button
      type="button"
      onClick={() => generatePdf(data)}
      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 transition-opacity"
    >
      download pdf
    </button>
  );
}
