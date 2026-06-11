import { supabase } from "./client";

export interface OpsyDecision {
  id: string;
  created_at: string;
  who: string;
  session_type: string;
  summary: string;
  decisions: string[];
  tags: string[];
  raw_context: string | null;
}

export interface OpsyMemoryEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export interface OpsyIncident {
  id: string;
  service: string;
  severity: "critical" | "warning" | "info";
  symptoms: string;
  cause: string | null;
  remediation: string | null;
  auto_fixed: boolean;
  status: "open" | "investigating" | "resolved" | "monitoring";
  opened_at: string;
  resolved_at: string | null;
  related_incidents: string[] | null;
  metadata: Record<string, unknown>;
}

export interface OpsyHealthCheck {
  id: string;
  service: string;
  status: "green" | "amber" | "red";
  response_time_ms: number | null;
  error_rate: number | null;
  details: Record<string, unknown>;
  checked_at: string;
}

export interface OpsyAutoFix {
  id: string;
  incident_id: string | null;
  action: string;
  result: "success" | "failure" | "partial";
  details: Record<string, unknown>;
  executed_at: string;
}

export interface OpsyPattern {
  id: string;
  pattern_type: string;
  description: string;
  services: string[];
  occurrence_count: number;
  last_seen: string;
  recommendation: string | null;
}

// ── decisions + memory (same shape as cmo/pam/carl) ──────────────────────────

export async function insertOpsyDecision(data: {
  who: string;
  summary: string;
  decisions?: string[];
  tags?: string[];
  session_type?: string;
  raw_context?: string;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await supabase
    .from("opsy_decisions")
    .insert({
      who: data.who,
      summary: data.summary,
      decisions: data.decisions ?? [],
      tags: data.tags ?? [],
      session_type: data.session_type ?? "cowork",
      raw_context: data.raw_context ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) throw error;
  return row;
}

export async function getOpsyDecisions(opts: {
  days?: number;
  who?: string;
  tag?: string;
  limit?: number;
}): Promise<OpsyDecision[]> {
  let query = supabase
    .from("opsy_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.days) {
    const since = new Date();
    since.setDate(since.getDate() - opts.days);
    query = query.gte("created_at", since.toISOString());
  }
  if (opts.who) query = query.eq("who", opts.who);
  if (opts.tag) query = query.contains("tags", [opts.tag]);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertOpsyMemory(
  key: string,
  value: string,
  updatedBy: string,
): Promise<{ key: string; updated_at: string }> {
  const { data, error } = await supabase
    .from("opsy_memory")
    .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select("key, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getOpsyMemory(): Promise<OpsyMemoryEntry[]> {
  const { data, error } = await supabase
    .from("opsy_memory")
    .select("*")
    .order("key");

  if (error) throw error;
  return data ?? [];
}

// ── incidents ─────────────────────────────────────────────────────────────────

export async function insertOpsyIncident(data: {
  service: string;
  severity: OpsyIncident["severity"];
  symptoms: string;
  cause?: string;
  remediation?: string;
  auto_fixed?: boolean;
  status?: OpsyIncident["status"];
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; opened_at: string }> {
  const { data: row, error } = await supabase
    .from("opsy_incidents")
    .insert({
      service: data.service,
      severity: data.severity,
      symptoms: data.symptoms,
      cause: data.cause ?? null,
      remediation: data.remediation ?? null,
      auto_fixed: data.auto_fixed ?? false,
      status: data.status ?? "open",
      metadata: data.metadata ?? {},
    })
    .select("id, opened_at")
    .single();

  if (error) throw error;
  return row;
}

export async function getOpsyIncidents(opts: {
  status?: string;
  severity?: string;
  service?: string;
  since?: string;
  limit?: number;
}): Promise<OpsyIncident[]> {
  let query = supabase
    .from("opsy_incidents")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.status) query = query.eq("status", opts.status);
  if (opts.severity) query = query.eq("severity", opts.severity);
  if (opts.service) query = query.eq("service", opts.service);
  if (opts.since) query = query.gte("opened_at", opts.since);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * The open incident the health checker itself created for a service, if any.
 * Used both to dedupe (don't open a second incident while one is live) and to
 * auto-resolve when the service recovers. Human-logged incidents are left alone.
 */
export async function getOpenAutoIncident(service: string): Promise<OpsyIncident | null> {
  const { data, error } = await supabase
    .from("opsy_incidents")
    .select("*")
    .eq("service", service)
    .in("status", ["open", "investigating", "monitoring"])
    .eq("metadata->>auto_created", "true")
    .order("opened_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

export async function resolveOpsyIncident(
  id: string,
  remediation: string,
): Promise<void> {
  const { error } = await supabase
    .from("opsy_incidents")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), remediation })
    .eq("id", id);

  if (error) throw error;
}

// ── health checks ─────────────────────────────────────────────────────────────

export async function insertOpsyHealthChecks(
  rows: Array<{
    service: string;
    status: OpsyHealthCheck["status"];
    response_time_ms: number | null;
    details: Record<string, unknown>;
  }>,
): Promise<void> {
  const { error } = await supabase.from("opsy_health_checks").insert(rows);
  if (error) throw error;
}

/** Most recent check per service (scans the last 2h of rows, newest first). */
export async function getLatestHealthChecks(): Promise<OpsyHealthCheck[]> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("opsy_health_checks")
    .select("*")
    .gte("checked_at", since)
    .order("checked_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  const latest = new Map<string, OpsyHealthCheck>();
  for (const row of data ?? []) {
    if (!latest.has(row.service)) latest.set(row.service, row);
  }
  return [...latest.values()];
}

/**
 * Check history for uptime/p95 rollups. 24h of 5-minute tier-1 checks is
 * ~290 rows per service — select only the rollup columns to keep it light.
 */
export async function getHealthHistory(hours: number): Promise<
  Array<Pick<OpsyHealthCheck, "service" | "status" | "response_time_ms" | "checked_at">>
> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("opsy_health_checks")
    .select("service, status, response_time_ms, checked_at")
    .gte("checked_at", since)
    .order("checked_at", { ascending: false })
    .limit(5000);

  if (error) throw error;
  return data ?? [];
}

// ── auto-fixes + patterns (read paths for briefing; writes land in phase 2) ──

export async function getRecentAutoFixes(days: number): Promise<OpsyAutoFix[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("opsy_auto_fixes")
    .select("*")
    .gte("executed_at", since.toISOString())
    .order("executed_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function getOpsyPatterns(): Promise<OpsyPattern[]> {
  const { data, error } = await supabase
    .from("opsy_patterns")
    .select("*")
    .order("last_seen", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}
