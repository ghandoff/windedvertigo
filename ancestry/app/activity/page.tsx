import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateTree, getRecentActivity } from "@/lib/db/queries";
import { ActivityFeed } from "../components/activity-feed";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const activity = await getRecentActivity(tree.id, 50);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← back to tree
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm text-muted-foreground">{tree.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        <h1 className="text-lg font-semibold text-foreground">activity log</h1>
        <ActivityFeed entries={activity} />
      </div>
    </div>
  );
}
