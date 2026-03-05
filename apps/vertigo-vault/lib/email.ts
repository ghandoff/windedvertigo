import { Resend } from "resend";

let _resend: Resend | null = null;

/**
 * Lazily initialised Resend client.
 *
 * The RESEND_API_KEY env var is shared with next-auth's magic-link
 * provider — we reuse it for transactional emails.
 */
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "noreply@windedvertigo.com";
const VAULT_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://windedvertigo.com/harbour/vertigo-vault";

/**
 * Send a purchase-confirmation email after a successful Stripe checkout.
 *
 * HTML is kept minimal (inline styles, no external assets) so it renders
 * reliably across email clients.
 */
export async function sendPurchaseConfirmationEmail({
  to,
  packName,
  amountCents,
  currency,
}: {
  to: string;
  packName: string;
  amountCents: number;
  currency: string;
}) {
  const resend = getResend();
  const amount = formatCurrency(amountCents, currency);

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `your ${packName} is ready — vertigo.vault`,
    html: confirmationHtml({ packName, amount }),
    text: confirmationText({ packName, amount }),
  });

  if (error) {
    console.error("[email] purchase confirmation failed:", error);
    // Don't throw — the purchase is already complete, we shouldn't
    // fail the webhook response because the email didn't send.
  }
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function confirmationHtml({
  packName,
  amount,
}: {
  packName: string;
  amount: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0f1923;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1923;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e2738;border-radius:12px;padding:40px 32px;">

        <!-- logo / title -->
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#e8edf3;letter-spacing:-0.02em;">
            vertigo.vault
          </h1>
        </td></tr>

        <!-- headline -->
        <tr><td align="center" style="padding-bottom:16px;">
          <h2 style="margin:0;font-size:24px;font-weight:700;color:#AF4F41;">
            you&rsquo;re in!
          </h2>
        </td></tr>

        <!-- body -->
        <tr><td style="padding-bottom:24px;color:#e8edf3;font-size:15px;line-height:1.65;opacity:0.85;">
          <p style="margin:0 0 12px;">
            thanks for purchasing the <strong>${packName}</strong> (${amount}).
            your new content is available now.
          </p>
          <p style="margin:0;">
            head back to the vault to explore your unlocked activities,
            materials, and resources.
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding-bottom:32px;">
          <a href="${VAULT_URL}"
             style="display:inline-block;padding:12px 28px;background:#AF4F41;color:#fff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
            open the vault
          </a>
        </td></tr>

        <!-- footer -->
        <tr><td align="center" style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
          <p style="margin:0;font-size:12px;color:#e8edf3;opacity:0.4;">
            winded.vertigo &mdash; activities designed to spark curiosity,
            collaboration, and creative thinking.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function confirmationText({
  packName,
  amount,
}: {
  packName: string;
  amount: string;
}) {
  return `vertigo.vault — you're in!

Thanks for purchasing the ${packName} (${amount}).
Your new content is available now.

Head back to the vault to explore your unlocked activities:
${VAULT_URL}

---
winded.vertigo — activities designed to spark curiosity,
collaboration, and creative thinking.`;
}
