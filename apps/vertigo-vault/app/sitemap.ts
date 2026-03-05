import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";

/**
 * Revalidate the sitemap every hour so new/updated activities appear
 * without waiting for a full redeploy. This also tells Next.js not to
 * prerender the sitemap statically at build time (when the DB isn't
 * available).
 */
export const revalidate = 3600;

const BASE = "https://windedvertigo.com/harbor/vertigo-vault";

/**
 * Dynamic sitemap — lists the vault catalog, pack landing pages, and
 * every individual activity page.
 *
 * Next.js serves this at /harbor/vertigo-vault/sitemap.xml.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/explorer`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/practitioner`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Dynamic activity pages — lightweight query for slug + last modified
  let activityRoutes: MetadataRoute.Sitemap = [];
  try {
    const result = await sql.query(
      `SELECT slug, synced_at FROM vault_activities_cache ORDER BY name ASC`,
    );
    activityRoutes = result.rows.map(
      (row: { slug: string; synced_at: string | Date }) => ({
        url: `${BASE}/${row.slug}`,
        lastModified: new Date(row.synced_at),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }),
    );
  } catch (err) {
    // If DB is unreachable, return static routes only.
    // This prevents build failures in environments without DB access.
    console.error("sitemap: failed to query activities:", err);
  }

  return [...staticRoutes, ...activityRoutes];
}
