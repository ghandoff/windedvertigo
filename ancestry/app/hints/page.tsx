import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getOrCreateTree,
  getHintsForTree,
  getHintCounts,
  getPerson,
} from "@/lib/db/queries";
import type { HintStatus } from "@/lib/types";
import { formatFuzzyDate } from "@/lib/db";
import { HintCard } from "./hint-card";
import { RefreshButton } from "./refresh-button";
import { ResetButton } from "./reset-button";
import { ClearRejectedButton } from "./clear-rejected-button";

const VALID_FILTERS = ["all", "pending", "accepted", "rejected"] as const;
type Filter = (typeof VALID_FILTERS)[number];

export default async function HintsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const params = await searchParams;

  const filter: Filter = VALID_FILTERS.includes(params.filter as Filter)
    ? (params.filter as Filter)
    : "all";

  const statusFilter: HintStatus | undefined =
    filter === "all" ? undefined : (filter as HintStatus);

  const [hints, counts] = await Promise.all([
    getHintsForTree(tree.id, statusFilter),
    getHintCounts(tree.id),
  ]);

  // build a lookup of person display names + birth info for the hint cards
  const personIds = [...new Set(hints.map((h) => h.person_id))];
  const personLookup = new Map<
    string,
    { displayName: string; birthYear: string | null; birthPlace: string | null }
  >();

  await Promise.all(
    personIds.map(async (pid) => {
      const person = await getPerson(pid);
      if (!person) return;
      const primaryName =
        person.names.find((n) => n.is_primary) ?? person.names[0];
      const displayName =
        primaryName?.display ??
        [primaryName?.given_names, primaryName?.surname]
          .filter(Boolean)
          .join(" ") ??
        "unnamed";
      const birth = person.events.find((e) => e.event_type === "birth");
      const birthYear = birth?.date
        ? typeof birth.date === "object" && "date" in birth.date
          ? birth.date.date.slice(0, 4)
          : null
        : null;
      const birthPlace = birth?.description ?? null;
      personLookup.set(pid, { displayName, birthYear, birthPlace });
    }),
  );

  const total = counts.pending + counts.accepted + counts.rejected;

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <header className="border-b border-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; back to tree
          </Link>
          <span className="text-border hidden sm:inline">|</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {tree.name}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        {/* page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              suggested matches
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {counts.pending} pending &middot; {counts.accepted} accepted
              &middot; {counts.rejected} rejected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ClearRejectedButton count={counts.rejected} />
            <ResetButton pendingCount={counts.pending} />
            <RefreshButton />
          </div>
        </div>

        {/* filter tabs */}
        <nav className="flex gap-1 border-b border-border">
          {VALID_FILTERS.map((f) => {
            const isActive = f === filter;
            const count =
              f === "all"
                ? total
                : counts[f as keyof typeof counts] ?? 0;
            return (
              <Link
                key={f}
                href={f === "all" ? "/hints" : `/hints?filter=${f}`}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
                {count > 0 && (
                  <span className="ml-1 text-muted-foreground">({count})</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* hint cards */}
        {hints.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "no hints yet — click refresh to scan for suggested matches"
                : `no ${filter} hints`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {hints.map((hint) => {
              const person = personLookup.get(hint.person_id);
              return (
                <HintCard
                  key={hint.id}
                  hint={hint}
                  personDisplayName={person?.displayName}
                  personBirthYear={person?.birthYear}
                  personBirthPlace={person?.birthPlace}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
