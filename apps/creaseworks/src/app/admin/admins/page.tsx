/**
 * Admin page: admin allowlist management.
 *
 * Table of current admins with add/remove controls.
 * Cannot remove yourself if you're the only admin.
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { getAllAdmins } from "@/lib/queries/admin";
import AdminListManager from "./admin-manager";

export const dynamic = "force-dynamic";

export default async function AdminAdminsPage() {
  const session = await requireAdmin();
  const admins = await getAllAdmins();

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        manage admins
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        users on this list can access all admin pages. add a user by their
        email address — they must have signed in at least once.
      </p>

      <AdminListManager initialAdmins={admins} currentUserId={session.userId} />
    </main>
  );
}
