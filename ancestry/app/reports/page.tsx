import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateTree, getTreePersons } from "@/lib/db/queries";
import { ReportForm } from "./report-form";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const persons = await getTreePersons(tree.id as string);

  const personOptions = persons.map((p) => {
    const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
    const name = primary
      ? (primary.display ?? [primary.given_names, primary.surname].filter(Boolean).join(" ")) || "(unnamed)"
      : "(unnamed)";
    return { id: p.id, name };
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 md:px-6 py-3 md:py-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; back to tree
          </Link>
          <h1 className="text-lg font-semibold text-foreground">reports</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {persons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            no persons in your tree yet.{" "}
            <Link href="/" className="underline hover:text-foreground">
              add someone first
            </Link>
            .
          </p>
        ) : (
          <ReportForm persons={personOptions} />
        )}
      </main>
    </div>
  );
}
