/**
 * One-shot script: run migrations 012 + 013 against Vercel Postgres.
 * Usage: npx tsx scripts/run-012-013.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  console.warn("no .env.local found — relying on existing env vars");
}

import { sql } from "@vercel/postgres";

function splitSQL(text: string): string[] {
  return text
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => {
          const t = line.trim();
          return t.length > 0 && t.substring(0, 2) !== "--";
        })
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);
}

async function main() {
  console.log("Running migration 012...");
  const m012 = readFileSync(
    resolve(process.cwd(), "migrations", "012_collective_fields.sql"),
    "utf-8"
  );
  for (const stmt of splitSQL(m012)) {
    await sql.query(stmt);
  }
  console.log("  done");

  console.log("Running migration 013...");
  const m013 = readFileSync(
    resolve(process.cwd(), "migrations", "013_collections_and_progress.sql"),
    "utf-8"
  );
  for (const stmt of splitSQL(m013)) {
    await sql.query(stmt);
  }
  console.log("  done");

  console.log("Migrations 012 + 013 complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
