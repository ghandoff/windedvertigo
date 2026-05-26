/**
 * /compose — social authoring drafts list (W3 MVP).
 *
 * Shows all drafts (across channels + authors). Editor lives at /compose/[id].
 * "New draft" creates an empty draft on the server then redirects to the editor.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Send } from "lucide-react";
import {
  listComposeDrafts,
  CHANNEL_LABELS,
  CHANNEL_CHAR_LIMITS,
} from "@/lib/supabase/compose-drafts";
import { NewDraftForm } from "./new-draft-form";

export const metadata: Metadata = {
  title: "compose — the port",
  description: "draft posts across LinkedIn / Bluesky / Substack / Meta / email from one place.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_CLASS: Record<string, string> = {
  draft:     "text-muted-foreground bg-muted/20",
  scheduled: "text-[#5872cb] bg-[#5872cb]/10",
  published: "text-[#43b187] bg-[#43b187]/10",
  failed:    "text-[#b15043] bg-[#b15043]/10",
};

export default async function ComposePage() {
  const drafts = await listComposeDrafts({ limit: 100 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="compose"
        description="draft posts across LinkedIn · Bluesky · Substack · Meta · email. MVP: drafts only — publishing + AI assist land in the next push."
      />

      <NewDraftForm />

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            no drafts yet. pick a channel above to start your first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <Card key={d.id} className="hover:border-[#cb7858] transition-colors">
              <CardContent className="py-3">
                <Link href={`/compose/${d.id}`} className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Send className="h-4 w-4 text-[#5872cb]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_CLASS[d.status] ?? ""}`}>
                        {d.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {CHANNEL_LABELS[d.channel]} · updated {formatDate(d.updatedAt)} · {d.authorEmail}
                      </span>
                    </div>
                    {d.title && (
                      <p className="text-sm text-[#273248] mt-1">{d.title}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {d.contentText.slice(0, 200) || <span className="italic opacity-60">(empty)</span>}
                    </p>
                    {CHANNEL_CHAR_LIMITS[d.channel] !== null && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                        {d.contentText.length} / {CHANNEL_CHAR_LIMITS[d.channel]} chars
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground pt-2">
        <Plus className="inline h-3 w-3 mr-1" />
        publishing wiring (LinkedIn, Bluesky, Substack, Meta) ships in W3 push 2. for now drafts persist and are visible to the team.
      </p>
    </div>
  );
}
