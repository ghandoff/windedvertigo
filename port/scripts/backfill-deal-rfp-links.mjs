/**
 * One-time/maintenance backfill: link existing `deals` to their `rfp_opportunities`
 * by name, populating `deals.rfp_ids`. This activates the dedup in
 * lib/marketing/revenue-progress.ts (an opportunity counted once, not as both a
 * deal and an RFP). Going forward, lib/rfp/deal-sync.ts links on win automatically.
 *
 * Match rule (conservative, to avoid mislinks like "ICSP — Concern" vs "ICSP Syria"):
 *   compare the first min(2, dealTokens) tokens of the deal name against the
 *   RFP name's leading tokens; all must match. Only links when exactly one RFP matches.
 *
 * Usage:
 *   node scripts/backfill-deal-rfp-links.mjs            # dry run (read only)
 *   node scripts/backfill-deal-rfp-links.mjs --write    # apply links
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const WRITE = process.argv.includes("--write");
const Q = String.fromCharCode(34), SQ = String.fromCharCode(39), NL = String.fromCharCode(10);
const strip = (v) => { v = v.trim(); if (v[0] === Q || v[0] === SQ) v = v.slice(1, -1); return v; };
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(NL)) {
  if (!line || line[0] === "#") continue;
  const i = line.indexOf("="); if (i < 0) continue;
  env[line.slice(0, i)] = strip(line.slice(i + 1));
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const tokens = (s) => (s || "").toLowerCase().split(/[\s—–\-(),:]+/).filter(Boolean);
const leadMatch = (dealName, rfpName) => {
  const d = tokens(dealName), r = tokens(rfpName);
  const n = Math.min(2, d.length);
  if (!n) return false;
  for (let i = 0; i < n; i++) if (d[i] !== r[i]) return false;
  return true;
};

const { data: deals } = await supabase.from("deals").select("notion_page_id, deal, rfp_ids");
const { data: rfps } = await supabase.from("rfp_opportunities").select("notion_page_id, opportunity_name, status");

const plan = [];
for (const d of deals) {
  if ((d.rfp_ids || []).length) continue; // already linked
  const matches = rfps.filter((r) => leadMatch(d.deal, r.opportunity_name));
  if (matches.length === 1) {
    plan.push({ deal: d.deal, npid: d.notion_page_id, rfp: matches[0].opportunity_name, rfpId: matches[0].notion_page_id, status: matches[0].status });
  } else if (matches.length > 1) {
    console.log(`AMBIGUOUS (${matches.length}) for deal "${d.deal}": ${matches.map((m) => m.opportunity_name).join(" | ")} — skipped`);
  }
}

console.log(`\nProposed links (${plan.length}):`);
for (const p of plan) console.log(`  "${p.deal}"  ->  [${p.status}] "${p.rfp}"  (${p.rfpId})`);

if (WRITE) {
  for (const p of plan) {
    const { error } = await supabase.from("deals").update({ rfp_ids: [p.rfpId] }).eq("notion_page_id", p.npid);
    console.log(error ? `  FAIL ${p.deal}: ${error.message}` : `  linked ${p.deal}`);
  }
  console.log("\nDONE (write mode).");
} else {
  console.log("\nDRY RUN — re-run with --write to apply.");
}
