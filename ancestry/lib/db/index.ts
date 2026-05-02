import { neon } from "@neondatabase/serverless";

// HTTP-based driver — works on CF Workers, Vercel, and Node.js alike.
// postgres (TCP) is not available in CF Workers; neon() uses fetch instead.

let _neon: ReturnType<typeof neon> | null = null;

function getNeon() {
  if (!_neon) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("Database not configured: set DATABASE_URL");
    }
    _neon = neon(connectionString);
  }
  return _neon;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlFn = (strings: TemplateStringsArray, ...values: any[]) => Promise<Record<string, any>[]>;

export function getDb(): SqlFn {
  const sql = getNeon();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (strings: TemplateStringsArray, ...values: any[]) =>
    sql(strings, ...values) as unknown as Promise<Record<string, any>[]>;
}
