import postgres from "postgres";

const _sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

// Typed to match neon's NeonQueryFunction signature so all callers compile unchanged.
// postgres.RowList is structurally identical at runtime; this cast bridges the type gap.
type SqlFn = (
  strings: TemplateStringsArray,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...values: any[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<Record<string, any>[]>;

export function getDb(): SqlFn {
  return _sql as unknown as SqlFn;
}
