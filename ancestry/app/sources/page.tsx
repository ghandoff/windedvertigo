import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateTree, getTreeSources, getSourceWithCitations } from "@/lib/db/queries";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  census: "census",
  vital_record: "vital record",
  church: "church record",
  military: "military record",
  newspaper: "newspaper",
  book: "book",
  online: "online source",
  photo: "photo / image",
  interview: "interview",
  other: "other",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  primary: "bg-green-100 text-green-800",
  secondary: "bg-blue-100 text-blue-800",
  questionable: "bg-yellow-100 text-yellow-800",
  unreliable: "bg-red-100 text-red-800",
};

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const sources = await getTreeSources(tree.id);

  const { source: selectedSourceId } = await searchParams;
  const selectedSource = selectedSourceId
    ? await getSourceWithCitations(selectedSourceId)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; back to tree
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm text-foreground font-medium">source library</span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <h1 className="text-xl font-bold text-foreground">sources</h1>

        {sources.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              no sources yet — add sources from a person&apos;s detail page
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* source list */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      title
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      author
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      type
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      citations
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s: any) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${selectedSourceId === s.id ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/sources?source=${s.id}`}
                          className="text-foreground hover:text-primary font-medium"
                        >
                          {s.title}
                        </Link>
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1.5 text-xs text-primary hover:underline"
                          >
                            link
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                        {s.author || "—"}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {s.source_type ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {SOURCE_TYPE_LABELS[s.source_type] ?? s.source_type}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground">
                        {s.citation_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* selected source detail */}
            {selectedSource && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {selectedSource.source.title}
                  </h2>
                  {selectedSource.source.author && (
                    <p className="text-sm text-muted-foreground">
                      by {selectedSource.source.author}
                    </p>
                  )}
                  {selectedSource.source.publisher && (
                    <p className="text-xs text-muted-foreground">
                      published by {selectedSource.source.publisher}
                    </p>
                  )}
                  {selectedSource.source.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {selectedSource.source.notes}
                    </p>
                  )}
                </div>

                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  citations ({selectedSource.citations.length})
                </h3>

                {selectedSource.citations.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    no citations linked to this source
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedSource.citations.map((cit: any) => (
                      <li
                        key={cit.id}
                        className="rounded-md border border-border/50 bg-background p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {cit.person_name && (
                            <Link
                              href={`/person/${cit.person_id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {cit.person_name}
                            </Link>
                          )}
                          {cit.event_type && (
                            <span className="text-muted-foreground">
                              {cit.event_type}
                            </span>
                          )}
                          {cit.confidence && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_COLORS[cit.confidence] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {cit.confidence}
                            </span>
                          )}
                          {cit.page && (
                            <span className="text-muted-foreground">
                              p. {cit.page}
                            </span>
                          )}
                        </div>
                        {cit.extract && (
                          <div className="text-muted-foreground italic">
                            &ldquo;{cit.extract}&rdquo;
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
