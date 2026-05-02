import { neon } from "@neondatabase/serverless";

// neon() uses HTTP fetch (not WebSocket) — works natively on CF Workers,
// Vercel Edge, and Node.js. No connection pool or WebSocket config needed.
// Each call is a single HTTPS round-trip to the Neon serverless driver endpoint.

let _neon: ReturnType<typeof neon> | null = null;

function getNeon() {
  if (!_neon) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Database not configured: set POSTGRES_URL or DATABASE_URL",
      );
    }
    _neon = neon(connectionString);
  }
  return _neon;
}

/**
 * Tagged template handler that converts template literals into
 * parameterized queries. Mirrors @vercel/postgres tagged template API.
 *
 * Returns `{ rows, rowCount }` so all existing callers (`result.rows[0]`, etc.)
 * continue to work without changes.
 *
 * Usage: await sql`SELECT * FROM users WHERE id = ${id}`
 * Becomes: neon("SELECT * FROM users WHERE id = $1", [id])
 */
async function sqlTagged(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  // Cast to any[]: neon() returns a union type; using any[] mirrors the old
  // Pool.query<any>() return so all existing row-access patterns work unchanged.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await getNeon()(text, values as unknown[])) as any[];
  return { rows, rowCount: rows.length };
}

// Attach .query() so both patterns work:
//   await sql`SELECT ...`           (tagged template)
//   await sql.query(text, params)   (explicit parameterized)
sqlTagged.query = async (text: string, params?: unknown[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await getNeon()(text, params as unknown[])) as any[];
  return { rows, rowCount: rows.length };
};

export const sql = sqlTagged;

/**
 * Run the initial schema migration only (001_initial_schema.sql).
 *
 * Audit-2 L2: renamed from runMigrations() to clarify this does NOT run
 * all 11+ migrations - only the initial schema. In production, migrations
 * are applied via the Neon console or a dedicated migration runner.
 * This helper is only used for local development setup (Node.js only).
 *
 * @param migrationSql — the contents of 001_initial_schema.sql, read by
 *                       the caller using Node's fs.readFileSync. This
 *                       function itself avoids any Node-only imports so
 *                       the module can be bundled for CF Workers.
 */
export async function runInitialSchema(migrationSql: string) {
  const statements = migrationSql
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql.query(statement);
  }
}
