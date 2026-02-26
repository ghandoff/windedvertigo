import type { PDFDocument, PDFPage, PDFFont } from "pdf-lib";

export interface DrawCtx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
  fontBoldItalic: PDFFont;
}
