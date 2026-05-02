import { neon, Pool, neonConfig } from "@neondatabase/serverless";

// ─── HTTP driver (neon) ───────────────────────────────────────────────────────
// Used for all single-query operations. neon() uses HTTP fetch — works
// natively on CF Workers, Vercel, and Node.js with zero configuration.

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

// ─── WebSocket driver (Pool) ──────────────────────────────────────────────────
// Used only for transactions that need sequential queries (step 2 depends on
// step 1's result). WebSocket provides a persistent connection so BEGIN/COMMIT
// and intermediate RETURNING values all go through the same channel.
//
// CF Workers exposes a native WebSocket global. neonConfig must be set before
// any Pool is instantiated — module-level init is fine.
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Database not configured: set POSTGRES_URL or DATABASE_URL",
      );
    }
    _pool = new Pool({ connectionString });
  }
  return _pool;
}

// ─── Shared Queryable interface ───────────────────────────────────────────────

/** Interface shared by the top-level sql helper and transaction clients. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

// ─── sql — tagged template + parameterized helper ────────────────────────────

/**
 * Tagged template handler that converts template literals into
 * parameterized queries. Mirrors @vercel/postgres tagged template API.
 *
 * Returns `{ rows, rowCount }` so all existing callers (`result.rows[0]`,
 * etc.) continue to work without changes.
 */
async function sqlTagged(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await getNeon()(text, values as unknown[])) as any[];
  return { rows, rowCount: rows.length };
}

sqlTagged.query = async (text: string, params?: unknown[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await getNeon()(text, params as unknown[])) as any[];
  return { rows, rowCount: rows.length };
};

export const sql = sqlTagged;

// ─── db — transaction support ─────────────────────────────────────────────────

/**
 * Transaction support using Pool (WebSocket-backed).
 *
 * Sequential async transactions (where step 2 needs step 1's result) require
 * a persistent connection. neon() HTTP-batch transactions don't support
 * inter-query dependencies, so we use Pool here.
 *
 * The `client` passed to the callback is compatible with the `Queryable`
 * interface so all existing query functions (createPurchase, grantEntitlement)
 * work unchanged — they accept an optional `client` parameter.
 *
 * Example:
 *   await db.transaction(async (client) => {
 *     const id = await createPurchase(opts, client);
 *     await grantEntitlement(orgId, packId, id, null, client);
 *   });
 */
export const db = {
  transaction: async <T>(fn: (client: Queryable) => Promise<T>): Promise<T> => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await fn({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query: (text: string, values?: unknown[]) => client.query(text, values as any),
      });
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
