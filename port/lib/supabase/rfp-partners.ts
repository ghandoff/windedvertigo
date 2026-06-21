import { supabase } from "./client";

export type PartnerType = "local" | "international" | "academic" | "government";
export type PartnerRelationship = "known" | "nda_signed" | "ta_on_file" | "active_sub";

export interface RfpPartner {
  id: string;
  name: string;
  country: string | null;
  type: PartnerType;
  capabilities: string[] | null;
  relationship: PartnerRelationship;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PartnerRow {
  id: string;
  name: string;
  country: string | null;
  type: string;
  capabilities: string[] | null;
  relationship: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPartner(row: PartnerRow): RfpPartner {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    type: row.type as PartnerType,
    capabilities: row.capabilities,
    relationship: row.relationship as PartnerRelationship,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS =
  "id, name, country, type, capabilities, relationship, contact_name, contact_email, notes, created_at, updated_at";

export interface PartnerFilters {
  country?: string;
  type?: PartnerType;
  relationship?: PartnerRelationship;
}

/** List all partners, with optional filters. */
export async function getPartners(filters?: PartnerFilters): Promise<RfpPartner[]> {
  let q = supabase.from("rfp_partners").select(SELECT_COLS);

  if (filters?.country)      q = q.eq("country", filters.country);
  if (filters?.type)         q = q.eq("type", filters.type);
  if (filters?.relationship) q = q.eq("relationship", filters.relationship);

  const { data, error } = await q.order("name", { ascending: true });
  if (error) throw new Error(`[rfp-partners] getPartners: ${error.message}`);
  return ((data ?? []) as unknown as PartnerRow[]).map(rowToPartner);
}

/** Fetch a single partner by id. */
export async function getPartner(id: string): Promise<RfpPartner | null> {
  const { data, error } = await supabase
    .from("rfp_partners")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`[rfp-partners] getPartner: ${error.message}`);
  return data ? rowToPartner(data as unknown as PartnerRow) : null;
}

export type PartnerCreate = Omit<RfpPartner, "id" | "createdAt" | "updatedAt">;

/** Create a new partner row. */
export async function createPartner(fields: PartnerCreate): Promise<RfpPartner> {
  const { data, error } = await supabase
    .from("rfp_partners")
    .insert({
      name:          fields.name,
      country:       fields.country ?? null,
      type:          fields.type,
      capabilities:  fields.capabilities ?? null,
      relationship:  fields.relationship,
      contact_name:  fields.contactName ?? null,
      contact_email: fields.contactEmail ?? null,
      notes:         fields.notes ?? null,
    })
    .select(SELECT_COLS)
    .single();

  if (error) throw new Error(`[rfp-partners] createPartner: ${error.message}`);
  return rowToPartner(data as unknown as PartnerRow);
}

export type PartnerUpdate = Partial<PartnerCreate>;

/** Update an existing partner. Only supplied fields are changed. */
export async function updatePartner(id: string, fields: PartnerUpdate): Promise<RfpPartner> {
  const patch: Record<string, unknown> = {};
  if (fields.name          !== undefined) patch.name          = fields.name;
  if (fields.country       !== undefined) patch.country       = fields.country;
  if (fields.type          !== undefined) patch.type          = fields.type;
  if (fields.capabilities  !== undefined) patch.capabilities  = fields.capabilities;
  if (fields.relationship  !== undefined) patch.relationship  = fields.relationship;
  if (fields.contactName   !== undefined) patch.contact_name  = fields.contactName;
  if (fields.contactEmail  !== undefined) patch.contact_email = fields.contactEmail;
  if (fields.notes         !== undefined) patch.notes         = fields.notes;

  const { data, error } = await supabase
    .from("rfp_partners")
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();

  if (error) throw new Error(`[rfp-partners] updatePartner: ${error.message}`);
  return rowToPartner(data as unknown as PartnerRow);
}

/** Delete a partner row. */
export async function deletePartner(id: string): Promise<void> {
  const { error } = await supabase
    .from("rfp_partners")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`[rfp-partners] deletePartner: ${error.message}`);
}
