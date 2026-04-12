import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateTree, getTreePersons } from "@/lib/db/queries";
import { CensusTimeline } from "./census-timeline";

export default async function CensusPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const persons = await getTreePersons(tree.id);

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
          <h1 className="text-sm font-semibold text-foreground">census timeline</h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">census coverage</h2>
          <p className="text-sm text-muted-foreground mt-1">
            track which US federal census records you have for each person.
            green = record found, yellow = person alive but no record, gray = not yet born or deceased.
          </p>
        </div>

        <CensusTimeline persons={persons} />
      </div>
    </div>
  );
}
