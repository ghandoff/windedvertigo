import { supabase } from "./client";

export type PortalStatus = "registered" | "pending" | "blocked" | "not-required";

export interface PortalRegistration {
  id: string;
  rfpId: string;
  portalName: string;
  status: PortalStatus;
  notes: string | null;
  registeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PortalRow {
  id: string;
  rfp_id: string;
  portal_name: string;
  status: string;
  notes: string | null;
  registered_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPortal(row: PortalRow): PortalRegistration {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    portalName: row.portal_name,
    status: row.status as PortalStatus,
    notes: row.notes,
    registeredAt: row.registered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Get all portal registrations for one RFP. */
export async function getPortalRegistrations(rfpId: string): Promise<PortalRegistration[]> {
  const { data, error } = await supabase
    .from("rfp_portal_registrations")
    .select("id, rfp_id, portal_name, status, notes, registered_at, created_at, updated_at")
    .eq("rfp_id", rfpId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[rfp-portal-registrations] getByRfp: ${error.message}`);
  return ((data ?? []) as unknown as PortalRow[]).map(rowToPortal);
}

/** Upsert (insert or update) a portal registration. Keyed on rfp_id + portal_name. */
export async function upsertPortalRegistration(
  rfpId: string,
  portalName: string,
  status: PortalStatus,
  notes?: string | null,
): Promise<PortalRegistration> {
  const registeredAt = status === "registered" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("rfp_portal_registrations")
    .upsert(
      {
        rfp_id:        rfpId,
        portal_name:   portalName,
        status,
        notes:         notes ?? null,
        registered_at: registeredAt,
      },
      { onConflict: "rfp_id,portal_name" },
    )
    .select("id, rfp_id, portal_name, status, notes, registered_at, created_at, updated_at")
    .single();

  if (error) throw new Error(`[rfp-portal-registrations] upsert: ${error.message}`);
  return rowToPortal(data as unknown as PortalRow);
}

/** Delete a portal registration row. */
export async function deletePortalRegistration(id: string): Promise<void> {
  const { error } = await supabase
    .from("rfp_portal_registrations")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`[rfp-portal-registrations] delete: ${error.message}`);
}

/**
 * Worst-case status across all registrations for an RFP.
 * blocked > pending > registered > not-required > null (none tracked)
 */
export function worstPortalStatus(registrations: PortalRegistration[]): PortalStatus | null {
  if (registrations.length === 0) return null;
  const RANK: Record<PortalStatus, number> = {
    "blocked": 3, "pending": 2, "registered": 1, "not-required": 0,
  };
  return registrations.reduce((worst, r) =>
    RANK[r.status] > RANK[worst] ? r.status : worst,
    registrations[0].status,
  );
}
