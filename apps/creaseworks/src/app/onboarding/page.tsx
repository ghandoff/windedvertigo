import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";
import { sql } from "@/lib/db";
import OnboardingWizard from "./wizard";

export const metadata = { title: "welcome — creaseworks" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; context?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=/onboarding");

  const params = await searchParams;
  const isEditMode = params.edit === "true";
  const editContextName = params.context ?? null;

  // If they already finished onboarding AND aren't in edit mode, redirect
  const { rows } = await sql.query(
    `SELECT onboarding_completed, play_preferences, play_contexts, active_context_name
       FROM users WHERE id = $1`,
    [session.userId],
  );

  const user = rows[0];
  if (user?.onboarding_completed && !isEditMode) redirect("/sampler");

  // In edit mode, load the context being edited (or active context, or defaults)
  let initialValues: {
    ageGroups: string[];
    contexts: string[];
    energy: string;
    contextName: string;
  } | null = null;

  if (isEditMode && user) {
    const allContexts = (user.play_contexts ?? []) as Array<Record<string, unknown>>;
    const target = editContextName
      ? allContexts.find((c) => c.name === editContextName)
      : allContexts.find((c) => c.name === user.active_context_name) ?? allContexts[0];

    if (target) {
      initialValues = {
        ageGroups: (target.age_groups as string[]) ?? [],
        contexts: (target.contexts as string[]) ?? [],
        energy: (target.energy as string) ?? "any",
        contextName: (target.name as string) ?? "default",
      };
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-champagne/20 px-4 py-12">
      <OnboardingWizard
        editMode={isEditMode}
        initialValues={initialValues}
      />
    </main>
  );
}
