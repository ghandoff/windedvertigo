/**
 * /team — redirects to /profile?tab=team.
 *
 * Preserves query params (verify, domain, reason) for the domain
 * verification callback flow.
 */

import { redirect } from "next/navigation";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams({ tab: "team" });
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  redirect(`/profile?${qs.toString()}`);
}
