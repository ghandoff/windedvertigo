/**
 * UTM link tagging for campaign emails.
 *
 * Appends UTM parameters to all windedvertigo.com links in HTML content,
 * so email-to-website clicks are attributed to the originating campaign.
 */

const WV_DOMAINS = ["windedvertigo.com", "www.windedvertigo.com"];

interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
}

/**
 * Add UTM parameters to all windedvertigo.com links in an HTML string.
 * Preserves existing query parameters. Skips links that already have utm_source.
 */
export function tagLinksWithUtm(html: string, params: UtmParams): string {
  // Match href="..." or href='...' containing windedvertigo.com
  return html.replace(
    /href=(["'])(https?:\/\/(?:www\.)?windedvertigo\.com[^"']*)\1/gi,
    (fullMatch, quote, url) => {
      try {
        const parsed = new URL(url);

        // Skip if already tagged
        if (parsed.searchParams.has("utm_source")) return fullMatch;

        // Only tag our own domains
        if (!WV_DOMAINS.includes(parsed.hostname)) return fullMatch;

        parsed.searchParams.set("utm_source", params.utm_source);
        parsed.searchParams.set("utm_medium", params.utm_medium);
        parsed.searchParams.set("utm_campaign", params.utm_campaign);
        if (params.utm_content) {
          parsed.searchParams.set("utm_content", params.utm_content);
        }

        return `href=${quote}${parsed.toString()}${quote}`;
      } catch {
        return fullMatch; // malformed URL — leave as-is
      }
    },
  );
}

/** Build standard UTM params for a campaign email send. */
export function buildEmailUtmParams(campaignName: string, variant?: "a" | "b"): UtmParams {
  const params: UtmParams = {
    utm_source: "resend",
    utm_medium: "email",
    utm_campaign: slugify(campaignName),
  };
  if (variant) {
    params.utm_content = `variant-${variant}`;
  }
  return params;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
