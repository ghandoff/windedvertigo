import { getSupabase } from "./client";
import type { TeamMember } from "@/lib/types";

interface TeamMemberRow {
  slug: string;
  name: string;
  role: string | null;
  focus: string[];
}

export async function fetchTeamMembers(): Promise<TeamMember[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("ops_team_members")
      .select("slug, name, role, focus")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data as TeamMemberRow[]).map((row) => ({
      id: row.slug,
      name: row.name,
      role: row.role ?? "",
      focus: row.focus,
    }));
  } catch (err) {
    console.error("[ops/supabase] fetchTeamMembers:", err);
    return null;
  }
}
