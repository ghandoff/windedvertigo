/**
 * Types for run queries.
 */

export interface RunRow {
  id: string;
  title: string;
  playdate_title: string | null;
  playdate_slug: string | null;
  run_type: string | null;
  run_date: string | null;
  context_tags: string[];
  trace_evidence: string[];
  what_changed: string | null;
  next_iteration: string | null;
  materials: { id: string; title: string }[];
  created_by: string | null;
  org_id: string | null;
  created_at: string | null;
}

export interface CreateRunInput {
  title: string;
  playdateId: string | null;
  runType: string;
  runDate: string;
  contextTags: string[];
  traceEvidence: string[];
  whatChanged: string | null;
  nextIteration: string | null;
  materialIds: string[];
  /** Flag this run as a "find again" moment — playbook badge tier */
  isFindAgain?: boolean;
}

/**
 * Session visibility context.
 */
export interface SessionVisibility {
  userId: string;
  orgId: string | null;
  isAdmin: boolean;
}

/**
 * Session context for authorization checks (minimal).
 */
export interface SessionMinimal {
  userId: string;
}

/**
 * Session context for export operations.
 */
export interface SessionExport extends SessionVisibility {
  isInternal: boolean;
}
