import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateTree, getTreePersons, getTreeRelationships, getTreePlaces, getAccessibleTrees, getTreeRole, getRecentActivity, getHintCounts } from "@/lib/db/queries";
import { buildTreeNodes } from "@/lib/db/queries";
import { AddPersonForm } from "./components/add-person-form";
import { AddRelationshipForm } from "./components/add-relationship-form";
import { FamilySearchSearch } from "./components/familysearch-search";
import { GedcomExport } from "./components/gedcom-export";
import { GedcomImport } from "./components/gedcom-import";
import { ChartSwitcher } from "./components/chart-switcher";
import { PersonList } from "./components/person-list";
import { ActivityFeed } from "./components/activity-feed";
import { SidebarWrapper } from "./components/sidebar-wrapper";
import { MobileNav } from "./components/mobile-nav";
import { SearchButton } from "./components/search-button";
import { OnboardingWizard } from "./components/onboarding-wizard";
import { GenerateHintsButton } from "./components/generate-hints-button";
import { HintsModalTrigger } from "./components/hints-modal";
import { HintsBanner } from "./components/hints-banner";
import { TreeSwitcher } from "./components/tree-switcher";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tree?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const params = await searchParams;

  // if a tree id is specified, check access; otherwise get/create user's own tree
  let tree;
  let role;
  if (params.tree) {
    const accessibleTrees = await getAccessibleTrees(session.user.email);
    const found = accessibleTrees.find((t) => t.id === params.tree);
    if (!found) redirect("/");
    tree = found;
    role = found.role as string;
  } else {
    tree = await getOrCreateTree(session.user.email);
    role = "owner";
  }

  const canEdit = role === "owner" || role === "editor";

  const [persons, relationships, places, recentActivity, hintCounts] = await Promise.all([
    getTreePersons(tree.id),
    getTreeRelationships(tree.id),
    getTreePlaces(tree.id),
    getRecentActivity(tree.id, 10),
    getHintCounts(tree.id),
  ]);
  const treeNodes = buildTreeNodes(persons, relationships);
  const allEvents = persons.flatMap((p) => p.events);

  // get all accessible trees for switcher
  const accessibleTrees = await getAccessibleTrees(session.user.email);
  const sharedTrees = accessibleTrees.filter((t) => t.owner_email !== session.user!.email);

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <header className="border-b border-border px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 pl-12 md:pl-0">
            <h1 className="text-lg font-semibold text-foreground">w.v ancestry</h1>
            {role !== "owner" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {sharedTrees.length > 0 && (
              <TreeSwitcher
                currentTreeId={tree.id as string}
                currentTreeName={tree.name as string}
                sharedTrees={sharedTrees as any}
              />
            )}
            <HintsModalTrigger pendingCount={hintCounts.pending} />
            <SearchButton treeId={tree.id as string} />
            <span className="text-sm text-muted-foreground">{tree.name}</span>
            <Link
              href="/settings"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="tree settings"
              aria-label="tree settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* hints notification banner */}
      <HintsBanner pendingCount={hintCounts.pending} />

      <div className={`flex ${hintCounts.pending > 0 ? "h-[calc(100vh-93px)] md:h-[calc(100vh-101px)]" : "h-[calc(100vh-57px)] md:h-[calc(100vh-65px)]"}`}>
        {/* sidebar — desktop aside + mobile drawer */}
        <SidebarWrapper>
          {canEdit && persons.length > 0 && (
            <GenerateHintsButton treeId={tree.id as string} pendingCount={hintCounts.pending ?? 0} />
          )}

          <PersonList persons={persons} />

          {canEdit && <AddPersonForm />}
          {canEdit && persons.length >= 2 && (
            <AddRelationshipForm persons={persons} />
          )}
          {canEdit && <GedcomImport />}
          <GedcomExport />
          <FamilySearchSearch />

          {/* tools nav */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              tools
            </h3>
            <Link
              href="/duplicates"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              find duplicates
            </Link>
            <Link
              href="/tasks"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              research tasks
            </Link>
            <Link
              href="/reports"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              reports
            </Link>
            <Link
              href="/records"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              record search
            </Link>
            <Link
              href="/places"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              places & migration
            </Link>
            <Link
              href="/census"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              census timeline
            </Link>
          </div>

          {recentActivity.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                recent activity
              </h3>
              <ActivityFeed entries={recentActivity} compact />
            </div>
          )}
        </SidebarWrapper>

        {/* chart area */}
        <main className="flex-1 relative pb-16 md:pb-0" data-print-root>
          {treeNodes.length === 0 ? (
            <OnboardingWizard />
          ) : (
            <ChartSwitcher nodes={treeNodes} events={allEvents} places={places} />
          )}
        </main>
      </div>

      {/* mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
