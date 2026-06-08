/**
 * Seed cARL's curriculum with Mo and Pam development tracks (+ a few collective
 * topics) so the daily lifelong-learning run has immediate material. Audience is
 * encoded by the domain prefix: "mo · …" / "pam · …". Idempotent-ish: skips a
 * topic if an identical (domain, topic) is already present. DML — service key.
 *
 *   node --env-file=<env> scripts/seed-carl-mo-pam-tracks.mjs
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) { console.error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY"); process.exit(1); }
const sb = createClient(URL, KEY);

const TOPICS = [
  // ── Mo — CMO pursuing MBA/PhD: strategy, marketing science, case studies ──
  { domain: "mo · business strategy", topic: "competitive positioning and differentiation in crowded markets", key_works: ["Porter, Competitive Strategy, 1980"], priority: 1 },
  { domain: "mo · go-to-market", topic: "category creation and crossing the chasm for new products", key_works: ["Moore, Crossing the Chasm"], priority: 2 },
  { domain: "mo · pricing", topic: "value-based pricing and measuring willingness-to-pay", key_works: ["Nagle, The Strategy and Tactics of Pricing"], priority: 2 },
  { domain: "mo · marketing science", topic: "brand equity — what it is and how to measure it", key_works: ["Keller, Strategic Brand Management"], priority: 2 },
  { domain: "mo · marketing science", topic: "customer lifetime value and cohort-based unit economics", key_works: [], priority: 1 },
  { domain: "mo · MBA case studies", topic: "a recent case on product-led growth in B2B SaaS", key_works: [], priority: 2 },
  { domain: "mo · marketing science", topic: "positioning research — jobs-to-be-done and switching", key_works: ["Christensen, Competing Against Luck"], priority: 2 },

  // ── Pam — PM craft ──
  { domain: "pam · estimation", topic: "estimation under uncertainty and reference-class forecasting", key_works: ["Flyvbjerg, reference class forecasting"], priority: 1 },
  { domain: "pam · dependencies", topic: "critical path and managing cross-team dependencies", key_works: [], priority: 2 },
  { domain: "pam · team momentum", topic: "flow, WIP limits, and sustainable pace", key_works: ["Anderson, Kanban"], priority: 2 },
  { domain: "pam · risk", topic: "premortems and surfacing project risk early", key_works: ["Klein, premortem method"], priority: 2 },

  // ── collective — keeps the apps/proposals strong ──
  { domain: "threshold concepts", topic: "liminality and troublesome knowledge in practice", key_works: ["Meyer & Land, threshold concepts"], priority: 2 },
  { domain: "play-based learning", topic: "guided play versus free play — outcomes and trade-offs", key_works: [], priority: 2 },
];

async function main() {
  const { data: existing } = await sb.from("carl_curriculum").select("domain, topic");
  const have = new Set((existing ?? []).map((r) => `${r.domain}||${r.topic}`));

  let inserted = 0, skipped = 0;
  for (const t of TOPICS) {
    if (have.has(`${t.domain}||${t.topic}`)) { skipped++; continue; }
    const { error } = await sb.from("carl_curriculum").insert({
      domain: t.domain,
      topic: t.topic,
      key_works: t.key_works ?? [],
      priority: t.priority ?? 2,
      status: "planned",
      notes: "seeded — cARL lifelong-learning tracks (Mo/Pam development)",
      sort_order: 0,
    });
    if (error) console.warn(`insert failed (${t.domain}):`, error.message);
    else inserted++;
  }
  console.log(`seed done — ${inserted} inserted · ${skipped} already present`);
}

main();
