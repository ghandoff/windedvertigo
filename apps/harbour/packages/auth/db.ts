/**
 * Shared database connection for harbour auth.
 *
 * Provides a `sql` object with a `.query(text, params)` method that is
 * API-compatible with @vercel/postgres, backed by @neondatabase/serverless Pool.
 * The Pool uses WebSocket transport, which works on both Node.js and
 * Cloudflare Workers (where raw TCP sockets are unavailable).
 *
 * Reads POSTGRES_URL or DATABASE_URL from the environment.
 */
import { Pool } from "@neondatabase/serverless";

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

export const sql = {
  query: (text: string, params?: unknown[]) => getPool().query(text, params),
};
