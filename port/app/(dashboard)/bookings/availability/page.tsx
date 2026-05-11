/**
 * /bookings/availability — per-host working_hours and one-off overrides editor.
 *
 * Each row in the working_hours JSONB is a list of [start, end] tuples per
 * weekday key. The schema doesn't enforce per-host visibility here; we surface
 * all hosts and let any port-authed user edit (matches port's existing trust
 * model — every team member can see everything).
 */

import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import {
  listHosts,
  listOverridesForHost,
} from "@/lib/booking/queries";
import { HostAvailabilityCard } from "../components/host-availability-card";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const hosts = await listHosts({ activeOnly: false });

  // Fetch overrides for every host in parallel
  const overridesByHost = await Promise.all(
    hosts.map((h) => listOverridesForHost(h.id).then((rows) => [h.id, rows] as const)),
  );
  const overrides = new Map(overridesByHost);

  return (
    <div>
      <PageHeader
        title="availability"
        description="set each host's weekly working hours and add one-off blocks (vacations, focus days). booking slots respect these."
      >
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← bookings
        </Link>
      </PageHeader>

      <div className="space-y-6">
        {hosts.map((host) => (
          <HostAvailabilityCard
            key={host.id}
            host={host}
            overrides={overrides.get(host.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
