import { auth } from "@windedvertigo/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getPerson, getOrCreateTree, getPersonRelatives, getPersonSources, getTreeRole, getHintsForPerson, getComments } from "@/lib/db/queries";
import { formatFuzzyDate } from "@/lib/db";
import { isLikelyLiving, redactPerson } from "@/lib/privacy";
import type { ViewerRole } from "@/lib/privacy";
import { EditPersonForm } from "./edit-person-form";
import { BiographyForm } from "./biography-form";
import { RelativeCard } from "./relative-card";
import { SourcesSection } from "./add-source-form";
import { DeletePersonButton } from "./delete-person-button";
import { FindHintsButton } from "./find-hints-button";
import { PrivacyBanner } from "../../components/privacy-banner";
import { HintCard } from "../../hints/hint-card";
import { CommentThread } from "../../components/comment-thread";
import { ResearchAssistant } from "./research-assistant";

const SEX_ICONS: Record<string, string> = {
  M: "♂",
  F: "♀",
  X: "⚧",
  U: "·",
};

const EVENT_ICONS: Record<string, string> = {
  birth: "🌱",
  death: "✝",
  marriage: "💍",
  divorce: "⚖",
  immigration: "🚢",
  emigration: "✈",
  naturalization: "📜",
  census: "📋",
  residence: "🏠",
  military: "⚔",
  education: "📚",
  occupation: "💼",
  graduation: "🎓",
  retirement: "🏖",
  burial: "⚱",
  baptism: "💧",
  confirmation: "✋",
  ordination: "📿",
  other: "·",
};

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const person = await getPerson(id);

  if (!person || person.tree_id !== tree.id) notFound();

  const role = await getTreeRole(tree.id, session.user.email) as ViewerRole;
  const isRedacted = isLikelyLiving(person) && role !== "owner" && role !== "editor";
  const viewPerson = redactPerson(person, role);

  const [relatives, personSources, pendingHints, comments] = await Promise.all([
    getPersonRelatives(id, tree.id),
    getPersonSources(id),
    getHintsForPerson(id, "pending"),
    getComments("person", id),
  ]);

  const primaryName = viewPerson.names.find((n) => n.is_primary) ?? viewPerson.names[0];
  const displayName =
    primaryName?.display ??
    [primaryName?.given_names, primaryName?.surname].filter(Boolean).join(" ") ??
    "unnamed";
  const alternateNames = viewPerson.names.filter((n) => !n.is_primary);

  const birth = viewPerson.events.find((e) => e.event_type === "birth");
  const death = viewPerson.events.find((e) => e.event_type === "death");
  const icon = SEX_ICONS[viewPerson.sex ?? "U"] ?? "·";

  const lifeDates = isRedacted
    ? "living"
    : [
        birth?.date ? formatFuzzyDate(birth.date) : "?",
        viewPerson.is_living ? "living" : death?.date ? formatFuzzyDate(death.date) : "?",
      ].join(" – ");

  return (
    <div className="min-h-screen bg-background">
      {/* header bar */}
      <header className="border-b border-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← back to tree
          </Link>
          <span className="text-border hidden sm:inline">|</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">{tree.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 md:px-6 py-5 md:py-8 space-y-6 md:space-y-8 pb-20 md:pb-8">
        {isRedacted && <PrivacyBanner />}

        {/* person header */}
        <div className="flex items-start gap-3 md:gap-5">
          {viewPerson.thumbnail_url ? (
            <img
              src={viewPerson.thumbnail_url!}
              alt=""
              className="h-14 w-14 md:h-20 md:w-20 rounded-full object-cover shrink-0 border-2 border-border"
            />
          ) : (
            <span className="flex h-14 w-14 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl md:text-3xl font-medium text-primary border-2 border-border">
              {icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
            {alternateNames.length > 0 && (
              <div className="mt-0.5 text-sm text-muted-foreground">
                also known as:{" "}
                {alternateNames
                  .map(
                    (n) =>
                      n.display ??
                      [n.given_names, n.surname].filter(Boolean).join(" ")
                  )
                  .join(", ")}
              </div>
            )}
            <div className="mt-1 text-sm text-muted-foreground">{lifeDates}</div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <EditPersonForm person={person} />
              <FindHintsButton personId={person.id} personName={displayName} />
              <DeletePersonButton personId={person.id} personName={displayName} />
            </div>
          </div>
        </div>

        {/* facts / events */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            events & facts
          </h2>
          {viewPerson.events.length === 0 ? (
            <p className="text-xs text-muted-foreground">no events recorded</p>
          ) : (
            <ul className="space-y-2">
              {viewPerson.events.map((evt) => (
                <li key={evt.id} className="flex items-start gap-2.5 text-sm">
                  <span className="shrink-0 w-5 text-center mt-0.5" title={evt.event_type}>
                    {EVENT_ICONS[evt.event_type] ?? "·"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{evt.event_type}</span>
                    {evt.date && (
                      <span className="text-muted-foreground ml-1.5">
                        {formatFuzzyDate(evt.date)}
                      </span>
                    )}
                    {evt.description && (
                      <span className="text-muted-foreground ml-1.5">
                        — {evt.description}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* family */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            family
          </h2>

          {relatives.parents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                parents
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relatives.parents.map((r) => (
                  <RelativeCard key={r.id} relative={r} personId={id} />
                ))}
              </div>
            </div>
          )}

          {relatives.spouses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                spouses & partners
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relatives.spouses.map((r) => (
                  <RelativeCard key={r.id} relative={r} personId={id} />
                ))}
              </div>
            </div>
          )}

          {relatives.children.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                children
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relatives.children.map((r) => (
                  <RelativeCard key={r.id} relative={r} personId={id} />
                ))}
              </div>
            </div>
          )}

          {relatives.siblings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                siblings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relatives.siblings.map((r) => (
                  <RelativeCard key={r.id} relative={r} personId={id} />
                ))}
              </div>
            </div>
          )}

          {relatives.parents.length === 0 &&
            relatives.spouses.length === 0 &&
            relatives.children.length === 0 &&
            relatives.siblings.length === 0 && (
              <p className="text-xs text-muted-foreground">
                no family relationships recorded — add relationships from the main tree view
              </p>
            )}
        </section>

        {/* biography */}
        {!isRedacted && (
          <section>
            <BiographyForm personId={person.id} initialNotes={person.notes} />
          </section>
        )}

        {/* suggested matches */}
        {pendingHints.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                suggested matches
              </h2>
              <Link
                href="/hints"
                className="text-xs text-primary hover:underline"
              >
                view all hints
              </Link>
            </div>
            <div className="space-y-3">
              {pendingHints.map((hint) => (
                <HintCard
                  key={hint.id}
                  hint={hint}
                  personDisplayName={displayName}
                  personBirthYear={
                    birth?.date && typeof birth.date === "object" && "date" in birth.date
                      ? birth.date.date.slice(0, 4)
                      : null
                  }
                  personBirthPlace={birth?.description ?? null}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        {/* record search shortcut */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            historical records
          </h2>
          <p className="text-xs text-muted-foreground">
            search FamilySearch records and Library of Congress newspaper archives for documents mentioning this person.
          </p>
          <Link
            href={`/records?personId=${person.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            search records for {displayName}
          </Link>
        </section>

        {/* AI research assistant */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            AI research assistant
          </h2>
          <p className="text-xs text-muted-foreground">
            use AI to analyze this person&apos;s profile and suggest specific research directions.
          </p>
          <ResearchAssistant personId={person.id} personName={displayName} />
        </section>

        {/* discussion */}
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            discussion {comments.length > 0 && <span className="text-muted-foreground font-normal">({comments.length})</span>}
          </h2>
          <CommentThread
            comments={comments}
            targetType="person"
            targetId={person.id}
            currentEmail={session.user.email!}
          />
        </section>

        {/* sources */}
        <SourcesSection
          personId={person.id}
          events={person.events}
          sources={personSources as any}
        />
      </div>
    </div>
  );
}
