import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";

const BASE = "https://windedvertigo.com/reservoir/vertigo-vault";

/**
 * Dynamic sitemap — lists the vault catalog, pack landing pages, and
 * every individual activity page.
 *
 * Next.js serves this at /reservoir/vertigo-vault/sitemap.xml.
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
      `SELECT slug, updated_at FROM vault_activities_cache ORDER BY name ASC`,
    );
    activityRoutes = result.rows.map(
      (row: { slug: string; updated_at: string | Date }) => ({
        url: `${BASE}/${row.slug}`,
        lastModified: new Date(row.updated_at),
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
