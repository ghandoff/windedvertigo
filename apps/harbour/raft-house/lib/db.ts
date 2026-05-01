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
