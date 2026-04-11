import { neon } from "@neondatabase/serverless";

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return sql;
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
