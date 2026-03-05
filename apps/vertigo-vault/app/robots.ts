import type { MetadataRoute } from "next";

/**
 * robots.txt — allows all crawlers; points to the sitemap.
 *
 * Next.js serves this at /reservoir/vertigo-vault/robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/checkout/"],
      },
    ],
    sitemap: "https://windedvertigo.com/reservoir/vertigo-vault/sitemap.xml",
  };
}
