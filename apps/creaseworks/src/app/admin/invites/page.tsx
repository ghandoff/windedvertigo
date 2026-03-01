/**
 * /admin/invites — manage complimentary access invites.
 *
 * Admins can grant free explorer or practitioner access to specific
 * email addresses. When the recipient signs in with that email,
 * they get auto-entitled.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { listAllInvites } from "@/lib/queries/invites";
import Link from "next/link";
import InviteForm from "./invite-form";
import InviteTable from "./invite-table";

export const metadata = { title: "invites — admin" };
export const dynamic = "force-dynamic";

export default async function AdminInvitesPage() {
  await requireAdmin();
  const invites = await listAllInvites();

  const pending = invites.filter((i) => !i.accepted_at);
  const accepted = invites.filter((i) => !!i.accepted_at);

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <header className="mb-10">
        <Link
          href="/admin"
          className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block"
        >
          &larr; admin
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          complimentary invites
        </h1>
        <p className="text-cadet/60 max-w-lg">
          grant free access to colleagues, friends, schools, or pilot partners
          by email address. they&apos;ll be auto-entitled when they sign in.
        </p>
      </header>

      {/* create invite form */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          send an invite
        </h2>
        <InviteForm />
      </section>

      {/* pending invites */}
      {pending.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold tracking-tight mb-1">
            pending
          </h2>
          <p className="text-sm text-cadet/40 mb-4">
            {pending.length} invite{pending.length !== 1 ? "s" : ""} waiting to
            be claimed
          </p>
          <InviteTable invites={pending} showRevoke />
        </section>
      )}

      {/* accepted invites */}
      {accepted.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-1">
            accepted
          </h2>
          <p className="text-sm text-cadet/40 mb-4">
            {accepted.length} invite{accepted.length !== 1 ? "s" : ""} claimed
          </p>
          <InviteTable invites={accepted} />
        </section>
      )}

      {invites.length === 0 && (
        <p className="text-cadet/40 text-center py-12">
          no invites yet — use the form above to grant someone free access.
        </p>
      )}
    </main>
  );
}
