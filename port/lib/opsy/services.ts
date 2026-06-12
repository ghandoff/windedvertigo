/**
 * Opsy's monitored-service registry.
 *
 * Phase 1 ships tier 1 (core platform) only — tiers 2-4 (data layer, external
 * services, security/compliance) land in phase 2. Thresholds come from
 * docs/opsy/posture.md §"what Opsy monitors". URLs verified live 2026-06-11.
 */

export type Platform = "website" | "harbour" | "nordic" | "port";

export interface MonitoredService {
  /** stable id — used as opsy_health_checks.service / opsy_incidents.service */
  id: string;
  name: string;
  platform: Platform;
  tier: 1 | 2 | 3 | 4;
  /** probe URL — a cheap, unauthenticated GET that exercises the service */
  url: string;
  /** response time above this (ms) → amber. red is reserved for errors. */
  amberMs: number;
}

export const SERVICES: MonitoredService[] = [
  {
    id: "wv-site",
    name: "wv-site (CF worker)",
    platform: "website",
    tier: 1,
    url: "https://windedvertigo.com",
    amberMs: 2000,
  },
  {
    id: "harbour",
    name: "harbour hub (CF worker)",
    platform: "harbour",
    tier: 1,
    url: "https://windedvertigo.com/harbour",
    amberMs: 2000,
  },
  {
    id: "nordic",
    name: "nordic (vercel)",
    platform: "nordic",
    tier: 1,
    url: "https://nordic.windedvertigo.com",
    amberMs: 3000,
  },
  {
    id: "port",
    name: "port",
    platform: "port",
    tier: 1,
    // /login is the cheapest unauthenticated page; / 307-redirects there anyway
    url: "https://port.windedvertigo.com/login",
    amberMs: 2000,
  },
  {
    id: "creaseworks",
    name: "creaseworks",
    platform: "harbour",
    tier: 1,
    url: "https://windedvertigo.com/harbour/creaseworks",
    amberMs: 2000,
  },
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
