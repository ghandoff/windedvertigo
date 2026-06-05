import { supabase } from "./client";

export interface CarlCurriculumTopic {
  id: string;
  domain: string;
  topic: string;
  key_works: string[];
  priority: number;
  status: "planned" | "in-progress" | "covered";
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getCurriculum(opts: {
  status?: string;
  domain?: string;
  limit?: number;
} = {}): Promise<CarlCurriculumTopic[]> {
  let query = supabase
    .from("carl_curriculum")
    .select("*")
    .order("sort_order", { ascending: true })
    .limit(opts.limit ?? 500);

  if (opts.status) query = query.eq("status", opts.status);
  if (opts.domain) query = query.eq("domain", opts.domain);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateCurriculumTopic(
  id: string,
  data: { status?: string; notes?: string },
): Promise<CarlCurriculumTopic> {
  const { data: row, error } = await supabase
    .from("carl_curriculum")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return row;
}
