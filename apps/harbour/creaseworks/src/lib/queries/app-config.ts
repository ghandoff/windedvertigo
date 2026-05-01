import { sql } from "@/lib/db";
import { unstable_cache } from "next/cache";

export interface ConfigItem {
  name: string;
  key: string | null;
  group: string | null;
  sortOrder: number;
  metadata: string | null;
}

/**
 * Fetch all config items for a given group.
 *
 * The `metadata` field stores a JSON string for structured data
 * (e.g. `{ "label": "just play", "emoji": "🎈", "sub": "..." }`).
 * Consumers parse it as needed.
 *
 * Cached for 5 minutes via Next.js data cache.
 */
export const getConfigGroup = unstable_cache(
  async (group: string): Promise<ConfigItem[]> => {
    const result = await sql`
      SELECT name, key, grp, sort_order, metadata
      FROM app_config_cache
      WHERE grp = ${group}
      ORDER BY sort_order ASC
    `;
    return result.rows.map((row) => ({
      name: row.name,
      key: row.key,
      group: row.grp,
      sortOrder: row.sort_order ?? 0,
      metadata: row.metadata,
    }));
  },
  ["app-config"],
  { revalidate: 300 },
);

/**
 * Parse the metadata JSON string from a config item.
 * Returns an empty object on parse failure.
 */
export function parseMetadata<T = Record<string, unknown>>(
  item: ConfigItem,
): T {
  if (!item.metadata) return {} as T;
  try {
    return JSON.parse(item.metadata) as T;
  } catch {
    return {} as T;
  }
}
