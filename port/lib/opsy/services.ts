/**
 * Opsy's monitored-service registry.
 *
 * Phase 1 ships tier 1 (core platform) only — tiers 2-4 (data layer, external
 * services, security/compliance) land in phase 2. Thresholds come from
 * docs/opsy/posture.md §"what Opsy monitors". URLs verified live 2026-06-11.
 */

export type Platform = "website" | "harbour" | "nordic" | "port" | "data" | "external" | "security";

export interface MonitoredService {
  /** stable id — used as opsy_health_checks.service / opsy_incidents.service */
  id: string;
  name: string;
  platform: Platform;
  tier: 1 | 2 | 3 | 4;
  /**
   * "http" — generic timed GET of `url` (tier 1 pattern).
   * "custom" — a checker in lib/opsy/checks.ts keyed by service id; may
   * return "skipped" (missing credential), which is reported but not stored.
   */
  kind: "http" | "custom";
  /** probe URL — required for kind "http" */
  url?: string;
  /** response time above this (ms) → amber. red is reserved for errors. */
  amberMs?: number;
}

export const SERVICES: MonitoredService[] = [
  // ── tier 1: core platform (every 5 min) ─────────────────────────────────────
  {
    id: "wv-site",
    name: "wv-site (CF worker)",
    platform: "website",
    tier: 1,
    kind: "http",
    url: "https://windedvertigo.com",
    amberMs: 2000,
  },
  {
    id: "harbour",
    name: "harbour hub (CF worker)",
    platform: "harbour",
    tier: 1,
    kind: "http",
    url: "https://windedvertigo.com/harbour",
    amberMs: 2000,
  },
  {
    id: "nordic",
    name: "nordic (vercel)",
    platform: "nordic",
    tier: 1,
    kind: "http",
    url: "https://nordic.windedvertigo.com",
    amberMs: 3000,
  },
  {
    id: "port",
    name: "port",
    platform: "port",
    tier: 1,
    kind: "http",
    // /login is the cheapest unauthenticated page; / 307-redirects there anyway
    url: "https://port.windedvertigo.com/login",
    amberMs: 2000,
  },
  {
    id: "creaseworks",
    name: "creaseworks",
    platform: "harbour",
    tier: 1,
    kind: "http",
    url: "https://windedvertigo.com/harbour/creaseworks",
    amberMs: 2000,
  },

  // ── tier 2: data layer (every 15 min) ───────────────────────────────────────
  { id: "supabase-pilot", name: "supabase wv-port-pilot", platform: "data", tier: 2, kind: "custom" },
  { id: "r2-port-assets", name: "R2 port-assets (binding)", platform: "data", tier: 2, kind: "custom" },
  { id: "r2-evidence-public", name: "R2 creaseworks-evidence (public)", platform: "data", tier: 2, kind: "custom" },
  { id: "supabase-nordic", name: "supabase wv-nordic", platform: "data", tier: 2, kind: "custom" },
  { id: "neon-pools", name: "neon connection pools", platform: "data", tier: 2, kind: "custom" },

  // ── tier 3: external services (every 30 min) ────────────────────────────────
  { id: "notion-api", name: "notion API", platform: "external", tier: 3, kind: "custom" },
  { id: "resend", name: "resend (email)", platform: "external", tier: 3, kind: "custom" },
  { id: "vercel-deployments", name: "vercel deployments", platform: "external", tier: 3, kind: "custom" },
  { id: "github-actions", name: "github actions CI", platform: "external", tier: 3, kind: "custom" },
  { id: "stripe-webhooks", name: "stripe webhooks", platform: "external", tier: 3, kind: "custom" },

  // ── tier 4: security & compliance (daily 06:00 UTC) ─────────────────────────
  { id: "dns-records", name: "DNS email auth (SPF/DMARC)", platform: "security", tier: 4, kind: "custom" },
  { id: "supabase-rls", name: "supabase RLS audit", platform: "security", tier: 4, kind: "custom" },
  { id: "cf-worker-analytics", name: "CF worker analytics", platform: "security", tier: 4, kind: "custom" },
];

export type CheckScope = "all" | "tier1" | "tier2" | "tier3" | "tier4" | string;

/** Resolve a check scope ("all", "tier1", or a service id) to services. */
export function servicesForScope(scope: CheckScope): MonitoredService[] {
  if (scope === "all") return SERVICES;
  const tierMatch = /^tier([1-4])$/.exec(scope);
  if (tierMatch) {
    const tier = Number(tierMatch[1]);
    return SERVICES.filter((s) => s.tier === tier);
  }
  return SERVICES.filter((s) => s.id === scope);
}
