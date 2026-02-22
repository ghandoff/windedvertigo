/**
 * Send a domain verification email via Resend.
 *
 * Session 12: self-service domain verification.
 *
 * Uses the same RESEND_API_KEY and EMAIL_FROM as Auth.js magic links.
 * The email contains a one-click verification link that calls
 * GET /api/team/domains/verify?token=...
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";

interface SendVerificationEmailParams {
  to: string;
  domain: string;
  orgName: string;
  token: string;
}

export async function sendDomainVerificationEmail({
  to,
  domain,
  orgName,
  token,
}: SendVerificationEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — cannot send verification email");
    return { success: false, error: "email service not configured" };
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const verifyUrl = `${baseUrl}/api/team/domains/verify?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 20px; font-weight: 600; margin-bottom: 8px; text-transform: lowercase;">
        verify ${domain}
      </h2>
      <p style="color: #273248; opacity: 0.6; font-size: 14px; margin-bottom: 24px;">
        someone from <strong>${orgName}</strong> requested to verify ownership of
        <strong>${domain}</strong> on creaseworks. if this was you, click the
        button below.
      </p>
      <a
        href="${verifyUrl}"
        style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; text-transform: lowercase;"
      >
        verify domain
      </a>
      <p style="color: #273248; opacity: 0.4; font-size: 12px; margin-top: 24px;">
        once verified, anyone who signs in with an @${domain} email address will
        automatically join your organisation. if you didn't request this,
        you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid rgba(39, 50, 72, 0.1); margin: 24px 0;" />
      <p style="color: #273248; opacity: 0.3; font-size: 11px;">
        creaseworks by winded vertigo
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: `verify ${domain} — creaseworks`,
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("resend api error:", data);
      return {
        success: false,
        error: data.message || `resend returned ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("failed to send verification email:", err);
    return { success: false, error: err.message || "network error" };
  }
}
