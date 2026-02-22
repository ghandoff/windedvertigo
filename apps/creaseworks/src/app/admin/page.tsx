/**
 * Admin landing page — navigation hub for all admin sections.
 *
 * Links to domains, admins, entitlements, sync, and analytics.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import Link from "next/link";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "entitlements",
    href: "/admin/entitlements",
    description: "grant and revoke pack access for organisations",
    icon: "🔑",
  },
  {
    title: "domains",
    href: "/admin/domains",
    description: "manage the email domain blocklist",
    icon: "🌐",
  },
  {
    title: "admins",
    href: "/admin/admins",
    description: "manage the admin allowlist",
    icon: "👤",
  },
  {
    title: "sync",
    href: "/admin/sync",
    description: "trigger a manual Notion sync",
    icon: "🔄",
  },
  {
    title: "analytics",
    href: "/analytics",
    description: "view run analytics and usage dashboard",
    icon: "📊",
  },
  {
    title: "team",
    href: "/team",
    description: "manage organisation members and roles",
    icon: "👥",
  },
];

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">admin</h1>
      <p className="text-sm text-cadet/50 mb-10">
        signed in as {session.email}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-cadet/10 bg-champagne/30 p-6 transition-all hover:border-cadet/20 hover:bg-champagne/50 group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" role="img" aria-hidden>
                {s.icon}
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight group-hover:text-redwood transition-colors">
                  {s.title}
                </h2>
                <p className="text-xs text-cadet/50 mt-1">{s.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
