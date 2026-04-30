/**
 * /admin/booking/connect?admin=<token>
 *
 * One-time host onboarding UI. Lists all hosts and shows their connection
 * status (connected / never / expired). Clicking "connect" navigates to
 * /api/booking/oauth/google/start which redirects to Google's consent screen.
 *
 * Single-user admin surface. Gated by BOOKING_ADMIN_TOKEN query param —
 * matches the same token used by the OAuth start route.
 */

import { selectOne, select } from "@/lib/booking/supabase";
import type { Host, OauthToken } from "@/lib/booking/supabase";

// Force dynamic — admin token check must run per-request
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    admin?: string;
    status?: "connected" | "denied" | "error" | "no_refresh_token";
    host?: string;
  }>;
}

interface HostStatus {
  host: Host;
  connected: boolean;
  googleEmail: string | null;
  scope: string | null;
  updatedAt: string | null;
}

function checkAdminToken(token: string | undefined): boolean {
  const expected = process.env.BOOKING_ADMIN_TOKEN;
  if (!expected || !token) return false;
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function getHostStatuses(): Promise<HostStatus[]> {
  const hosts = await select<Host>("hosts", "active=eq.true&order=display_name.asc");
  const results: HostStatus[] = [];
  for (const host of hosts) {
    const tok = await selectOne<OauthToken>("oauth_tokens", { host_id: `eq.${host.id}` });
    results.push({
      host,
      connected: !!tok?.refresh_token_ct,
      googleEmail: tok?.google_account_email ?? null,
      scope: tok?.scope ?? null,
      updatedAt: tok?.updated_at ?? null,
    });
  }
  return results;
}

export default async function AdminConnectPage({ searchParams }: Props) {
  const params = await searchParams;

  if (!checkAdminToken(params.admin)) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, textTransform: "lowercase", marginBottom: 12 }}>
            unauthorized
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
            this page requires a valid admin token. visit{" "}
            <code style={codeStyle}>/admin/booking/connect?admin=YOUR_TOKEN</code>.
          </p>
        </div>
      </main>
    );
  }

  let statuses: HostStatus[];
  try {
    statuses = await getHostStatuses();
  } catch (e) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, textTransform: "lowercase", marginBottom: 12 }}>
            error loading hosts
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
            {String(e instanceof Error ? e.message : e)}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 16 }}>
            verify SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, the migration has been applied,
            and at least one row exists in the <code style={codeStyle}>hosts</code> table.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, textTransform: "lowercase", marginBottom: 8 }}>
          connect your calendar
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 28 }}>
          one-time setup. each host clicks &ldquo;connect&rdquo; below and signs in with their
          google account. this lets the booking system see free/busy on your primary calendar
          and create events when someone books a playdate. you can disconnect anytime from your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#cb7858", textDecoration: "underline" }}
          >
            google account permissions
          </a>
          .
        </p>

        {params.status && <StatusBanner status={params.status} />}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {statuses.map((s) => (
            <HostRow key={s.host.id} status={s} adminToken={params.admin!} />
          ))}
        </div>

        {statuses.length === 0 && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 24, textAlign: "center" }}>
            no active hosts found. seed the hosts table first via{" "}
            <code style={codeStyle}>npm run booking:seed-hosts</code>.
          </p>
        )}
      </div>
    </main>
  );
}

type StatusValue = "connected" | "denied" | "error" | "no_refresh_token";

function StatusBanner({ status }: { status: StatusValue }) {
  const messages: Record<string, { tone: "ok" | "warn" | "err"; text: string }> = {
    connected: { tone: "ok", text: "connected — your calendar is now linked." },
    denied: { tone: "warn", text: "you cancelled the consent flow. try again when you're ready." },
    no_refresh_token: {
      tone: "err",
      text: "google didn't issue a refresh token. revoke the existing grant at myaccount.google.com/permissions, then click connect again.",
    },
    error: { tone: "err", text: "something went wrong on the callback. check the worker logs." },
  };
  const m = messages[status];
  if (!m) return null;
  const colors = {
    ok: { bg: "rgba(42, 157, 80, 0.15)", border: "#2a9d50", fg: "#9ce8b3" },
    warn: { bg: "rgba(203, 120, 88, 0.15)", border: "#cb7858", fg: "#ffebd2" },
    err: { bg: "rgba(177, 80, 67, 0.18)", border: "#b15043", fg: "#ffb3a8" },
  }[m.tone];
  return (
    <div
      style={{
        padding: "12px 16px",
        marginBottom: 20,
        borderRadius: 6,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.fg,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {m.text}
    </div>
  );
}

function HostRow({ status, adminToken }: { status: HostStatus; adminToken: string }) {
  const connectUrl = `/api/booking/oauth/google/start?host=${encodeURIComponent(
    status.host.slug,
  )}&admin=${encodeURIComponent(adminToken)}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", textTransform: "lowercase" }}>
          {status.host.display_name}
          <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 12 }}>
            {status.host.slug}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
          {status.connected ? (
            <>
              <span style={{ color: "#9ce8b3" }}>● connected</span>
              {" · "}
              {status.googleEmail || status.host.email}
              {status.updatedAt && (
                <>
                  {" · updated "}
                  {new Date(status.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </>
              )}
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.5)" }}>not connected</span>
          )}
        </div>
      </div>
      <a
        href={connectUrl}
        style={{
          padding: "8px 16px",
          background: status.connected ? "transparent" : "#b15043",
          color: status.connected ? "#cb7858" : "#ffffff",
          border: status.connected ? "1px solid #cb7858" : "none",
          borderRadius: 4,
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 600,
          textTransform: "lowercase",
          whiteSpace: "nowrap",
        }}
      >
        {status.connected ? "reconnect" : "connect"}
      </a>
    </div>
  );
}

// ── inline styles (no Tailwind in this admin surface) ────────────

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#273248",
  color: "#ffffff",
  fontFamily: "Inter, system-ui, sans-serif",
  padding: "60px 24px",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "32px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
};

const codeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
};
