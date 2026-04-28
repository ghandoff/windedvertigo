// Pure date-formatting helpers — no DB connection, safe to import in client components.

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
