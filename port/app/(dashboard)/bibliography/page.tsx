import { PageHeader } from "@/app/components/page-header";
import { getBibliographyRows } from "@/lib/supabase/bibliography";
import { BibliographyTable } from "./components/bibliography-table";

export const dynamic = "force-dynamic";

export default async function BibliographyPage() {
  const rows = await getBibliographyRows().catch(() => []);

  const assets = Array.from(new Set(rows.flatMap((r) => r.usedIn ?? []))).sort();
  const topics = Array.from(new Set(rows.map((r) => r.topic).filter((t): t is string => !!t))).sort();
  const untagged = rows.filter((r) => (r.usedIn ?? []).length === 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="bibliography"
        description="the collective's annotated bibliography · citations and where we've used them"
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">citations</p>
          <p className="text-xl font-semibold tabular-nums">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">assets (used in)</p>
          <p className="text-xl font-semibold tabular-nums">{assets.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">unassigned</p>
          <p className="text-xl font-semibold tabular-nums">{untagged}</p>
        </div>
      </div>

      <BibliographyTable rows={rows} assets={assets} topics={topics} />
    </div>
  );
}
