/**
 * Portable type definitions for the booking package.
 *
 * These are a subset of the row types that also live in site/lib/booking/supabase.ts.
 * Kept here so that slots.ts (and other pure modules) have no dependency on
 * any site-specific Supabase client code.
 */

export type EventTypeMode = "solo" | "collective" | "round_robin";

export interface EventType {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
  mode: EventTypeMode;
  host_pool: string[];
  min_required: number;
  primary_host_id: string | null;
  notice_min: number;
  horizon_days: number;
  slot_step_min: number;
  active: boolean;
  intake_required: boolean;
  created_at: string;
}

export interface Host {
  id: string;
  slug: string;
  display_name: string;
  email: string;
  timezone: string;
  working_hours: Record<string, [string, string][]>;
  buffer_before_min: number;
  buffer_after_min: number;
  active: boolean;
  created_at: string;
}
