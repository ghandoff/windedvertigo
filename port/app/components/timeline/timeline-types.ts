// Generic, data-agnostic shapes for the shared timeline/Gantt engine.
// Both /pam (commitments, interactive) and /strategy (campaigns, read-only)
// map their domain rows into these shapes.

export type Zoom = "week" | "month" | "quarter";

export interface TimelineMilestone {
  date: string; // YYYY-MM-DD
  label: string;
}

export interface TimelineBar {
  id: string;
  /** which lane (row group) this bar belongs to — e.g. a person or "" for ungrouped */
  laneKey: string;
  /** short label shown in the left column for this row */
  label: string;
  /** YYYY-MM-DD; when null the bar renders as a milestone diamond at `end` */
  start: string | null;
  /** YYYY-MM-DD end / due date; when null the bar is unscheduled (listed, not plotted) */
  end: string | null;
  /** CSS color for the bar fill */
  color: string;
  /** optional status string (drives a small dot / tooltip) */
  status?: string;
  /** ids of bars this one depends on — drawn as dependency arrows */
  dependsOn?: string[];
  /** point-in-time markers rendered as diamonds on the bar row */
  milestones?: TimelineMilestone[];
  /** when false, the bar cannot be dragged/resized (read-only timelines) */
  interactive?: boolean;
}

export interface TimelineLane {
  key: string;
  label: string;
}

/** which edge a resize drag is acting on, or "move" for a whole-bar drag */
export type DragKind = "move" | "start" | "end";
