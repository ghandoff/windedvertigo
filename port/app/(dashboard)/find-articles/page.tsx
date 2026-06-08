import Link from "next/link";
import { Library } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { getBibliographyRows } from "@/lib/supabase/bibliography";
import { ArticleSearchPanel } from "./components/article-search-panel";

export const dynamic = "force-dynamic";

export default async function FindArticlesPage() {
  const rows = await getBibliographyRows().catch(() => []);
  const assets = Array.from(new Set(rows.flatMap((r) => r.usedIn ?? []))).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="find articles"
        description="search the wider literature and add to the bibliography with one click"
      >
        <Link
          href="/bibliography"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Library className="h-3.5 w-3.5" />
          view library
        </Link>
      </PageHeader>

      <ArticleSearchPanel allAssets={assets} />
    </div>
  );
}
