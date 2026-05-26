/**
 * /compose/[id] — draft editor (W3 MVP).
 *
 * Server fetches the draft; client editor handles edits + autosave.
 * Publishing UI is intentionally absent in MVP — drafts only.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { getComposeDraft, CHANNEL_LABELS } from "@/lib/supabase/compose-drafts";
import { ComposeEditor } from "./editor";

export const metadata: Metadata = {
  title: "compose draft — the port",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ComposeDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draft = await getComposeDraft(id);
  if (!draft) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/compose"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#b15043]"
      >
        <ChevronLeft className="h-3 w-3" />
        back to drafts
      </Link>

      <PageHeader
        title={draft.title || `${CHANNEL_LABELS[draft.channel]} draft`}
        description={`${CHANNEL_LABELS[draft.channel]} · ${draft.status} · authored by ${draft.authorEmail}`}
      />

      <ComposeEditor initial={draft} />
    </div>
  );
}
