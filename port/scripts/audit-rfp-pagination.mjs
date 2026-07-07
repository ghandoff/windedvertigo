#!/usr/bin/env node
// Smoke test / audit for the RFP lighthouse Kanban pagination.
//
// The /opportunities board fetches ALL opportunity statuses in one page, then
// splits into active/completed client-side. If the fetch page size is smaller
// than the total number of opportunities, terminal opportunities (no-go,
// missed-deadline) — which sort early by due_date — crowd out active cards
// (e.g. "pursuing" with future deadlines), and those active cards silently
// vanish from the board. That's the bug this guards against.
//
// This test FAILS if any ACTIVE opportunity sorts beyond the fetch ceiling
// (would be truncated), and WARNS when the total approaches the ceiling so the
// board can be fixed (archive old terminal opportunities, or split the fetch)
// BEFORE it breaks again.
//
// Usage: NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/audit-rfp-pagination.mjs
// (env is available in port/.env.local; run from the port dir)

import { createClient } from "@supabase/supabase-js";

// Must match the pageSize in app/(dashboard)/opportunities/page.tsx (and the
// lib's max of 500 in lib/supabase/rfp-opportunities.ts).
const PAGE_SIZE = 500;
const ACTIVE_STATUSES = new Set(["radar", "reviewing", "pursuing", "interviewing", "submitted"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in env");
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Fetch the same way the board does: every status, ordered by due_date.
const { data, error } = await supabase
  .from("rfp_opportunities")
  .select("status, due_date, opportunity_name")
  .order("due_date", { ascending: true, nullsFirst: false });

if (error) {
  console.error("✗ query failed:", error.message);
  process.exit(2);
}

const total = data.length;
// Rank = position in the due_date ordering (1-indexed), matching the fetch window.
const truncatedActive = data
  .map((o, i) => ({ ...o, rank: i + 1 }))
  .filter((o) => ACTIVE_STATUSES.has(o.status) && o.rank > PAGE_SIZE);

const activeCount = data.filter((o) => ACTIVE_STATUSES.has(o.status)).length;
console.log(`opportunities: ${total} total, ${activeCount} active, fetch ceiling ${PAGE_SIZE}`);

if (truncatedActive.length > 0) {
  console.error(`✗ FAIL: ${truncatedActive.length} ACTIVE opportunit(ies) sort beyond row ${PAGE_SIZE} and are HIDDEN from the board:`);
  for (const o of truncatedActive) console.error(`    rank ${o.rank}  [${o.status}]  ${o.opportunity_name} (due ${o.due_date ?? "—"})`);
  console.error("  Fix: raise the board fetch beyond the total, or split active/completed fetches, or archive old terminal opportunities.");
  process.exit(1);
}

if (total > PAGE_SIZE * 0.9) {
  console.warn(`⚠ WARN: ${total}/${PAGE_SIZE} opportunities — approaching the fetch ceiling. Archive terminal opportunities or split the fetch soon, before active cards get truncated.`);
  process.exit(0);
}

console.log("✓ PASS: all active opportunities are within the fetch window (no truncation).");
process.exit(0);
