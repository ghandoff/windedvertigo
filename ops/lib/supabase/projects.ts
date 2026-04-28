import { getSupabase } from "./client";
import type { Project } from "@/lib/types";

interface ProjectRow {
  slug: string;
  name: string;
  status: string;
  deadline: string | null;
  owner: string | null;
  description: string | null;
}

export async function fetchProjectsFromSupabase(): Promise<Project[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("ops_projects")
      .select("slug, name, status, deadline, owner, description")
      .eq("archived", false)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data as ProjectRow[]).map((row) => ({
      id: row.slug,
      name: row.name,
      status: (row.status as Project["status"]) ?? "green",
      deadline: row.deadline ?? undefined,
      owner: row.owner ?? undefined,
      description: row.description ?? undefined,
    }));
  } catch (err) {
    console.error("[ops/supabase] fetchProjectsFromSupabase:", err);
    return null;
  }
}
