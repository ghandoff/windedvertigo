/**
 * Harbour-apps Neon database client — for port's L2 analytics.
 *
 * Reads from the SAME Neon Postgres instance that harbour-apps writes to
 * (users, entitlements, purchases, harbour_knots, dc_usage_events, etc.).
 *
 * CF Workers compatible: uses @neondatabase/serverless HTTP driver
 * (stateless HTTPS per query, no WebSocket, no persistent connection).
 *
 * Supports two call patterns:
 *   await sql`SELECT * FROM users WHERE id = ${id}`        (tagged template)
 *   await sql.query("SELECT … WHERE id = $1", [id])        (.query())
 *
 * ── SETUP REQUIRED ──────────────────────────────────────────────────
 * This client requires POSTGRES_URL to point at harbour's Neon pooled
 * connection string. Add it as a CF Worker secret:
 *
 *   wrangler secret put POSTGRES_URL --name wv-port
 *
 * The value is the same POSTGRES_URL used by harbour-apps/apps/creaseworks.
 * It is NOT the same as Supabase — those use NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SECRET_KEY and are read through port/lib/supabase/*.
 * ────────────────────────────────────────────────────────────────────
 */

import { neon } from "@neondatabase/serverless";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResult = { rows: any[]; rowCount: number };

type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResult>;
  query(text: string, params?: unknown[]): Promise<QueryResult>;
};

let _conn: ReturnType<typeof neon> | null = null;

function getConn(): ReturnType<typeof neon> {
  if (!_conn) {
    const url = process.env.POSTGRES_URL;
    if (!url) {
      throw new Error(
        "[harbour-neon] POSTGRES_URL is not set. " +
          "Run: wrangler secret put POSTGRES_URL --name wv-port",
      );
    }
    _conn = neon(url);
  }
  return _conn;
}

/**
 * Normalise the result from a neon() call into { rows, rowCount }.
 *
 * @neondatabase/serverless v1.x changed the call convention:
 *   - Tagged template  sql`SELECT ${x}`      → rows[]  (unchanged)
 *   - .query() method  sql.query("…", [x])   → rows[]  (unchanged)
 *   - Direct call      sql("…", [x])         → REMOVED in v1.x
 *
 * Both supported forms return a plain rows array, so we normalise here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResult(raw: any): QueryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(raw) ? raw : (raw?.rows ?? []);
  return { rows, rowCount: typeof raw?.rowCount === "number" ? raw.rowCount : rows.length };
}

function sqlTagged(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult> {
  // Call neon() as a proper tagged template — supported in all versions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getConn()(strings, ...values) as Promise<any>).then(toResult);
}

sqlTagged.query = async (
  text: string,
  params?: unknown[],
): Promise<QueryResult> => {
  // Use .query() method — v1.x removed the direct-function-call form.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await (getConn() as any).query(text, params ?? []);
  return toResult(raw);
};

export const harbourSql = sqlTagged as SqlClient;

/** Returns true if POSTGRES_URL is present in the environment. */
export function isNeonConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL);
}
