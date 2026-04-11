import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import { getOrCreateTree, getTreePersons } from "@/lib/db/queries";
import Link from "next/link";
import { RecordSearchForm } from "./record-search-form";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    givenName?: string;
    surname?: string;
    birthYear?: string;
    deathYear?: string;
    place?: string;
    recordType?: string;
    personId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const persons = await getTreePersons(tree.id);
  const params = await searchParams;

  // if personId is provided, pre-fill search from person data
  let prefill: { givenName?: string; surname?: string; birthYear?: string; deathYear?: string } = {};
  if (params.personId) {
    const person = persons.find((p) => p.id === params.personId);
    if (person) {
      const primary = person.names.find((n) => n.is_primary) ?? person.names[0];
      prefill.givenName = primary?.given_names ?? "";
      prefill.surname = primary?.surname ?? "";

      const birth = person.events.find((e) => e.event_type === "birth");
      const death = person.events.find((e) => e.event_type === "death");
      if (birth?.date && typeof birth.date === "object" && "date" in birth.date) {
        prefill.birthYear = birth.date.date.slice(0, 4);
      }
      if (death?.date && typeof death.date === "object" && "date" in death.date) {
        prefill.deathYear = death.date.date.slice(0, 4);
      }
    }
  }

  // merge URL params with prefill
  const searchFields = {
    givenName: params.givenName ?? prefill.givenName ?? "",
    surname: params.surname ?? prefill.surname ?? "",
    birthYear: params.birthYear ?? prefill.birthYear ?? "",
    deathYear: params.deathYear ?? prefill.deathYear ?? "",
    place: params.place ?? "",
    recordType: params.recordType ?? "",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← back to tree
          </Link>
          <span className="text-border hidden sm:inline">|</span>
          <h1 className="text-sm font-semibold text-foreground">record search</h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">search historical records</h2>
          <p className="text-sm text-muted-foreground mt-1">
            search FamilySearch records and Library of Congress newspaper archives for birth certificates,
            death records, marriage records, census data, and newspaper mentions.
          </p>
        </div>

        <RecordSearchForm
          defaults={searchFields}
          persons={persons.map((p) => {
            const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
            return {
              id: p.id,
              displayName: primary?.display ?? [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ?? "unnamed",
            };
          })}
          treeId={tree.id as string}
          preselectedPersonId={params.personId}
        />
      </div>
    </div>
  );
}
