/**
 * Calls into the site's booking API for mutations the port shouldn't duplicate.
 * Cancel + reschedule both touch Google Calendar, send notifications, and log
 * to Notion — all of which already exist on the site.
 *
 * Tokens are minted with @windedvertigo/booking using the same
 * BOOKING_SIGNING_KEY env var the site uses, so the site verifier accepts them.
 */

import { mintCancelToken } from "@windedvertigo/booking";

const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://windedvertigo.com";

export async function cancelBooking(bookingId: string): Promise<void> {
  const token = await mintCancelToken(bookingId, 5 * 60); // 5 min TTL — team-side use
  const res = await fetch(`${SITE_ORIGIN}/api/booking/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cancel failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * Rescheduling from the team side is a non-trivial UI (slot picker, etc.).
 * For v1 we just return the visitor-facing reschedule URL so a host can
 * forward it to the visitor — no team-side slot picker.
 */
export async function rescheduleUrlForBooking(_bookingId: string): Promise<string> {
  throw new Error(
    "team-side reschedule not yet wired — for now, ask the visitor to reschedule from their confirmation email",
  );
}
