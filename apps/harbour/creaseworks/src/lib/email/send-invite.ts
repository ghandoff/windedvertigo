/**
 * Send a pilot invite notification via Resend.
 *
 * When an admin invites a user to creaseworks, this email lets them
 * know they have access and which packs are waiting for them.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";

interface SendInviteParams {
  to: string;
  packNames: string[];
  note: string | null;
  inviterName: string | null;
}

/* ------------------------------------------------------------------ */
/*  html builder                                                       */
/* ------------------------------------------------------------------ */

function buildInviteHtml({
  packNames,
  note,
  inviterName,
}: Omit<SendInviteParams, "to">): string {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://windedvertigo.com/harbour/creaseworks";

  const packList = packNames
    .map(
      (name) =>
        `<li style="color: #273248; font-size: 14px; line-height: 1.6;">${name}</li>`,
    )
    .join("");

  const noteLine = note
    ? `<p style="color: #273248; opacity: 0.7; font-size: 13px; font-style: italic; margin: 0 0 16px 0; line-height: 1.5; border-left: 3px solid #cb7858; padding-left: 12px;">${note}</p>`
    : "";

  const fromLine = inviterName
    ? ` from <strong>${inviterName}</strong>`
    : "";

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 18px; font-weight: 600; margin-bottom: 16px; text-transform: lowercase;">
        you're invited to creaseworks
      </h2>

      <p style="color: #273248; font-size: 14px; margin: 0 0 12px 0; line-height: 1.5;">
        you've been invited${fromLine} to join <strong>creaseworks</strong> — a playful toolkit for caregivers and educators.
      </p>

      ${noteLine}

      <p style="color: #273248; opacity: 0.6; font-size: 13px; margin: 0 0 8px 0; text-transform: lowercase;">
        packs waiting for you:
      </p>
      <ul style="margin: 0 0 20px 0; padding-left: 20px;">
        ${packList}
      </ul>

      <a
        href="${baseUrl}/login?callbackUrl=/onboarding"
        style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; text-transform: lowercase;"
      >
        sign in to get started
      </a>

      <hr style="border: none; border-top: 1px solid rgba(39, 50, 72, 0.1); margin: 28px 0 16px;" />
      <p style="color: #273248; opacity: 0.3; font-size: 11px; margin: 0;">
        creaseworks by winded vertigo
      </p>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  send function                                                      */
/* ------------------------------------------------------------------ */

export async function sendInviteEmail(
  params: SendInviteParams,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — cannot send invite email");
    return { success: false, error: "email service not configured" };
  }

  const html = buildInviteHtml(params);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        subject: "you're invited to creaseworks",
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("resend api error (invite):", data);
      return {
        success: false,
        error: data.message || `resend returned ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("failed to send invite email:", err);
    return { success: false, error: err.message || "network error" };
  }
}
