import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";
import { sql } from "@/lib/db";
import OnboardingWizard from "./wizard";

export const metadata = { title: "welcome — creaseworks" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=/onboarding");

  // If they already finished onboarding, send them to the sampler
  const { rows } = await sql.query(
    `SELECT onboarding_completed FROM users WHERE id = $1`,
    [session.userId],
  );
  if (rows[0]?.onboarding_completed) redirect("/sampler");

  return (
    <main className="min-h-screen flex items-center justify-center bg-champagne/20 px-4 py-12">
      <OnboardingWizard />
    </main>
  );
}
