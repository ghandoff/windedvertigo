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

const tables = ["campaigns", "contacts", "organizations", "rfp_opportunities"];

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

process.exit(failed ? 1 : 0);
