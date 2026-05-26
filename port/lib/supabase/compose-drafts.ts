/**
 * Supabase read/write for `compose_drafts` (W3 — port social authoring).
 *
 * Backs /compose. Distinct from the existing `social_drafts` Notion mirror
 * (which is read-only sync from the social cron). Drafts here are human-
 * authored from the port's compose surface.
 */

import { supabase } from "./client";

export type ComposeChannel =
  | "linkedin"
  | "bluesky"
  | "substack"
  | "meta-facebook"
  | "meta-instagram"
  | "email";

export type ComposeStatus = "draft" | "scheduled" | "published" | "failed";

export interface ComposeDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  authorEmail: string;
  channel: ComposeChannel;
  status: ComposeStatus;
  title: string | null;
  contentText: string;
  attachedImageUrls: string[];
  scheduledFor: string | null;
  publishedAt: string | null;
  publishedId: string | null;
  lastError: string | null;
}

interface ComposeDraftRow {
  id: string;
  created_at: string;
  updated_at: string;
  author_email: string;
  channel: ComposeChannel;
  status: ComposeStatus;
  title: string | null;
  content_text: string;
  attached_image_urls: string[] | null;
  scheduled_for: string | null;
  published_at: string | null;
  published_id: string | null;
  last_error: string | null;
}

function mapRow(row: ComposeDraftRow): ComposeDraft {
  return {
    id:                row.id,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
    authorEmail:       row.author_email,
    channel:           row.channel,
    status:            row.status,
    title:             row.title,
    contentText:       row.content_text,
    attachedImageUrls: row.attached_image_urls ?? [],
    scheduledFor:      row.scheduled_for,
    publishedAt:       row.published_at,
    publishedId:       row.published_id,
    lastError:         row.last_error,
  };
}

export async function listComposeDrafts(opts: {
  authorEmail?: string;
  channel?: ComposeChannel;
  status?: ComposeStatus;
  limit?: number;
} = {}): Promise<ComposeDraft[]> {
  try {
    let q = supabase.from("compose_drafts").select("*").order("updated_at", { ascending: false });
    if (opts.authorEmail) q = q.eq("author_email", opts.authorEmail.toLowerCase());
    if (opts.channel) q = q.eq("channel", opts.channel);
    if (opts.status) q = q.eq("status", opts.status);
    q = q.limit(opts.limit ?? 50);
    const { data, error } = await q;
    if (error) {
      console.warn("[supabase/compose-drafts] list failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => mapRow(r as ComposeDraftRow));
  } catch (err) {
    console.warn("[supabase/compose-drafts] list threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getComposeDraft(id: string): Promise<ComposeDraft | null> {
  try {
    const { data, error } = await supabase
      .from("compose_drafts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[supabase/compose-drafts] get failed:", error.message);
      return null;
    }
    return data ? mapRow(data as ComposeDraftRow) : null;
  } catch (err) {
    console.warn("[supabase/compose-drafts] get threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface CreateComposeDraftInput {
  authorEmail: string;
  channel: ComposeChannel;
  title?: string | null;
  contentText?: string;
  attachedImageUrls?: string[];
  scheduledFor?: string | null;
}

export async function createComposeDraft(input: CreateComposeDraftInput): Promise<ComposeDraft | null> {
  try {
    const { data, error } = await supabase
      .from("compose_drafts")
      .insert({
        author_email:        input.authorEmail.toLowerCase(),
        channel:             input.channel,
        title:               input.title ?? null,
        content_text:        input.contentText ?? "",
        attached_image_urls: input.attachedImageUrls ?? [],
        scheduled_for:       input.scheduledFor ?? null,
      })
      .select("*")
      .single();
    if (error) {
      console.warn("[supabase/compose-drafts] create failed:", error.message);
      return null;
    }
    return data ? mapRow(data as ComposeDraftRow) : null;
  } catch (err) {
    console.warn("[supabase/compose-drafts] create threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface UpdateComposeDraftInput {
  title?: string | null;
  contentText?: string;
  attachedImageUrls?: string[];
  scheduledFor?: string | null;
  status?: ComposeStatus;
}

export async function updateComposeDraft(
  id: string,
  patch: UpdateComposeDraftInput,
): Promise<ComposeDraft | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.contentText !== undefined) update.content_text = patch.contentText;
  if (patch.attachedImageUrls !== undefined) update.attached_image_urls = patch.attachedImageUrls;
  if (patch.scheduledFor !== undefined) update.scheduled_for = patch.scheduledFor;
  if (patch.status !== undefined) update.status = patch.status;

  try {
    const { data, error } = await supabase
      .from("compose_drafts")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.warn("[supabase/compose-drafts] update failed:", error.message);
      return null;
    }
    return data ? mapRow(data as ComposeDraftRow) : null;
  } catch (err) {
    console.warn("[supabase/compose-drafts] update threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function deleteComposeDraft(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("compose_drafts").delete().eq("id", id);
    if (error) {
      console.warn("[supabase/compose-drafts] delete failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[supabase/compose-drafts] delete threw:", err instanceof Error ? err.message : err);
    return false;
  }
}

// ── per-channel limits (used at compose-time for character-count hints) ──

export const CHANNEL_CHAR_LIMITS: Record<ComposeChannel, number | null> = {
  linkedin:        3000,   // post char limit
  bluesky:         300,    // 300 grapheme limit
  substack:        null,   // no limit
  "meta-facebook": 63206,  // effectively unlimited
  "meta-instagram": 2200,  // caption limit
  email:           null,
};

export const CHANNEL_LABELS: Record<ComposeChannel, string> = {
  linkedin:        "LinkedIn",
  bluesky:         "Bluesky",
  substack:        "Substack",
  "meta-facebook": "Facebook",
  "meta-instagram": "Instagram",
  email:           "Email",
};
