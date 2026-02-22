import { sql } from "@vercel/postgres";
import { readFileSync } from "fs";
import { join } from "path";

export { sql };

/**
 * Run the initial schema migration.
 * Called from a setup script or on first deploy.
 */
export async function runMigrations() {
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
