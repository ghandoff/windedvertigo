/**
 * vinay run heartbeat — every anticipation sweep records here, ok OR error, so
 * a silent no-op is visible (the spine fails open; a "did you forget X" agent
 * that silently stops running is the worst failure mode — phase-0 review #11).
 */

import { vinayDb } from "./client";

export interface VinayRun {
  id: string;
  kind: string;
  status: "ok" | "error";
  detail: string | null;
  ran_at: string;
}

export async function recordVinayRun(
  kind: string,
  status: "ok" | "error",
  detail?: string | null,
): Promise<void> {
  const { error } = await vinayDb.from("vinay_runs").insert({ kind, status, detail: detail ?? null });
  if (error) throw error;
}

export async function getLatestVinayRun(kind?: string): Promise<VinayRun | null> {
  let q = vinayDb.from("vinay_runs").select("*").order("ran_at", { ascending: false }).limit(1);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data as VinayRun) ?? null;
}
