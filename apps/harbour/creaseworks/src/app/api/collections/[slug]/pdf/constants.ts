import { rgb } from "pdf-lib";

/* ── colour palette ────────────────────────────────────────────── */
export const CADET = rgb(0.153, 0.196, 0.282);       // #273248
export const REDWOOD = rgb(0.694, 0.314, 0.263);      // #b15043
export const CHAMPAGNE = rgb(0.992, 0.976, 0.953);    // #fdf9f3
export const CHAMPAGNE_DARK = rgb(0.965, 0.937, 0.902); // slightly darker for cards
export const GREY = rgb(0.5, 0.5, 0.5);
export const GREY_LIGHT = rgb(0.7, 0.7, 0.7);
export const GREY_FAINT = rgb(0.85, 0.85, 0.85);
export const WHITE = rgb(1, 1, 1);
export const FIND_AGAIN_BG = rgb(0.992, 0.949, 0.937); // warm pinkish tint

/* ── page layout ───────────────────────────────────────────────── */
export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 48;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const FOOTER_ZONE = 42; // reserved for page number and watermark
