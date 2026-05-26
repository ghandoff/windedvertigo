/**
 * Supabase read/write for `design_docs` (W2 Tailwind/React-PDF renderer).
 */

import { supabase } from "./client";

export interface DesignDoc {
  id: string;
  slug: string;
  title: string;
  template: string;
  frontmatter: Record<string, unknown>;
  contentMarkdown: string;
  ownerEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DesignDocRow {
  id: string;
  slug: string;
  title: string;
  template: string;
  frontmatter: Record<string, unknown> | null;
  content_markdown: string;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DesignDocRow): DesignDoc {
  return {
    id:              row.id,
    slug:            row.slug,
    title:           row.title,
    template:        row.template,
    frontmatter:     row.frontmatter ?? {},
    contentMarkdown: row.content_markdown,
    ownerEmail:      row.owner_email,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

export async function listDesignDocs(limit = 50): Promise<DesignDoc[]> {
  const { data, error } = await supabase
    .from("design_docs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[supabase/design-docs] list failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as DesignDocRow));
}

export async function getDesignDoc(slug: string): Promise<DesignDoc | null> {
  const { data, error } = await supabase
    .from("design_docs")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.warn("[supabase/design-docs] get failed:", error.message);
    return null;
  }
  return data ? mapRow(data as DesignDocRow) : null;
}

export interface UpsertDesignDocInput {
  slug: string;
  title: string;
  template?: string;
  frontmatter?: Record<string, unknown>;
  contentMarkdown: string;
  ownerEmail?: string | null;
}

export async function upsertDesignDoc(input: UpsertDesignDocInput): Promise<DesignDoc | null> {
  const { data, error } = await supabase
    .from("design_docs")
    .upsert(
      {
        slug:             input.slug,
        title:            input.title,
        template:         input.template ?? "proposal-v1",
        frontmatter:      input.frontmatter ?? {},
        content_markdown: input.contentMarkdown,
        owner_email:      input.ownerEmail ?? null,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("*")
    .single();
  if (error) {
    console.warn("[supabase/design-docs] upsert failed:", error.message);
    return null;
  }
  return data ? mapRow(data as DesignDocRow) : null;
}
