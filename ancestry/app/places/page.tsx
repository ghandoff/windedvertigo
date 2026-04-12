import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlaceMap } from "./place-map";

export default async function PlacesPage() {
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
          <h1 className="text-sm font-semibold text-foreground">place intelligence</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">places & migration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            visualize where your ancestors lived, worked, and moved. places are auto-geocoded
            using OpenStreetMap when coordinates are missing.
          </p>
        </div>

        <PlaceMap />
      </div>
    </div>
  );
}
