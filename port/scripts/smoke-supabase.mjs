import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

const tables = ["campaigns", "contacts", "organizations", "rfp_opportunities", "deals"];

let failed = false;
for (const table of tables) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error(`❌  ${table}: ${error.message}`);
    failed = true;
  } else if (!count || count === 0) {
    console.error(`❌  ${table}: 0 rows — sync may not be running`);
    failed = true;
  } else {
    console.log(`✅  ${table}: ${count} rows`);
  }
}

// Extra: verify revenue pipeline — at least some deals should have revenue_tier set
const { data: revDeals, error: revErr } = await sb
  .from("deals")
  .select("id", { count: "exact" })
  .not("revenue_tier", "is", null);

if (revErr) {
  console.error(`❌  deals.revenue_tier column: ${revErr.message}`);
  failed = true;
} else {
  const n = revDeals?.length ?? 0;
  if (n === 0) {
    console.warn(`🟡  deals.revenue_tier: 0 rows — revenue pipeline may not be seeded`);
  } else {
    console.log(`✅  deals.revenue_tier: ${n} deal(s) tagged`);
  }
}

process.exit(failed ? 1 : 0);
