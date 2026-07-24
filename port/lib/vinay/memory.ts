/**
 * vinay working-state memory — durable key/value facts about garrett's world
 * that vinay loads at the start of a session (e.g. "current-focus",
 * "learning-queue"). Mirrors the pam_memory shape (lib/supabase/pam.ts).
 */

import { vinayDb } from "./client";

export interface VinayMemoryEntry {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export async function upsertVinayMemory(
  key: string,
  value: string,
  updatedBy: string,
): Promise<{ key: string; updated_at: string }> {
  const { data, error } = await vinayDb
    .from("vinay_memory")
    .upsert(
      { key, value, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
    .select("key, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getVinayMemory(): Promise<VinayMemoryEntry[]> {
  const { data, error } = await vinayDb.from("vinay_memory").select("*").order("key");
  if (error) throw error;
  return data ?? [];
}
