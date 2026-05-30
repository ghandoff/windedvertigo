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

function sqlTagged(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult> {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  // The neon() function accepts (query: string, params: unknown[]) at runtime
  // even though its TypeScript overload only exposes the tagged-template form.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getConn() as any)(text, values).then((rows: any[]) => ({ rows, rowCount: rows.length }));
}

sqlTagged.query = async (
  text: string,
  params?: unknown[],
): Promise<QueryResult> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await (getConn() as any)(text, params ?? [])) as any[];
  return { rows, rowCount: rows.length };
};

export const harbourSql = sqlTagged as SqlClient;

/** Returns true if POSTGRES_URL is present in the environment. */
export function isNeonConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL);
}
