/**
 * Send a package builder email with PDF attachment via Resend.
 *
 * HTML primitives come from @windedvertigo/email-templates.
 * Transport uses raw fetch — the resend SDK is not compatible with CF Workers.
 */

import { wvShell, ctaButton, escapeHtml, wvPara } from "@windedvertigo/email-templates";

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

  const hook = goals.map((g) => GOAL_HOOKS[g]).find((h) => h);

  return wvShell(
    `your ${label} package`,
    `
      ${wvPara(`hi ${escapeHtml(firstName)},`)}
      ${wvPara(`here's the <strong>${escapeHtml(label)}</strong> package you built — it's attached as a PDF.`, "16px")}
      ${hook ? wvPara(escapeHtml(hook), "24px") : ""}
      ${ctaButton("https://www.windedvertigo.com/quadrants/", "book a free playdate")}
      ${wvPara("have questions? hit reply — it goes straight to our team.", "24px")}
    `,
    "winded.vertigo · this package refreshes weekly as we add new work",
  );
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
      const data = (await res.json().catch(() => ({}))) as { message?: string };
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
