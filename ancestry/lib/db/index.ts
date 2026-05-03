import { Pool } from "@neondatabase/serverless";

// Pool uses TCP in Node.js (Vercel) and WebSockets in CF Workers.
// Compatible with any PostgreSQL host including Supabase — unlike neon() which
// targets Neon's proprietary HTTP API only.
// See: https://github.com/neondatabase/serverless/releases/tag/v1.0.0

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("Database not configured: set DATABASE_URL");
    }
    _pool = new Pool({ connectionString });
  }
  return _pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlFn = (strings: TemplateStringsArray, ...values: any[]) => Promise<Record<string, any>[]>;

export function getDb(): SqlFn {
  const pool = getPool();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (strings: TemplateStringsArray, ...values: any[]) => {
    // Convert tagged template literal to a parameterized query ($1, $2, …)
    let text = "";
    strings.forEach((str, i) => {
      text += str;
      if (i < values.length) text += `$${i + 1}`;
    });
    return pool.query(text, values).then((r) => r.rows as Record<string, any>[]);
  };
}
