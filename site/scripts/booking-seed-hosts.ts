/**
 * Seed the hosts table with the 5 collective members.
 *
 * Usage:
 *   cd site
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/booking-seed-hosts.ts
 *
 * Idempotent: re-running updates rows in place (upsert keyed on slug).
 *
 * After this script runs, visit /admin/booking/connect?admin=$BOOKING_ADMIN_TOKEN
 * to OAuth each host. Then run booking-seed-event-types.ts.
 */

export {};

const HOSTS = [
  {
    slug: "garrett",
    display_name: "garrett",
    email: "garrett@windedvertigo.com",
    timezone: "America/Los_Angeles",
    working_hours: weekdays9to5(),
  },
  {
    slug: "payton",
    display_name: "payton",
    email: "payton@windedvertigo.com",
    timezone: "America/Los_Angeles", // confirm
    working_hours: weekdays9to5(),
  },
  {
    slug: "lamis",
    display_name: "lamis",
    email: "lamis@windedvertigo.com",
    timezone: "America/Los_Angeles", // confirm — likely different
    working_hours: weekdays9to5(),
  },
  {
    slug: "maria",
    display_name: "maria",
    email: "maria@windedvertigo.com",
    timezone: "America/Los_Angeles", // confirm — IDB Salvador / Latin America
    working_hours: weekdays9to5(),
  },
  {
    slug: "james",
    display_name: "james",
    email: "james@windedvertigo.com",
    timezone: "America/Los_Angeles", // confirm
    working_hours: weekdays9to5(),
  },
];

function weekdays9to5() {
  return {
    mon: [["09:00", "17:00"]],
    tue: [["09:00", "17:00"]],
    wed: [["09:00", "17:00"]],
    thu: [["09:00", "17:00"]],
    fri: [["09:00", "17:00"]],
    sat: [],
    sun: [],
  };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/hosts?on_conflict=slug`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(HOSTS),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`upsert failed (${res.status}):`, text);
    process.exit(1);
  }

  const rows = (await res.json()) as { id: string; slug: string }[];
  console.log(`✓ upserted ${rows.length} hosts:`);
  for (const r of rows) console.log(`  ${r.slug.padEnd(10)} → ${r.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
