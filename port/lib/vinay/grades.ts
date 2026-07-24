/**
 * vinay brief grades — garrett's useful / not-useful / wrong signal on a brief
 * (or a single item within it). This is the seed data the later ERL reflection
 * loop distils into "what vinay should surface vs suppress".
 */

import { vinayDb } from "./client";

export type VinayGrade = "useful" | "not-useful" | "wrong";

export interface VinayBriefGrade {
  id: string;
  item_key: string | null;
  grade: string;
  note: string | null;
  created_at: string;
}

export async function gradeVinayBrief(data: {
  brief_id: string;
  grade: VinayGrade;
  item_key?: string | null;
  note?: string | null;
}): Promise<{ id: string }> {
  const { data: row, error } = await vinayDb
    .from("vinay_brief_grades")
    .insert({
      brief_id: data.brief_id,
      grade: data.grade,
      item_key: data.item_key ?? null,
      note: data.note ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return row;
}

export async function listVinayBriefGrades(briefId: string): Promise<VinayBriefGrade[]> {
  const { data, error } = await vinayDb
    .from("vinay_brief_grades")
    .select("id, item_key, grade, note, created_at")
    .eq("brief_id", briefId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
