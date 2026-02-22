import { sql } from "@vercel/postgres";
import { readFileSync } from "fs";
import { join } from "path";

export { sql };

/**
 * Run the initial schema migration only (001_initial_schema.sql).
 *
 * Audit-2 L2: renamed from runMigrations() to clarify this does NOT run
 * all 11+ migrations - only the initial schema. In production, migrations
 * are applied via the Neon console or a dedicated migration runner.
 * This helper is only used for local development setup.
 */
export async function runInitialSchema() {
  const migrationPath = join(process.cwd(), "migrations", "001_initial_schema.sql");
  const migration = readFileSync(migrationPath, "utf-8");

  // Split on semicolons, strip comment-only lines from each fragment,
  // then keep any fragment that still contains real SQL.
  const statements = migration
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql.query(statement);
  }
}
