/**
 * Shared enum values — single source of truth.
 *
 * These power both the server-side validation (runs.ts) and the
 * client-side form UI (run-form.tsx).
 *
 * Values originate from DESIGN.md appendix F.
 * Future: pull from a Notion "form enums" database via cron sync.
 */

export const RUN_TYPES = [
  "internal practice",
  "webinar",
  "delivery",
  "BD/prospect",
  "R&D",
] as const;

export const TRACE_EVIDENCE_OPTIONS = [
  "photo",
  "video",
  "quote",
  "artifact",
  "notes",
] as const;

export const CONTEXT_TAGS = [
  "classroom",
  "home",
  "remote",
  "low-resource",
  "travel-kit",
  "mess-sensitive",
] as const;

/* Derived types for consumers that need them */
export type RunType = (typeof RUN_TYPES)[number];
export type TraceEvidenceOption = (typeof TRACE_EVIDENCE_OPTIONS)[number];
export type ContextTag = (typeof CONTEXT_TAGS)[number];
