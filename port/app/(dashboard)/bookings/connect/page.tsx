/**
 * /bookings/connect — calendar connection status, gated by port auth.
 *
 * Mirrors the site's /admin/booking/connect page but without the shared admin
 * token in the URL. Port auth (the dashboard layout's `auth()` check) is the
 * gate. The "connect" buttons still link out to the site's OAuth start route,
 * which DOES require the admin token — so we attach it from server-side env.
 */

import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { listConnectionStatuses, listHosts } from "@/lib/booking/queries";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://windedvertigo.com";

interface Props {
  searchParams: Promise<{ status?: string; host?: string }>;
}

const STATUS_BANNERS: Record<string, { tone: "ok" | "warn" | "err"; text: string }> = {
  connected: { tone: "ok", text: "connected — calendar linked." },
  denied: { tone: "warn", text: "consent flow cancelled — try again when ready." },
  no_refresh_token: {
    tone: "err",
    text:
      "google didn't issue a refresh token. revoke the existing grant at myaccount.google.com/permissions, then click connect again.",
  },
  error: { tone: "err", text: "something went wrong on the callback. check worker logs." },
};

export default async function ConnectPage({ searchParams }: Props) {
  const params = await searchParams;
  const adminToken = process.env.BOOKING_ADMIN_TOKEN;

  const [hosts, statuses] = await Promise.all([
    listHosts({ activeOnly: false }),
    listConnectionStatuses(),
  ]);
  const statusByHost = new Map(statuses.map((s) => [s.hostId, s]));

  const banner = params.status ? STATUS_BANNERS[params.status] : null;

  return (
    <div>
      <PageHeader
        title="calendar connections"
        description="each host's google calendar oauth status. clicking 'connect' redirects to the site's oauth start route."
      >
        <Link
          href="/bookings"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← bookings
        </Link>
      </PageHeader>

      {banner && (
        <div
          className={`mb-4 p-3 rounded text-sm border ${
            banner.tone === "ok"
              ? "bg-green-500/10 border-green-500/30 text-green-600"
              : banner.tone === "warn"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                : "bg-red-500/10 border-red-500/30 text-red-600"
          }`}
        >
          {banner.text}
        </div>
      )}

      {!adminToken && (
        <div className="mb-4 p-3 rounded text-sm border bg-amber-500/10 border-amber-500/30 text-amber-600">
          BOOKING_ADMIN_TOKEN not set on this worker — connect buttons will fail.
          add it via <code className="font-mono">wrangler secret put BOOKING_ADMIN_TOKEN</code>{" "}
          (use the same value as the site).
        </div>
      )}

      <div className="space-y-2">
        {hosts.map((host) => {
          const s = statusByHost.get(host.id);
          const connectUrl = adminToken
            ? `${SITE_ORIGIN}/api/booking/oauth/google/start?host=${encodeURIComponent(
                host.slug,
              )}&admin=${encodeURIComponent(adminToken)}`
            : "#";
          return (
            <div
              key={host.id}
              className="flex items-center justify-between gap-4 rounded-md border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {host.display_name}{" "}
                  <span className="text-xs text-muted-foreground font-normal">{host.email}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s?.connected ? (
                    <>
                      <Badge variant="outline" className="text-xs mr-2">
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
                        connected
                      </Badge>
                      {s.googleEmail}
                      {s.updatedAt && (
                        <span className="ml-2">
                          updated{" "}
                          {new Date(s.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      not connected
                    </Badge>
                  )}
                </div>
              </div>
              <a
                href={connectUrl}
                className={
                  s?.connected
                    ? "text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    : "rounded bg-foreground text-background px-3 py-1.5 text-xs"
                }
              >
                {s?.connected ? "reconnect" : "connect"}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
