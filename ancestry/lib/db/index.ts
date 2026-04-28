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

// fuzzy date helpers
export type FuzzyDate = {
  precision: "exact" | "about" | "before" | "after" | "between" | "year" | "month";
  date: string;
  date_to?: string;
  display: string;
};

export function formatFuzzyDate(d: FuzzyDate | null): string {
  if (!d) return "";
  return d.display;
}

export function fuzzyDateToSortDate(d: FuzzyDate | null): string | null {
  if (!d) return null;
  return d.date;
}
