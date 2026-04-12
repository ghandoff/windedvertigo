import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DuplicateScanner } from "./duplicate-scanner";

export default async function DuplicatesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

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
          <h1 className="text-sm font-semibold text-foreground">duplicate detection</h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">find & merge duplicates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            scan your tree for persons who might be the same individual. review matches
            and merge duplicates to keep your tree clean.
          </p>
        </div>

        <DuplicateScanner />
      </div>
    </div>
  );
}
