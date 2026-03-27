/**
 * Send a package builder email with PDF attachment via Resend.
 *
 * Pattern follows creaseworks send-digest.ts — raw fetch to Resend API
 * with inline-CSS HTML and base64-encoded PDF attachment.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";
const REPLY_TO = process.env.PACKAGE_REPLY_TO ?? "hello@windedvertigo.com";

const QUADRANT_LABELS: Record<string, string> = {
  "people-design": "people × design",
  "people-research": "people × research",
  "product-design": "product × design",
  "product-research": "product × research",
};

const GOAL_HOOKS: Record<string, string> = {
  prove: "you want to demonstrate measurable impact — that's exactly where our research-led approach shines.",
  improve: "you're looking to make what exists even better — we love building on strong foundations.",
  scale: "scaling reach and adoption takes intentional design — we can help you do it without losing what works.",
  accessibility: "inclusive design isn't an afterthought for us — it's built into everything we do.",
  concept: "rapid idea exploration is one of our favourite things — let's see what's possible.",
  prototype: "building something testable early saves enormous time later — we're ready to get hands-on.",
};

interface SendPackageParams {
  name: string;
  email: string;
  quadrant: string;
  goals: string[];
  pdfBuffer: Buffer;
}

function buildPackageHtml({
  name,
  quadrant,
  goals,
}: Omit<SendPackageParams, "email" | "pdfBuffer">): string {
  const label = QUADRANT_LABELS[quadrant] ?? quadrant;
  const firstName = name.split(" ")[0].toLowerCase();

  // pick the first matching goal hook for a personalised line
  const hook = goals
    .map((g) => GOAL_HOOKS[g])
    .find((h) => h);

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 20px; font-weight: 600; margin-bottom: 4px; text-transform: lowercase;">
        your ${label} package
      </h2>
      <p style="color: #273248; opacity: 0.5; font-size: 13px; margin-bottom: 24px;">
        winded.vertigo
      </p>

      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        hi ${firstName},
      </p>

      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        here's the <strong>${label}</strong> package you built — it's attached as a PDF.
      </p>

      ${hook ? `
      <p style="color: #273248; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        ${hook}
      </p>
      ` : ""}

      <a
        href="https://calendar.app.google/ZXVqJLdprmUZk1DW6"
        style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; text-transform: lowercase;"
      >
        book a free playdate
      </a>

      <p style="color: #273248; opacity: 0.7; font-size: 13px; line-height: 1.6; margin-top: 24px;">
        have questions? just reply to this email — it comes straight to us.
      </p>

      <hr style="border: none; border-top: 1px solid rgba(39, 50, 72, 0.1); margin: 28px 0 16px;" />
      <p style="color: #273248; opacity: 0.3; font-size: 11px; margin: 0;">
        winded.vertigo · this package refreshes weekly as we add new work
      </p>
    </div>
  `;
}

export async function sendPackageEmail(
  params: SendPackageParams,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — cannot send package email");
    return { success: false, error: "email service not configured" };
  }

  const label = QUADRANT_LABELS[params.quadrant] ?? params.quadrant;
  const html = buildPackageHtml(params);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.email],
        reply_to: REPLY_TO,
        subject: `your ${label} package — winded.vertigo`,
        html,
        attachments: [
          {
            filename: `winded-vertigo-${params.quadrant}.pdf`,
            content: params.pdfBuffer.toString("base64"),
          },
        ],
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("resend api error (package):", data);
      return {
        success: false,
        error: data.message || `resend returned ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "network error";
    console.error("failed to send package email:", err);
    return { success: false, error: message };
  }
}
