/**
 * Supabase read layer for contacts.
 *
 * Returns the canonical Notion `Contact` type so all existing components
 * (ContactPipeline, ContactsTable, etc.) work without modification.
 *
 * `id` is set to `notion_page_id`. `org_id` stores the primary org relation.
 *
 * Filter parity with lib/notion/contacts.ts queryContacts():
 * - contactType, contactWarmth, responsiveness, relationshipStage → direct column
 * - referralPotential → boolean column
 * - search → ILIKE '%value%' on name (pg_trgm gin index)
 */

import { supabase } from "./client";
import type { Contact } from "@/lib/notion/types";

// ── types ────────────────────────────────────────────────────────

interface ContactRow {
  notion_page_id: string;
  name: string;
  email: string | null;
  role: string | null;
  org_id: string | null;
  contact_type: string | null;
  relationship_stage: string | null;
  contact_warmth: string | null;
  responsiveness: string | null;
  referral_potential: boolean | null;
}

export interface ContactSupabaseFilters {
  contactType?: string;
  contactWarmth?: string;
  responsiveness?: string;
  relationshipStage?: string;
  referralPotential?: boolean;
  orgId?: string;
  search?: string;
}

export interface ContactSupabasePagination {
  page?: number;
  pageSize?: number;
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToContact(row: ContactRow): Contact {
  return {
    id: row.notion_page_id,
    name: row.name,
    email: row.email ?? "",
    role: row.role ?? "",
    contactType: (row.contact_type as Contact["contactType"]) ?? "collaborator",
    contactWarmth: (row.contact_warmth as Contact["contactWarmth"]) ?? "cold",
    responsiveness: (row.responsiveness as Contact["responsiveness"]) ?? "unknown",
    referralPotential: row.referral_potential ?? false,
    linkedin: "",
    phoneNumber: "",
    profilePhotoUrl: "",       // UI falls back to name initials
    relationshipStage: (row.relationship_stage as Contact["relationshipStage"]) ?? "stranger",
    lastContacted: null,
    nextAction: "",
    organizationIds: row.org_id ? [row.org_id] : [],
    nodeUserIds: [],
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, name, email, role, org_id, contact_type, relationship_stage, " +
  "contact_warmth, responsiveness, referral_potential";

// ── query function ────────────────────────────────────────────────

export async function getContactsFromSupabase(
  filters: ContactSupabaseFilters = {},
  pagination: ContactSupabasePagination = {},
): Promise<{ data: Contact[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contacts")
    .select(SELECT_COLS, { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (filters.orgId)             query = query.eq("org_id", filters.orgId);
  if (filters.contactType)       query = query.eq("contact_type", filters.contactType);
  if (filters.contactWarmth)     query = query.eq("contact_warmth", filters.contactWarmth);
  if (filters.responsiveness)    query = query.eq("responsiveness", filters.responsiveness);
  if (filters.relationshipStage) query = query.eq("relationship_stage", filters.relationshipStage);
  if (filters.referralPotential !== undefined) {
    query = query.eq("referral_potential", filters.referralPotential);
  }
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`[supabase/contacts] query: ${error.message}`);
  return {
    data: (data as unknown as ContactRow[]).map(mapRowToContact),
    total: count ?? 0,
  };
}

/**
 * Fetch a single contact by its Notion page id.
 */
export async function getContactByIdFromSupabase(
  notionPageId: string,
): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw new Error(`[supabase/contacts] getById: ${error.message}`);
  }
  return data ? mapRowToContact(data as unknown as ContactRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert a contact. Uses notion_page_id as the conflict target.
 */
export async function upsertContactToSupabase(
  notionPageId: string,
  data: Partial<Omit<ContactRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/contacts] upsert: ${error.message}`);
}

/**
 * Delete a contact row.
 */
export async function deleteContactFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/contacts] delete: ${error.message}`);
}
