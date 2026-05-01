/**
 * Admin page: domain blocklist management.
 *
 * Table of blocked domains with toggle, edit, and add controls.
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { getAllBlockedDomains } from "@/lib/queries/admin";
import DomainBlocklistManager from "./domain-manager";

export const dynamic = "force-dynamic";

export default async function AdminDomainsPage() {
  await requireAdmin();
  const domains = await getAllBlockedDomains();

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        domain blocklist
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        consumer and freemail domains that cannot be used for organisation
        creation. toggling a domain off keeps the record but allows signups.
      </p>

      <DomainBlocklistManager initialDomains={domains} />
    </main>
  );
}
