/**
 * paper.trail — core types
 *
 * Physical-digital bridge: activities guide physical making,
 * camera captures the result, annotations add meaning.
 */

// ── Activity (from Notion) ─────────────────────────────────

export type ActivityAudience =
  | "parent + kid"
  | "solo adult"
  | "facilitator"
  | "family";

export interface Activity {
  slug: string;
  title: string;
  description: string;
  materials: string[];
  steps: ActivityStep[];
  capturePrompts: string[];
  skillSlugs: string[];
  difficulty: "starter" | "explorer" | "maker";
  audience?: ActivityAudience;
  coverImageUrl?: string;
}

export interface ActivityStep {
  order: number;
  instruction: string;
  hint?: string;
}

// ── Capture (photo + annotations) ──────────────────────────

export interface Capture {
  id: string;
  activitySlug: string;
  timestamp: string;
  imageDataUrl: string; // base64 data URL from canvas
  annotations: Annotation[];
  promptUsed?: string;
  notes?: string;
  // Activity metadata snapshot (fetched at capture time so the gallery
  // can surface real skills + titles without re-hitting Notion).
  activityTitle?: string;
  activitySkills?: string[];
}

export type Annotation =
  | StampAnnotation
  | ArrowAnnotation
  | TextAnnotation;

interface AnnotationBase {
  id: string;
  x: number;
  y: number;
}

export interface StampAnnotation extends AnnotationBase {
  type: "stamp";
  emoji: string;
  size: number;
}

export interface ArrowAnnotation extends AnnotationBase {
  type: "arrow";
  endX: number;
  endY: number;
  color: string;
}

export interface TextAnnotation extends AnnotationBase {
  type: "text";
  content: string;
  color: string;
  fontSize: number;
}

// ── Gallery ────────────────────────────────────────────────

export interface GalleryEntry {
  capture: Capture;
  activityTitle: string;
}
