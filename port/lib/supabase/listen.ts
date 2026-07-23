import { supabase } from "./client";

/**
 * Listen-library data access (listen_items + listen_chunks).
 *
 * Works on both the port (process.env-seeded supabase) and the port-jobs queue
 * consumer (which seeds the same env at handler start). Mirrors the agent-table
 * helper pattern in lib/supabase/{carl,biz}.ts.
 */

export type ListenStatus = "queued" | "rendering" | "ready" | "failed";
export type ListenSourceType = "google-doc" | "upload" | "url" | "notion";
export type ListenCleanLevel = "faithful" | "clean";

export interface ListenItem {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  title: string;
  source_type: ListenSourceType;
  source_ref: string;
  status: ListenStatus;
  clean_level: ListenCleanLevel;
  voice: string;
  text_key: string | null;
  char_count: number | null;
  est_minutes: number | null;
  chunk_count: number | null;
  error: string | null;
  condense: boolean;
  content_hash: string | null;
  speaker: string | null;
}

export interface ListenChunk {
  id: string;
  item_id: string;
  idx: number;
  r2_key: string;
  char_count: number | null;
  duration_ms: number | null;
}

export async function createListenItem(data: {
  title: string;
  source_type: ListenSourceType;
  source_ref: string;
  created_by: string;
  clean_level?: ListenCleanLevel;
  voice?: string;
  text_key?: string;
  char_count?: number;
  condense?: boolean;
  content_hash?: string;
  speaker?: string;
}): Promise<ListenItem> {
  const { data: row, error } = await supabase
    .from("listen_items")
    .insert({
      title: data.title,
      source_type: data.source_type,
      source_ref: data.source_ref,
      created_by: data.created_by,
      clean_level: data.clean_level ?? "clean",
      voice: data.voice ?? "cartesia",
      text_key: data.text_key ?? null,
      char_count: data.char_count ?? null,
      condense: data.condense ?? false,
      content_hash: data.content_hash ?? null,
      speaker: data.speaker ?? null,
      status: "queued",
    })
    .select("*")
    .single();
  if (error) throw error;
  return row as ListenItem;
}

/** Find a caller's already-rendered item with identical content+settings, for
 *  the dedupe cache — returns it so we skip a re-render entirely. */
export async function findReadyByHash(
  createdBy: string,
  contentHash: string,
): Promise<ListenItem | null> {
  const { data, error } = await supabase
    .from("listen_items")
    .select("*")
    .eq("created_by", createdBy)
    .eq("content_hash", contentHash)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ListenItem) ?? null;
}

export async function getListenItems(opts: {
  createdBy?: string;
  limit?: number;
} = {}): Promise<ListenItem[]> {
  let query = supabase
    .from("listen_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.createdBy) query = query.eq("created_by", opts.createdBy);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ListenItem[];
}

export async function getListenItem(id: string): Promise<ListenItem | null> {
  const { data, error } = await supabase
    .from("listen_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ListenItem) ?? null;
}

export async function updateListenItem(
  id: string,
  patch: Partial<
    Pick<
      ListenItem,
      "status" | "char_count" | "est_minutes" | "chunk_count" | "text_key" | "error" | "title"
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from("listen_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function insertListenChunks(
  itemId: string,
  chunks: { idx: number; r2_key: string; char_count?: number; duration_ms?: number }[],
): Promise<void> {
  if (!chunks.length) return;
  const { error } = await supabase.from("listen_chunks").insert(
    chunks.map((c) => ({
      item_id: itemId,
      idx: c.idx,
      r2_key: c.r2_key,
      char_count: c.char_count ?? null,
      duration_ms: c.duration_ms ?? null,
    })),
  );
  if (error) throw error;
}

/** Remove a item's chunk rows — called at the start of each render attempt so
 *  retries don't accumulate duplicate chunks (audio objects reuse idx keys). */
export async function deleteListenChunks(itemId: string): Promise<void> {
  const { error } = await supabase.from("listen_chunks").delete().eq("item_id", itemId);
  if (error) throw error;
}

export async function getListenChunks(itemId: string): Promise<ListenChunk[]> {
  const { data, error } = await supabase
    .from("listen_chunks")
    .select("*")
    .eq("item_id", itemId)
    .order("idx", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ListenChunk[];
}

/** Delete an item row. listen_chunks rows cascade via the FK ON DELETE CASCADE;
 *  the caller is responsible for removing the R2 audio/text objects first. */
export async function deleteListenItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("listen_items").delete().eq("id", itemId);
  if (error) throw error;
}

// ── per-user voice preference (listen_prefs) ───────────────────────────────────

/** The caller's chosen Aura voice, or null if they haven't set one. */
export async function getListenPref(userEmail: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("listen_prefs")
    .select("speaker")
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  return (data?.speaker as string) ?? null;
}

/** Upsert the caller's chosen Aura voice. */
export async function setListenPref(userEmail: string, speaker: string): Promise<void> {
  const { error } = await supabase
    .from("listen_prefs")
    .upsert(
      { user_email: userEmail, speaker, updated_at: new Date().toISOString() },
      { onConflict: "user_email" },
    );
  if (error) throw error;
}
