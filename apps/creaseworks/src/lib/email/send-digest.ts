/**
 * Send a weekly digest email via Resend.
 *
 * Session 21: notification digest system.
 *
 * Same Resend pattern as send-verification.ts — raw fetch to the
 * Resend API with inline-CSS HTML.
 */

import type { DigestContent } from "@/lib/queries/notifications";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";

interface SendDigestParams {
  to: string;
  name: string | null;
  content: DigestContent;
  unsubscribeUrl: string;
}

/* ------------------------------------------------------------------ */
/*  html builder                                                       */
/* ------------------------------------------------------------------ */

function buildDigestHtml({
  name,
  content,
  unsubscribeUrl,
}: Omit<SendDigestParams, "to">): string {
  const greeting = name ? `hi ${name.split(" ")[0].toLowerCase()}` : "hi there";

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const sections: string[] = [];

  // new playdates
  if (content.newPlaydates.length > 0) {
    const items = content.newPlaydates
      .map(
        (p) =>
          `<li style="margin-bottom: 6px;">
            <a href="${baseUrl}/sampler/${p.slug}" style="color: #b15043; text-decoration: none; font-weight: 500;">${p.title}</a>
            ${p.headline ? `<br/><span style="color: #273248; opacity: 0.5; font-size: 12px;">${p.headline}</span>` : ""}
          </li>`,
      )
      .join("");
    sections.push(`
      <div style="margin-bottom: 20px;">
        <h3 style="color: #273248; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: lowercase;">new playdates this week</h3>
        <ul style="margin: 0; padding-left: 18px; color: #273248; font-size: 13px;">${items}</ul>
      </div>
    `);
  }

  // recent reflections + evidence
  if (content.recentReflections > 0 || content.evidenceCount > 0) {
    const parts: string[] = [];
    if (content.recentReflections > 0) {
      parts.push(
        `you logged <strong>${content.recentReflections}</strong> reflection${content.recentReflections !== 1 ? "s" : ""}`,
      );
    }
    if (content.evidenceCount > 0) {
      parts.push(
        `captured <strong>${content.evidenceCount}</strong> piece${content.evidenceCount !== 1 ? "s" : ""} of evidence`,
      );
    }
    sections.push(`
      <div style="margin-bottom: 20px;">
        <h3 style="color: #273248; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: lowercase;">your week</h3>
        <p style="color: #273248; opacity: 0.7; font-size: 13px; margin: 0;">
          ${parts.join(" and ")} this week. nice work!
        </p>
      </div>
    `);
  }

  // progress changes
  if (content.progressChanges.length > 0) {
    const items = content.progressChanges
      .map(
        (p) =>
          `<li style="margin-bottom: 4px;">${p.playdateTitle} → <strong>${p.tier.replace(/_/g, " ")}</strong></li>`,
      )
      .join("");
    sections.push(`
      <div style="margin-bottom: 20px;">
        <h3 style="color: #273248; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: lowercase;">progress</h3>
        <ul style="margin: 0; padding-left: 18px; color: #273248; opacity: 0.7; font-size: 13px;">${items}</ul>
      </div>
    `);
  }

  // suggestions — untried playdates from collections
  if (content.untried.length > 0) {
    const items = content.untried
      .map(
        (p) =>
          `<li style="margin-bottom: 6px;">
            <a href="${baseUrl}/sampler/${p.slug}" style="color: #b15043; text-decoration: none; font-weight: 500;">${p.title}</a>
            <br/><span style="color: #273248; opacity: 0.5; font-size: 12px;">from ${p.collectionTitle}</span>
          </li>`,
      )
      .join("");
    sections.push(`
      <div style="margin-bottom: 20px;">
        <h3 style="color: #273248; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: lowercase;">try next</h3>
        <ul style="margin: 0; padding-left: 18px; color: #273248; font-size: 13px;">${items}</ul>
      </div>
    `);
  }

  // nudge if nothing happened
  if (content.recentReflections === 0 && content.evidenceCount === 0) {
    sections.push(`
      <div style="margin-bottom: 20px; background-color: #faf1e8; border-radius: 8px; padding: 12px 16px;">
        <p style="color: #273248; font-size: 13px; margin: 0;">
          it's been a quiet week — that's okay! whenever you're ready,
          <a href="${baseUrl}/matcher" style="color: #b15043; text-decoration: none; font-weight: 500;">find a playdate</a>
          that fits what you have on hand.
        </p>
      </div>
    `);
  }

  return `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #273248; font-size: 20px; font-weight: 600; margin-bottom: 4px; text-transform: lowercase;">
        your weekly playdate digest
      </h2>
      <p style="color: #273248; opacity: 0.5; font-size: 13px; margin-bottom: 24px;">
        ${greeting} — here's what's been happening on creaseworks.
      </p>

      ${sections.join("")}

      <a
        href="${baseUrl}/playbook"
        style="display: inline-block; background-color: #b15043; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; text-transform: lowercase; margin-top: 4px;"
      >
        open your playbook
      </a>

      <hr style="border: none; border-top: 1px solid rgba(39, 50, 72, 0.1); margin: 28px 0 16px;" />
      <p style="color: #273248; opacity: 0.3; font-size: 11px; margin: 0;">
        creaseworks by winded vertigo ·
        <a href="${unsubscribeUrl}" style="color: #273248; opacity: 0.5;">unsubscribe</a>
      </p>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  send function                                                      */
/* ------------------------------------------------------------------ */

export async function sendDigestEmail(
  params: SendDigestParams,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — cannot send digest email");
    return { success: false, error: "email service not configured" };
  }

  const html = buildDigestHtml(params);

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
        subject: "your weekly playdate digest — creaseworks",
        html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("resend api error (digest):", data);
      return {
        success: false,
        error: data.message || `resend returned ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("failed to send digest email:", err);
    return { success: false, error: err.message || "network error" };
  }
}
