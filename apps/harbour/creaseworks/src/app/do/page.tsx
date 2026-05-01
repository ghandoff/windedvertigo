/**
 * /do/ — "what we do" page, content managed in Notion.
 *
 * Static page powered by the cms_pages table. Content is synced from
 * a Notion page (NOTION_CMS_PAGE_DO) and rendered as HTML.
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
  const page = await getCmsPage("do");
  return {
    title: page?.title ?? "what we do",
    description:
      page?.meta_description ??
      "winded.vertigo designs playdates — short, structured invitations that help kids tinker, build, and discover through play.",
  };
}

export default async function DoPage() {
  const page = await getCmsPage("do");

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
          // Safe: HTML generated from Notion's structured block API with escapeHtml()
          // Source is admin-controlled (windedvertigo team only edits Notion)
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: page.body_html }}
        />
      ) : (
        <article className="cms-body prose-like">
          <h1>what we do</h1>
          <p className="text-cadet/60">
            this page is still being written. check back soon.
          </p>
        </article>
      )}
    </main>
  );
}
