import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

let pool: Pool;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.POSTGRES_URL || process.env.DATABASE_URL,
    });
  }
  return pool;
}

/**
 * Tagged template handler that converts template literals into
 * parameterized queries. Mirrors @vercel/postgres tagged template API.
 *
 * Usage: await sql`SELECT * FROM users WHERE id = ${id}`
 * Becomes: pool.query("SELECT * FROM users WHERE id = $1", [id])
 */
function sqlTagged(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  return getPool().query(text, values);
}

// Attach .query() so both patterns work:
//   await sql`SELECT ...`        (tagged template)
//   await sql.query(text, params) (parameterized)
sqlTagged.query = (text: string, params?: unknown[]) =>
  getPool().query(text, params);

export const sql = sqlTagged;

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
