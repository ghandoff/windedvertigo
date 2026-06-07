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

export async function insertCarlCurriculumTopic(data: {
  domain: string;
  topic: string;
  key_works?: string[];
  priority?: number;
  notes?: string;
}): Promise<CarlCurriculumTopic> {
  // Assign sort_order = max existing for this domain + 1
  const { data: existing } = await supabase
    .from("carl_curriculum")
    .select("sort_order")
    .eq("domain", data.domain)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const { data: row, error } = await supabase
    .from("carl_curriculum")
    .insert({
      domain: data.domain,
      topic: data.topic,
      key_works: data.key_works ?? [],
      priority: data.priority ?? 2,
      notes: data.notes ?? null,
      status: "planned",
      sort_order: nextOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  return row;
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
