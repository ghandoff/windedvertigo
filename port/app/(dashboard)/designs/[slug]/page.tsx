/**
 * /designs/[slug] — designed-doc editor (W2 MVP).
 *
 * Server fetches the doc (or creates a stub from the slug) and hands to the
 * client editor. Editor is intentionally minimal: title, frontmatter JSON,
 * markdown textarea, save, preview-PDF button.
 *
 * Polished editor (TipTap, side-by-side live preview, frontmatter form)
 * lands in a follow-up; for now the goal is to round-trip wv-claw / Cowork
 * markdown → branded PDF and see what the result looks like.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { getDesignDoc } from "@/lib/supabase/design-docs";
import { DesignEditor } from "./editor";

export const metadata: Metadata = {
  title: "design — the port",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SAMPLE_MARKDOWN = `# Executive summary

A short paragraph describing the engagement, the client's goal, and the proposed approach.

## Scope

### Phase 1 — Discovery

- stakeholder interviews
- existing-material audit
- success-metrics workshop

### Phase 2 — Design

- prototype iterations
- usability testing
- refinement

## Timeline

> 6 weeks, starting June 1, 2026

## Investment

$50,000 — invoiced in three installments tied to milestone delivery.
`;

export default async function DesignEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const existing = await getDesignDoc(slug);

  const initial = existing ?? {
    id: "",
    slug,
    title: slug.replace(/-/g, " "),
    template: "proposal-v1",
    frontmatter: {
      client: "",
      preparedBy: "Garrett Jaeger · winded.vertigo",
      version: "v0.1",
    },
    contentMarkdown: SAMPLE_MARKDOWN,
    ownerEmail: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <Link
        href="/designs"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#b15043]"
      >
        <ChevronLeft className="h-3 w-3" />
        back to designs
      </Link>

      <PageHeader
        title={existing ? existing.title : "new design doc"}
        description={`template: ${initial.template} · slug: ${slug}`}
      />

      <DesignEditor initial={initial} />
    </div>
  );
}
