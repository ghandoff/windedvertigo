/**
 * Send a nudge/re-engagement email via Resend.
 *
 * For users inactive > 14 days, sends a gentle nudge with a
 * specific playdate recommendation to get them back playing.
 *
 * Same pattern as send-digest.ts — raw fetch to Resend API
 * with inline-CSS HTML.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";

interface SendNudgeParams {
  to: string;
  name: string | null;
  daysInactive: number;
  recommendation: {
    title: string;
    slug: string;
    headline: string | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  html builder                                                       */
/* ------------------------------------------------------------------ */

function buildNudgeHtml({
  name,
  daysInactive,
  recommendation,
}: Omit<SendNudgeParams, "to">): string {
  const greeting = name ? `hi ${name.split(" ")[0].toLowerCase()}` : "hi there";

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const sections: string[] = [];

  // Main message
  sections.push(`
    <div style="margin-bottom: 24px;">
      <p style="color: #273248; font-size: 14px; margin: 0 0 12px 0; line-height: 1.5;">
        it's been <strong>${daysInactive} days</strong> since your last playdate. we miss seeing you on creaseworks!
      </p>
      <p style="color: #273248; opacity: 0.6; font-size: 13px; margin: 0; line-height: 1.5;">
        no pressure — whenever you're ready, we've picked something that might fit what you have on hand.
      </p>
    </div>
  `);

  // Recommendation
  if (recommendation) {
    sections.push(`
      <div style="margin-bottom: 24px; background-color: #faf1e8; border-left: 3px solid #b15043; border-radius: 4px; padding: 16px;">
        <p style="color: #273248; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin: 0 0 8px 0; opacity: 0.5;">
          try this
        </p>
        <a
          href="${baseUrl}/sampler/${recommendation.slug}"
          style="color: #b15043; text-decoration: none; font-weight: 500; font-size: 15px;"
        >
          ${recommendation.title}
        </a>
        ${
          recommendation.headline
            ? `<p style="color: #273248; opacity: 0.5; font-size: 12px; margin: 6px 0 0 0;">${recommendation.headline}</p>`
            : ""
        }
      </div>
    `);
  } else {
    // Fallback if no specific recommendation
    sections.push(`
      <div style="margin-bottom: 24px; background-color: #faf1e8; border-radius: 8px; padding: 12px 16px;">
        <p style="color: #273248; font-size: 13px; margin: 0;">
          <a href="${baseUrl}/matcher" style="color: #b15043; text-decoration: none; font-weight: 500;">find a playdate</a>
          that fits your playstyle right now.
        </p>
      </div>
    `);
  }

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 18px; font-weight: 600; margin-bottom: 8px; text-transform: lowercase;">
        come back and play?
      </h2>
      <p style="color: #273248; opacity: 0.5; font-size: 13px; margin-bottom: 20px;">
        ${greeting}
      </p>

      ${sections.join("")}

      <a
        href="${baseUrl}/playbook"
        style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; text-transform: lowercase;"
      >
        back to your playbook
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

export async function sendNudgeEmail(
  params: SendNudgeParams,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — cannot send nudge email");
    return { success: false, error: "email service not configured" };
  }

  const html = buildNudgeHtml(params);

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
        subject: "come back and play? — creaseworks",
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("resend api error (nudge):", data);
      return {
        success: false,
        error: data.message || `resend returned ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("failed to send nudge email:", err);
    return { success: false, error: err.message || "network error" };
  }
}
