/**
 * Opsy email capture — scan inboxes for infrastructure vendor notifications
 * (docs/opsy/posture.md tier 5).
 *
 * Accounts (each presence-gated on its credentials):
 *   - garrett@windedvertigo.com — via the GOOGLE_SA_RFP_SCANNER service
 *     account (domain-wide delegation, same mechanism as the RFP scanner)
 *   - garrett's personal gmail — via the GMAIL_* OAuth refresh token; the
 *     actual address is resolved from the Gmail profile at scan time
 *
 * Mailboxes are treated read-only: the processed marker is the
 * opsy_email_captures row (message id in the gmail_thread_id column), the
 * proven conference-scanner dedupe pattern — no labels, no read-state changes.
 *
 * Every allowlisted email gets a capture row (even non-alerts, so it's never
 * re-triaged). Actionable critical/warning alerts open an incident and route
 * to slack.
 */

import {
  getMessageWithBody,
  getServiceAccountAccessToken,
  listMessages,
} from "@/lib/gmail";
import { triageOpsyEmail } from "@/lib/ai/opsy-email-triage";
import {
  getCapturedMessageIds,
  insertOpsyEmailCapture,
  insertOpsyIncident,
} from "@/lib/supabase/opsy";
import { notifyIncidentOpened } from "./alerts";

const WORKSPACE_SUBJECT = "garrett@windedvertigo.com";
const MAX_MESSAGES_PER_ACCOUNT = 15;

// known infrastructure senders; the triage model filters residual marketing
const SENDER_QUERY = [
  "supabase.io",
  "supabase.com",
  "cloudflare.com",
  "vercel.com",
  "github.com",
  "stripe.com",
  "resend.com",
  "neon.tech",
  "cloudplatform-noreply@google.com",
  "payments-noreply@google.com",
].join(" OR from:");

const GMAIL_QUERY = `from:${SENDER_QUERY} newer_than:2d`;

interface ScanAccount {
  /** gmail API userId for requests */
  userId: string;
  /** resolved address recorded in email_account */
  address: string;
  token: string;
}

async function resolveAccounts(): Promise<{ accounts: ScanAccount[]; unavailable: string[] }> {
  const accounts: ScanAccount[] = [];
  const unavailable: string[] = [];

  // Workspace account via SA domain-wide delegation. The wv-port worker
  // carries GOOGLE_SERVICE_ACCOUNT_JSON (used by gcal/gdocs); .env.example's
  // GOOGLE_SA_RFP_SCANNER takes precedence where present. If the SA's
  // delegation grant lacks the gmail scope, the token exchange fails and the
  // account is reported unavailable — presence-gated, never fatal.
  const saKey = process.env.GOOGLE_SA_RFP_SCANNER ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saKey) {
    try {
      const token = await getServiceAccountAccessToken(saKey, WORKSPACE_SUBJECT);
      accounts.push({ userId: WORKSPACE_SUBJECT, address: WORKSPACE_SUBJECT, token });
    } catch (err) {
      unavailable.push(`${WORKSPACE_SUBJECT}: ${err instanceof Error ? err.message : "token error"}`);
    }
  } else {
    unavailable.push(
      `${WORKSPACE_SUBJECT}: awaiting credential GOOGLE_SA_RFP_SCANNER or GOOGLE_SERVICE_ACCOUNT_JSON`,
    );
  }

  // Personal gmail via OAuth refresh token. The worker has GMAIL_REFRESH_TOKEN
  // but not GMAIL_CLIENT_ID/SECRET — refresh tokens only redeem against the
  // client that issued them, so try each candidate client pair on the worker
  // until one exchanges (a mismatch is a 4xx, harmless).
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const clientCandidates: Array<[string, string | undefined, string | undefined]> = [
    ["GMAIL_CLIENT_*", process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET],
    ["GOOGLE_CLIENT_*", process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET],
    ["GOOGLE_CALENDAR_CLIENT_*", process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET],
  ];
  if (refreshToken) {
    const failures: string[] = [];
    let resolved = false;
    for (const [label, clientId, clientSecret] of clientCandidates) {
      if (!clientId || !clientSecret) continue;
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });
        if (!tokenRes.ok) throw new Error(`HTTP ${tokenRes.status}`);
        const { access_token: token } = (await tokenRes.json()) as { access_token: string };
        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profile = res.ok ? ((await res.json()) as { emailAddress?: string }) : {};
        accounts.push({ userId: "me", address: profile.emailAddress ?? "personal-gmail", token });
        resolved = true;
        break;
      } catch (err) {
        failures.push(`${label}: ${err instanceof Error ? err.message : "token error"}`);
      }
    }
    if (!resolved) {
      unavailable.push(`personal gmail: no client pair redeems the refresh token (${failures.join("; ") || "no client pairs configured"})`);
    }
  } else {
    unavailable.push("personal gmail: awaiting credential GMAIL_REFRESH_TOKEN");
  }

  return { accounts, unavailable };
}

export interface EmailScanResult {
  accounts_scanned: string[];
  accounts_unavailable: string[];
  seen: number;
  captured: number;
  incidents_opened: string[];
  errors: string[];
}

export async function scanInfraEmails(): Promise<EmailScanResult> {
  const { accounts, unavailable } = await resolveAccounts();
  const result: EmailScanResult = {
    accounts_scanned: accounts.map((a) => a.address),
    accounts_unavailable: unavailable,
    seen: 0,
    captured: 0,
    incidents_opened: [],
    errors: [],
  };

  for (const account of accounts) {
    try {
      const ids = await listMessages(GMAIL_QUERY, account.token, MAX_MESSAGES_PER_ACCOUNT, account.userId);
      result.seen += ids.length;
      if (!ids.length) continue;

      const already = await getCapturedMessageIds(ids.map((m) => m.id));
      const fresh = ids.filter((m) => !already.has(m.id));

      for (const m of fresh) {
        try {
          const msg = await getMessageWithBody(m.id, account.token, account.userId);
          if (!msg) continue;

          const triage = await triageOpsyEmail({
            subject: msg.subject,
            from: msg.from,
            body: msg.body ?? "",
            receivedAt: msg.date,
          });

          let incidentId: string | null = null;
          const actionable =
            triage.is_infra_alert &&
            triage.action_required &&
            (triage.severity === "critical" || triage.severity === "warning");

          if (actionable) {
            const symptoms = `${triage.summary} (email: "${msg.subject}" from ${msg.from})`;
            const created = await insertOpsyIncident({
              service: triage.service,
              severity: triage.severity,
              symptoms,
              metadata: { auto_created: true, source: "email-scan", email_account: account.address },
            });
            incidentId = created.id;
            result.incidents_opened.push(created.id);
            await notifyIncidentOpened({
              id: created.id,
              service: triage.service,
              severity: triage.severity,
              symptoms,
              opened_at: created.opened_at,
            });
          }

          await insertOpsyEmailCapture({
            email_account: account.address,
            gmail_message_id: msg.id,
            from_address: msg.from,
            subject: msg.subject,
            service: triage.is_infra_alert ? triage.service : null,
            severity: triage.is_infra_alert ? triage.severity : null,
            summary: triage.summary,
            action_taken: actionable
              ? "incident opened + slack alert"
              : triage.is_infra_alert
                ? "logged (no action required)"
                : "ignored (not an infra alert)",
            incident_id: incidentId,
            received_at: msg.date ? new Date(msg.date).toISOString() : new Date().toISOString(),
          });
          result.captured++;
        } catch (err) {
          result.errors.push(`${account.address}/${m.id}: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    } catch (err) {
      result.errors.push(`${account.address}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return result;
}
