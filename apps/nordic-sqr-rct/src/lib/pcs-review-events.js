/**
 * Supabase persistence for the expert-in-the-loop review gate.
 *
 * Three resources:
 *   - pcs_review_events   — append-only audit log (one row per gate action)
 *   - pcs_governance_config — singleton governance toggle + defaults
 *   - pcs_governance_rules  — admin/RA-defined gate rules
 *
 * Pattern mirrors other pcs-*.js helpers: Supabase path gated by
 * shouldReadFromPostgres() / SUPABASE_NORDIC_URL presence; callers get a
 * sensible no-op when the DB isn't configured (e.g. local dev without env).
 *
 * The audit log is APPEND-ONLY. Never call updateReviewEvent() or
 * deleteReviewEvent(). The Postgres migration adds a rule to enforce this
 * at the DB level too.
 */

import { getPcsSupabase } from './supabase-pcs.js';
import { DEFAULT_GOVERNANCE_CONFIG } from './review-gate.js';

// ─── Feature flag ────────────────────────────────────────────────────────────

function shouldUsePostgres() {
  const sb = getPcsSupabase();
  if (!sb) return false;
  const flag = process.env.PCS_READ_FROM_POSTGRES;
  return flag === '1' || flag === 'true';
}

// ─── Governance config ───────────────────────────────────────────────────────

/**
 * Reads the singleton governance config row.
 * Returns DEFAULT_GOVERNANCE_CONFIG if DB unavailable or row missing.
 */
export async function getGovernanceConfig() {
  if (!shouldUsePostgres()) return { ...DEFAULT_GOVERNANCE_CONFIG };

  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_governance_config')
    .select('*')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error || !data) return { ...DEFAULT_GOVERNANCE_CONFIG };

  return parseGovernanceConfigRow(data);
}

/**
 * Updates the singleton governance config. Only super-users reach this
 * (enforced in the API route via requireCapability).
 */
export async function saveGovernanceConfig(fields) {
  if (!shouldUsePostgres()) {
    return { ...DEFAULT_GOVERNANCE_CONFIG, ...fields };
  }

  const sb = getPcsSupabase();
  const row = {
    id: 'singleton',
    governance_enabled: fields.governanceEnabled ?? DEFAULT_GOVERNANCE_CONFIG.governanceEnabled,
    capture_history_when_off: fields.captureHistoryWhenOff ?? DEFAULT_GOVERNANCE_CONFIG.captureHistoryWhenOff,
    auto_approve_confidence_threshold: fields.autoApproveConfidenceThreshold ?? DEFAULT_GOVERNANCE_CONFIG.autoApproveConfidenceThreshold,
    default_mode: fields.defaultMode ?? DEFAULT_GOVERNANCE_CONFIG.defaultMode,
    toggled_at: fields.toggledAt ?? null,
    toggled_by: fields.toggledBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from('pcs_governance_config')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new Error(`saveGovernanceConfig: ${error.message}`);
  return parseGovernanceConfigRow(data);
}

function parseGovernanceConfigRow(row) {
  return {
    governanceEnabled: row.governance_enabled ?? false,
    captureHistoryWhenOff: row.capture_history_when_off ?? true,
    autoApproveConfidenceThreshold: parseFloat(row.auto_approve_confidence_threshold) || 0.90,
    defaultMode: row.default_mode ?? 'human-first-ai-verify',
    toggledAt: row.toggled_at ?? null,
    toggledBy: row.toggled_by ?? null,
  };
}

// ─── Governance rules ─────────────────────────────────────────────────────────

/**
 * Returns all active (and optionally inactive) gate rules.
 */
export async function getGovernanceRules({ includeInactive = false } = {}) {
  if (!shouldUsePostgres()) return [];

  const sb = getPcsSupabase();
  let q = sb.from('pcs_governance_rules').select('*').order('created_at', { ascending: true });
  if (!includeInactive) q = q.eq('active', true);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(parseGovernanceRuleRow);
}

/**
 * Creates a new gate rule. Returns the created rule.
 */
export async function createGovernanceRule(fields) {
  if (!shouldUsePostgres()) {
    return {
      id: `rule_${Date.now()}`,
      ...fields,
      active: true,
      createdAt: new Date().toISOString(),
    };
  }

  const sb = getPcsSupabase();
  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    id,
    record_type: fields.recordType,
    required_mode: fields.requiredMode ?? null,
    require_dual_review: fields.requireDualReview ?? false,
    min_confidence_for_auto_approve: fields.minConfidenceForAutoApprove ?? null,
    block_auto_approve_below: fields.blockAutoApproveBelow ?? null,
    description: fields.description,
    active: fields.active !== false,
    created_by: fields.createdBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from('pcs_governance_rules')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`createGovernanceRule: ${error.message}`);
  return parseGovernanceRuleRow(data);
}

/**
 * Toggles a rule's active state. Returns the updated rule.
 */
export async function toggleGovernanceRule(id, active) {
  if (!shouldUsePostgres()) return { id, active };

  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_governance_rules')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`toggleGovernanceRule: ${error.message}`);
  return parseGovernanceRuleRow(data);
}

function parseGovernanceRuleRow(row) {
  return {
    id: row.id,
    recordType: row.record_type,
    requiredMode: row.required_mode ?? null,
    requireDualReview: row.require_dual_review ?? false,
    minConfidenceForAutoApprove: row.min_confidence_for_auto_approve != null
      ? parseFloat(row.min_confidence_for_auto_approve)
      : null,
    blockAutoApproveBelow: row.block_auto_approve_below != null
      ? parseFloat(row.block_auto_approve_below)
      : null,
    description: row.description,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ─── Audit log (pcs_review_events) ───────────────────────────────────────────

/**
 * Appends an audit event to the review log. This is the only write operation
 * on pcs_review_events — no updates, no deletes.
 *
 * @param {ReturnType<import('./review-gate.js').createAuditEvent>} auditEvent
 */
export async function appendReviewEvent(auditEvent) {
  if (!shouldUsePostgres()) {
    return auditEvent;
  }

  const sb = getPcsSupabase();
  const row = {
    id: auditEvent.id,
    record_id: auditEvent.recordId,
    record_type: auditEvent.recordType,
    action: auditEvent.action,
    actor_id: auditEvent.actor.id,
    actor_email: auditEvent.actor.email,
    actor_name: auditEvent.actor.name ?? null,
    actor_roles: auditEvent.actor.roles ?? [],
    mode: auditEvent.mode,
    automation_suggestion: auditEvent.automationSuggestion ?? null,
    expert_value: auditEvent.expertValue ?? null,
    diff: auditEvent.diff ?? null,
    review_duration_ms: auditEvent.reviewDurationMs ?? null,
    confidence_score: auditEvent.confidenceScore ?? null,
    notes: auditEvent.notes ?? null,
    rule_id: auditEvent.ruleId ?? null,
    created_at: auditEvent.createdAt,
  };

  const { data, error } = await sb
    .from('pcs_review_events')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`appendReviewEvent: ${error.message}`);
  return parseReviewEventRow(data);
}

/**
 * Reads the review event log for a specific record (full version history).
 */
export async function getReviewEvents(recordId, recordType) {
  if (!shouldUsePostgres()) return [];

  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_review_events')
    .select('*')
    .eq('record_id', recordId)
    .eq('record_type', recordType)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []).map(parseReviewEventRow);
}

/**
 * Returns the current gate status for a record by inspecting its event log.
 * Delegates to the pure `deriveGateStatus()` in review-gate.js so the
 * derivation logic is testable without a live database.
 *
 * Returns null if no events exist (record is pre-gate or not in the gate flow).
 */
export async function getRecordGateStatus(recordId, recordType) {
  const events = await getReviewEvents(recordId, recordType);
  if (events.length === 0) return null;

  const { deriveGateStatus } = await import('./review-gate.js');
  return deriveGateStatus(events);
}

/**
 * Returns review events in a date range, optionally filtered by record type.
 * Used by the governance metrics route.
 */
export async function getReviewEventsPeriod({ periodDays = 30, recordType = null } = {}) {
  if (!shouldUsePostgres()) return [];

  const sb = getPcsSupabase();
  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString();

  let q = sb
    .from('pcs_review_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (recordType) q = q.eq('record_type', recordType);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(parseReviewEventRow);
}

function parseReviewEventRow(row) {
  return {
    id: row.id,
    recordId: row.record_id,
    recordType: row.record_type,
    action: row.action,
    actor: {
      id: row.actor_id,
      email: row.actor_email,
      name: row.actor_name ?? null,
      roles: row.actor_roles ?? [],
    },
    actorEmail: row.actor_email,
    mode: row.mode,
    automationSuggestion: row.automation_suggestion ?? null,
    expertValue: row.expert_value ?? null,
    diff: row.diff ?? null,
    reviewDurationMs: row.review_duration_ms ?? null,
    confidenceScore: row.confidence_score != null ? parseFloat(row.confidence_score) : null,
    notes: row.notes ?? null,
    ruleId: row.rule_id ?? null,
    createdAt: row.created_at,
  };
}
