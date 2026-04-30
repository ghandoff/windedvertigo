/**
 * Prefill token mint/verify for the PlaydateForm → /book/[slug] handoff.
 *
 * The PlaydateForm captures name, email, two free-text answers, and the
 * quiz quadrant context. After submission we redirect the visitor to
 * /book/[slug]?prefill=<token> with all that context HMAC-signed in the
 * URL. The booking page verifies the token (via lib/booking/sign.ts) and
 * pre-populates the BookingForm so the visitor doesn't re-type anything.
 *
 * 10-minute TTL — long enough for slow connections, short enough that a
 * shared link doesn't leak intake answers indefinitely.
 */

import { mint, type PrefillTokenPayload, nowSec } from "./sign";

const PREFILL_TTL_SEC = 600; // 10 minutes

interface PrefillInput {
  name: string;
  email: string;
  curious: string;
  valuable: string;
  quadrant: string | null;
  quadrantHistory: string[];
}

/**
 * Mint a prefill token for the booking page. The returned token is safe
 * to put in a URL query param — it's HMAC-signed and base64url-encoded.
 *
 * Use the result like:
 *   const token = await mintPrefillToken({...});
 *   redirect(`/book/${slug}?prefill=${token}`);
 */
export async function mintPrefillToken(input: PrefillInput): Promise<string> {
  const payload: PrefillTokenPayload = {
    name: input.name,
    email: input.email,
    curious: input.curious,
    valuable: input.valuable,
    quadrant: input.quadrant,
    quadrantHistory: input.quadrantHistory,
    exp: nowSec() + PREFILL_TTL_SEC,
  };
  return mint<PrefillTokenPayload>(payload);
}
