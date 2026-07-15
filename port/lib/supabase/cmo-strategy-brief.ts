import { supabase } from "./client";

export interface StrategyBriefSection {
  id: string;
  heading: string;
  owner: string;
  body: string;
  covered: boolean;
}

export interface StrategyBriefContent {
  sections: StrategyBriefSection[];
  decisions: string[];
  actions: string[];
}

export interface StrategyBrief {
  id: string;
  slug: string;
  title: string;
  content: StrategyBriefContent;
  version: number;
  status: string;
  updated_at: string;
  updated_by: string;
}

export interface StrategyBriefVersionSummary {
  version: number;
  change_note: string | null;
  created_at: string;
  created_by: string;
}

export interface StrategyBriefVersionFull extends StrategyBriefVersionSummary {
  content: StrategyBriefContent;
}

const DEFAULT_SLUG = "current";

export async function getStrategyBrief(slug: string = DEFAULT_SLUG): Promise<StrategyBrief | null> {
  const { data, error } = await supabase
    .from("cmo_strategy_brief")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getStrategyBriefHistory(slug: string = DEFAULT_SLUG): Promise<StrategyBriefVersionSummary[]> {
  const brief = await getStrategyBrief(slug);
  if (!brief) return [];

  const { data, error } = await supabase
    .from("cmo_strategy_brief_versions")
    .select("version, change_note, created_at, created_by")
    .eq("brief_id", brief.id)
    .order("version", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getStrategyBriefVersion(
  version: number,
  slug: string = DEFAULT_SLUG,
): Promise<StrategyBriefVersionFull | null> {
  const brief = await getStrategyBrief(slug);
  if (!brief) return null;

  const { data, error } = await supabase
    .from("cmo_strategy_brief_versions")
    .select("version, content, change_note, created_at, created_by")
    .eq("brief_id", brief.id)
    .eq("version", version)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Save a new version — bumps version, snapshots into cmo_strategy_brief_versions,
 * updates the live row, all atomically via the save_strategy_brief_version
 * Postgres function (a single plpgsql call, not sequential client-side writes).
 */
export async function saveStrategyBrief(data: {
  content: StrategyBriefContent;
  updatedBy: string;
  changeNote?: string;
  slug?: string;
  title?: string;
}): Promise<{ id: string; version: number }> {
  const { data: row, error } = await supabase
    .rpc("save_strategy_brief_version", {
      p_slug: data.slug ?? DEFAULT_SLUG,
      p_content: data.content,
      p_updated_by: data.updatedBy,
      p_change_note: data.changeNote ?? null,
      p_title: data.title ?? "strategy brief",
    })
    .single();

  if (error) throw error;
  return row as { id: string; version: number };
}

/** Restore = write a NEW forward version whose content = a past snapshot. Never hard-overwrites. */
export async function restoreStrategyBriefVersion(data: {
  version: number;
  restoredBy: string;
  slug?: string;
}): Promise<{ id: string; version: number }> {
  const slug = data.slug ?? DEFAULT_SLUG;
  const snapshot = await getStrategyBriefVersion(data.version, slug);
  if (!snapshot) throw new Error(`version ${data.version} not found`);

  return saveStrategyBrief({
    content: snapshot.content,
    updatedBy: data.restoredBy,
    changeNote: `restored v${data.version}`,
    slug,
  });
}
