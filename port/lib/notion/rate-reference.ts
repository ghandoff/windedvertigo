/**
 * Rate Reference data layer.
 *
 * Provides daily rate benchmarks by role, funder type, and geography.
 * Used by the proposal generator to calibrate budget framework sections.
 */

import {
  getTitle,
  getText,
  getSelect,
  getNumber,
  queryDatabase,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, RATE_REFERENCE_PROPS } from "./client";
import type { RateReference } from "./types";

const P = RATE_REFERENCE_PROPS;

function mapPageToRateReference(page: PageObjectResponse): RateReference {
  const props = page.properties;
  return {
    id: page.id,
    role: getTitle(props[P.role]),
    dailyRateLow: getNumber(props[P.dailyRateLow]),
    dailyRateHigh: getNumber(props[P.dailyRateHigh]),
    funderType: getSelect(props[P.funderType]),
    geography: getSelect(props[P.geography]),
    source: getSelect(props[P.source]),
    icsLevel: getSelect(props[P.icsLevel]),
    notes: getText(props[P.notes]),
  };
}

/**
 * Query rate benchmarks, optionally filtered by funder type and/or geography.
 * Fetches all entries (database is small, ~24 rows) and filters in-process.
 */
export async function queryRateReference(opts?: {
  funderType?: string;
  geography?: string;
}): Promise<RateReference[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.rateReference,
    page_size: 100,
    label: "queryRateReference",
  });

  const all = result.pages.map(mapPageToRateReference);

  if (!opts?.funderType && !opts?.geography) return all;

  return all.filter((r) => {
    const funderMatch =
      !opts.funderType ||
      !r.funderType ||
      r.funderType === opts.funderType ||
      r.funderType === "Any";
    const geoMatch =
      !opts.geography ||
      !r.geography ||
      r.geography === opts.geography ||
      r.geography === "Global";
    return funderMatch && geoMatch;
  });
}

/**
 * Format a rate reference set as a compact string for injection into a prompt.
 * Returns empty string if no rates are available.
 */
export function formatRatesForPrompt(rates: RateReference[]): string {
  if (rates.length === 0) return "";

  const lines = rates.map((r) => {
    const range =
      r.dailyRateLow != null && r.dailyRateHigh != null
        ? `$${r.dailyRateLow.toLocaleString()}–$${r.dailyRateHigh.toLocaleString()}/day`
        : r.dailyRateLow != null
          ? `$${r.dailyRateLow.toLocaleString()}/day`
          : "rate TBD";
    const meta = [r.funderType, r.geography, r.icsLevel].filter(Boolean).join(", ");
    const note = r.notes ? ` — ${r.notes}` : "";
    return `- ${r.role}: ${range}${meta ? ` (${meta})` : ""}${note}`;
  });

  return lines.join("\n");
}
