/**
 * Seed the event_types table with the 8-slug catalog.
 *
 * Run AFTER booking-seed-hosts.ts (this script resolves host_pool[] by
 * looking up the host slugs in the hosts table).
 *
 * Usage:
 *   cd site
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/booking-seed-event-types.ts
 *
 * Idempotent: upsert keyed on slug.
 */

export {};

interface EventTypeSeed {
  slug: string;
  title: string;
  description: string;
  duration_min: number;
  mode: "solo" | "collective" | "round_robin";
  hostSlugs: string[];      // resolved to host_pool uuid[] before insert
  min_required: number;
  primary_host_slug?: string;
  notice_min: number;
}

const SEEDS: EventTypeSeed[] = [
  {
    slug: "garrett", title: "30 minutes with garrett",
    description: "a focused session with garrett.",
    duration_min: 30, mode: "solo",
    hostSlugs: ["garrett"], min_required: 1,
    primary_host_slug: "garrett", notice_min: 240,
  },
  {
    slug: "payton", title: "30 minutes with payton",
    description: "a focused session with payton.",
    duration_min: 30, mode: "solo",
    hostSlugs: ["payton"], min_required: 1,
    primary_host_slug: "payton", notice_min: 240,
  },
  {
    slug: "lamis", title: "30 minutes with lamis",
    description: "a focused session with lamis.",
    duration_min: 30, mode: "solo",
    hostSlugs: ["lamis"], min_required: 1,
    primary_host_slug: "lamis", notice_min: 240,
  },
  {
    slug: "maria", title: "30 minutes with maria",
    description: "a focused session with maria.",
    duration_min: 30, mode: "solo",
    hostSlugs: ["maria"], min_required: 1,
    primary_host_slug: "maria", notice_min: 240,
  },
  {
    slug: "james", title: "30 minutes with james",
    description: "a focused session with james.",
    duration_min: 30, mode: "solo",
    hostSlugs: ["james"], min_required: 1,
    primary_host_slug: "james", notice_min: 240,
  },
  {
    slug: "discovery", title: "discovery playdate",
    description: "30 minutes with whichever of us is most available — let's get acquainted.",
    duration_min: 30, mode: "round_robin",
    hostSlugs: ["garrett", "payton", "lamis", "maria", "james"], min_required: 1,
    notice_min: 240,
  },
  {
    slug: "strategy", title: "strategy playdate",
    description: "45 minutes with garrett and maria — for partnership and strategy conversations.",
    duration_min: 45, mode: "collective",
    hostSlugs: ["garrett", "maria"], min_required: 2,
    primary_host_slug: "garrett", notice_min: 1440,
  },
  {
    slug: "partnership", title: "partnership playdate",
    description: "45 minutes with garrett and payton — for outreach, comms, and joint initiatives.",
    duration_min: 45, mode: "collective",
    hostSlugs: ["garrett", "payton"], min_required: 2,
    primary_host_slug: "garrett", notice_min: 1440,
  },
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  // Resolve host slugs → uuids
  const hostsRes = await fetch(`${url}/rest/v1/hosts?select=id,slug`, { headers });
  if (!hostsRes.ok) {
    console.error("failed to fetch hosts:", await hostsRes.text());
    process.exit(1);
  }
  const hosts = (await hostsRes.json()) as { id: string; slug: string }[];
  const slugToId = Object.fromEntries(hosts.map((h) => [h.slug, h.id]));

  const rows = SEEDS.map((s) => {
    const host_pool = s.hostSlugs.map((slug) => {
      const id = slugToId[slug];
      if (!id) throw new Error(`host slug not found in DB: ${slug} (run booking-seed-hosts first)`);
      return id;
    });
    return {
      slug: s.slug,
      title: s.title,
      description: s.description,
      duration_min: s.duration_min,
      mode: s.mode,
      host_pool,
      min_required: s.min_required,
      primary_host_id: s.primary_host_slug ? slugToId[s.primary_host_slug] : null,
      notice_min: s.notice_min,
      horizon_days: 30,
      slot_step_min: 30,
      active: true,
      intake_required: false,
    };
  });

  const upsertRes = await fetch(`${url}/rest/v1/event_types?on_conflict=slug`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });

  if (!upsertRes.ok) {
    console.error("upsert failed:", await upsertRes.text());
    process.exit(1);
  }

  const out = (await upsertRes.json()) as { slug: string; mode: string }[];
  console.log(`✓ upserted ${out.length} event types:`);
  for (const r of out) console.log(`  ${r.slug.padEnd(14)} (${r.mode})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
