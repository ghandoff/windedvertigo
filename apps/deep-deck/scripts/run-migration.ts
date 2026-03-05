/**
 * Run deep.deck database migrations against Neon Postgres.
 *
 * Usage:
 *   POSTGRES_URL="postgres://..." npx tsx scripts/run-migration.ts
 *
 * Or if you have .env.local with POSTGRES_URL:
 *   npx tsx scripts/run-migration.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local so @vercel/postgres can find POSTGRES_URL
try {
  const dotenv = require("dotenv");
  dotenv.config({ path: resolve(__dirname, "../.env.local") });
} catch {
  // dotenv not installed — POSTGRES_URL must be in environment
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error("❌ POSTGRES_URL is not set.");
    console.error("   Set it in .env.local or pass it as an environment variable:");
    console.error('   POSTGRES_URL="postgres://..." npx tsx scripts/run-migration.ts');
    process.exit(1);
  }

  const { sql } = await import("@vercel/postgres");

  const migrationPath = resolve(__dirname, "../migrations/001_initial_schema.sql");
  const migrationSql = readFileSync(migrationPath, "utf-8");

  console.log("🔄 Running migration: 001_initial_schema.sql");
  console.log(`   Database: ${process.env.POSTGRES_URL.replace(/\/\/[^@]+@/, "//***@")}`);

  // Split on semicolons and run each statement
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    try {
      await sql.query(statement);
      // Show first line as summary
      const firstLine = statement.split("\n").find((l) => l.trim() && !l.trim().startsWith("--")) || statement;
      console.log(`   ✅ ${firstLine.trim().slice(0, 60)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "already exists" is fine for IF NOT EXISTS statements
      if (msg.includes("already exists")) {
        const firstLine = statement.split("\n").find((l) => l.trim() && !l.trim().startsWith("--")) || statement;
        console.log(`   ⏭️  ${firstLine.trim().slice(0, 60)} (already exists)`);
      } else {
        console.error(`   ❌ Failed: ${msg}`);
        console.error(`      Statement: ${statement.slice(0, 100)}...`);
        process.exit(1);
      }
    }
  }

  console.log("\n✅ Migration complete!");
  await sql.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
