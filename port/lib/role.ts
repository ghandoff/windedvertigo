/**
 * User context resolution and visibility-tier system.
 *
 * Maps the Auth.js session to a Notion member + workspace user ID,
 * and determines the user's visibility tier for feature gating.
 *
 * Tiers (ordered):
 *   "self"    → own timesheets only (default for members)
 *   "team"    → all team timesheets + rates
 *   "finance" → payroll summary + invoice generation
 *   "admin"   → Gusto sync + full write access
 *
 * Currently deployed: "self" for members, "admin" for ADMIN_EMAILS.
 * Future: bump VISIBILITY_TIER_DEFAULT to "team" or "finance" for flat org.
 */

import { cache } from "react";
import { auth } from "@/lib/auth";
import { notion } from "@/lib/notion/client";
import { getActiveMembers, type Member } from "@/lib/notion/members";

// ── types ───────────────────────────────────────────────

export type VisibilityTier = "self" | "team" | "finance" | "admin";

export interface UserContext {
  email: string;
  name: string;
  tier: VisibilityTier;
  /** Notion workspace user UUID — used for people property filters. */
  notionUserId: string | null;
  /** Matched Member record from the port members database. */
  member: Member | null;
}

/** Features gated by visibility tier. */
export type Feature =
  | "own-timesheets"
  | "team-timesheets"
  | "payroll-summary"
  | "gusto-sync"
  | "invoice-generation";

// ── tier ordering ───────────────────────────────────────

const TIER_RANK: Record<VisibilityTier, number> = {
  self: 0,
  team: 1,
  finance: 2,
  admin: 3,
};

const FEATURE_MIN_TIER: Record<Feature, VisibilityTier> = {
  "own-timesheets": "self",
  "team-timesheets": "team",
  "payroll-summary": "finance",
  "invoice-generation": "finance",
  "gusto-sync": "admin",
};

/** Check whether a tier grants access to a feature. */
export function canSee(tier: VisibilityTier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

// ── admin detection ─────────────────────────────────────

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

// ── Notion workspace user mapping ───────────────────────

/**
 * Fetch all Notion workspace users and build an email → user ID map.
 * Cached per RSC render pass via React.cache().
 * Also exported for use by cron jobs and API routes.
 */
export const getNotionUserMap = cache(async (): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const res = await notion.users.list({
      start_cursor: cursor,
      page_size: 100,
    });

    for (const user of res.results) {
      if (user.type === "person" && "person" in user && user.person?.email) {
        map.set(user.person.email.toLowerCase(), user.id);
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return map;
});

// ── member lookup ───────────────────────────────────────

/** Find a Member by email from the active members list. */
const getMemberByEmail = cache(
  async (email: string): Promise<Member | null> => {
    const members = await getActiveMembers();
    return (
      members.find((m) => m.email.toLowerCase() === email.toLowerCase()) ??
      null
    );
  },
);

// ── main resolution ─────────────────────────────────────

/**
 * Resolve the full user context for the current request.
 *
 * Uses React.cache() so it deduplicates within a single RSC render —
 * multiple server components calling this in one page get the same result.
 */
export const resolveUserContext = cache(
  async (): Promise<UserContext | null> => {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return null;

    const [member, userMap] = await Promise.all([
      getMemberByEmail(email),
      getNotionUserMap(),
    ]);

    // Determine tier: admin emails get full access, everyone else gets "self"
    // Future: read from VISIBILITY_TIER_DEFAULT env var or per-member Notion field
    const tier: VisibilityTier = isAdmin(email) ? "admin" : "self";

    return {
      email,
      name: session.user?.name ?? "",
      tier,
      notionUserId: userMap.get(email.toLowerCase()) ?? null,
      member,
    };
  },
);
