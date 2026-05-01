/**
 * /we/ — "who we are" page, content managed in Notion.
 *
 * Static page powered by the cms_pages table. Content is synced from
 * a Notion page (NOTION_CMS_PAGE_WE) and rendered as HTML.
 *
 * Falls back to a placeholder when no CMS content has been synced yet.
 *
 * SECURITY: The HTML comes from Notion's structured block API, rendered
 * by fetchPageBodyHtml() which escapes all text content via escapeHtml().
 * The source is admin-controlled — only windedvertigo team members can
 * edit the Notion page. This is NOT user-generated content.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getCmsPage } from "@/lib/queries/cms-pages";

export const revalidate = 3600; // ISR — regenerate hourly

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("we");
  return {
    title: page?.title ?? "who we are",
    description:
      page?.meta_description ??
      "winded.vertigo is a small design studio that makes playdates — short, structured invitations to tinker, build, and discover with kids.",
  };
}

export default async function WePage() {
  const page = await getCmsPage("we");

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <Link
        href="/"
        className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-8 inline-block"
      >
        &larr; back to creaseworks
      </Link>

      {page?.body_html ? (
        <article
          className="cms-body prose-like"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: page.body_html }}
        />
      ) : (
        <article className="cms-body prose-like">
          <h1>who we are</h1>
          <p className="text-cadet/60">
            this page is still being written. check back soon.
          </p>
        </article>
      )}
    </main>
  );
}
