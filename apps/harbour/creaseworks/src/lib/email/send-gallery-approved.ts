/**
 * Send a gallery approval notification via Resend.
 *
 * When an admin approves a user's evidence for the community gallery,
 * this email lets them know their contribution is now live.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";

interface SendGalleryApprovedParams {
  to: string;
  name: string | null;
  playdateTitle: string | null;
  evidenceType: string;
}

/* ------------------------------------------------------------------ */
/*  html builder                                                       */
/* ------------------------------------------------------------------ */

function buildGalleryApprovedHtml({
  name,
  playdateTitle,
  evidenceType,
}: Omit<SendGalleryApprovedParams, "to">): string {
  const greeting = name ? `hi ${name.split(" ")[0].toLowerCase()}` : "hi there";

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const typeLabel =
    evidenceType === "photo"
      ? "photo"
      : evidenceType === "quote"
        ? "quote"
        : "observation";

  const contextLine = playdateTitle
    ? `your ${typeLabel} from <strong>${playdateTitle}</strong>`
    : `your ${typeLabel}`;

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 18px; font-weight: 600; margin-bottom: 8px; text-transform: lowercase;">
        you're in the gallery!
      </h2>
      <p style="color: #273248; opacity: 0.5; font-size: 13px; margin-bottom: 20px;">
        ${greeting}
      </p>

      <div style="margin-bottom: 24px;">
        <p style="color: #273248; font-size: 14px; margin: 0 0 12px 0; line-height: 1.5;">
          ${contextLine} has been approved and is now part of the
          <strong>creaseworks community gallery</strong>.
        </p>
        <p style="color: #273248; opacity: 0.6; font-size: 13px; margin: 0; line-height: 1.5;">
          other families can now see your contribution — thanks for sharing what play looks like in your world.
        </p>
      </div>

      <a
        href="${baseUrl}/gallery"
        style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; text-transform: lowercase;"
      >
        see the gallery
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

export async function sendGalleryApprovedEmail(
  params: SendGalleryApprovedParams,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — cannot send gallery approval email");
    return { success: false, error: "email service not configured" };
  }

  const html = buildGalleryApprovedHtml(params);

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
        subject: "you're in the gallery! — creaseworks",
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("resend api error (gallery-approved):", data);
      return {
        success: false,
        error: data.message || `resend returned ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("failed to send gallery approval email:", err);
    return { success: false, error: err.message || "network error" };
  }
}
