import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";
import { sql } from "@/lib/db";
import { getConfigGroup, parseMetadata } from "@/lib/queries/app-config";
import OnboardingWizard from "./wizard";

export const metadata = { title: "welcome" };

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

  // For first-time users, check if they arrived via invite (have entitlements)
  let invitePackNames: string[] = [];
  if (!isEditMode && !user?.onboarding_completed) {
    const packRows = await sql.query(
      `SELECT DISTINCT pc.title
         FROM entitlements e
         JOIN packs_cache pc ON pc.id = e.pack_cache_id
        WHERE e.user_id = $1
          AND e.revoked_at IS NULL
          AND (e.expires_at IS NULL OR e.expires_at > NOW())
        ORDER BY pc.title`,
      [session.userId],
    );
    invitePackNames = packRows.rows.map((r: { title: string }) => r.title);
  }

  // Fetch CMS config for all onboarding option groups in parallel
  const [tierConfig, ageConfig, ctxConfig, energyConfig] = await Promise.all([
    getConfigGroup("ui-tiers"),
    getConfigGroup("onboarding").then((items) => items.filter((i) => i.key === "age-groups")),
    getConfigGroup("onboarding").then((items) => items.filter((i) => i.key === "contexts")),
    getConfigGroup("onboarding").then((items) => items.filter((i) => i.key === "energy-levels")),
  ]);

  const cmsOptions = {
    tiers: tierConfig.length > 0
      ? tierConfig.map((i) => { const m = parseMetadata<{ value: string; icon: string; desc: string }>(i); return { value: m.value, label: i.name, sub: m.desc, icon: m.icon }; })
      : undefined,
    ages: ageConfig.length > 0
      ? ageConfig.map((i) => { const m = parseMetadata<{ value: string; sub: string }>(i); return { value: m.value, label: i.name, sub: m.sub }; })
      : undefined,
    contexts: ctxConfig.length > 0
      ? ctxConfig.map((i) => { const m = parseMetadata<{ value: string; icon: string }>(i); return { value: m.value, label: i.name, icon: m.icon }; })
      : undefined,
    energy: energyConfig.length > 0
      ? energyConfig.map((i) => { const m = parseMetadata<{ value: string; sub: string; icon: string }>(i); return { value: m.value, label: i.name, sub: m.sub, icon: m.icon }; })
      : undefined,
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream/20 px-4 py-12">
      <OnboardingWizard
        editMode={isEditMode}
        initialValues={initialValues}
        invitePackNames={invitePackNames}
        cmsOptions={cmsOptions}
      />
    </main>
  );
}
