import { Pool } from "@neondatabase/serverless";

/**
 * Shared Neon Postgres client for the harbour hub.
 *
 * Mirrors the pattern in apps/depth-chart/lib/db.ts so both apps
 * use the same template-literal sql tag and `.query()` shape that
 * the shared `harbourAdapter` expects.
 *
 * Connection string comes from POSTGRES_URL (set via wrangler
 * secret on the wv-harbour-harbour Worker; falls back to
 * DATABASE_URL for local Node tooling).
 */

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

function sqlTagged(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  return getPool().query(text, values);
}

sqlTagged.query = (text: string, params?: unknown[]) =>
  getPool().query(text, params);

export const sql = sqlTagged;
