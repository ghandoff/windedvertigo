/**
 * /designs — designed-docs list (W2).
 *
 * MVP: list existing docs + a "new" button. Editor lives at /designs/[slug].
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";
import { listDesignDocs } from "@/lib/supabase/design-docs";

export const metadata: Metadata = {
  title: "designs — the port",
  description: "branded PDF outputs (proposals, reports) rendered from markdown + React-PDF templates.",
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

export default async function DesignsPage() {
  const docs = await listDesignDocs(50);
  // Suggest a fresh slug for the "new" link.
  const today = new Date().toISOString().slice(0, 10);
  const newSlug = `untitled-${today}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="designs"
        description="markdown → branded PDF. one template today (proposal-v1); export inline or via the AI-assist flow with wv-claw / cowork."
      />

      <Link
        href={`/designs/${newSlug}`}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[#b15043] text-[#b15043] hover:bg-[#b15043]/5"
      >
        <Plus className="h-3 w-3" />
        new design doc
      </Link>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            no designs yet. create your first to compare against the GDocs
            manual-paste flow.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} className="hover:border-[#cb7858] transition-colors">
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <Link
                  href={`/designs/${d.slug}`}
                  className="flex-1 min-w-0 flex items-center gap-3"
                >
                  <FileText className="h-4 w-4 text-[#5872cb] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[#273248] truncate">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.template} · updated {formatDate(d.updatedAt)}
                      {d.ownerEmail && <span> · {d.ownerEmail}</span>}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/api/designs/${d.slug}/pdf`}
                  target="_blank"
                  className="text-xs text-[#b15043] hover:underline shrink-0"
                >
                  view PDF
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
