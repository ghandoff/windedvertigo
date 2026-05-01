/**
 * @windedvertigo/booking
 *
 * Portable booking utilities — slot generation, HMAC signing, crypto
 * helpers, prefill tokens, and intake routing.
 *
 * NOT included (site-specific / CF KV / env-specific):
 *   - supabase client & row types  → site/lib/booking/supabase.ts
 *   - rate limiting (KV)           → site/lib/booking/rate-limit-kv.ts
 *   - Notion CRM logging           → site/lib/booking/notion.ts
 *   - GCal free/busy               → site/lib/booking/freebusy.ts
 *   - GCal events                  → site/lib/booking/gcal-events.ts
 *   - Google OAuth flow            → site/lib/booking/google-oauth.ts
 *   - Resend email                 → site/lib/booking/email.ts
 */

// Shared types (subset of supabase row types, decoupled from site)
export type { EventType, EventTypeMode, Host } from "./types";

// Slot generation algorithm
export type { Interval, HostBusy, Slot } from "./slots";
export {
  mergeIntervals,
  subtractIntervals,
  padBusy,
  containsInterval,
  expandWorkingHours,
  ceilToStep,
  generateSlots,
} from "./slots";

// HMAC-SHA256 signing (Web Crypto)
export type {
  CancelTokenPayload,
  RescheduleTokenPayload,
  OauthStateTokenPayload,
  PrefillTokenPayload,
} from "./sign";
export {
  mint,
  verify,
  nowSec,
  mintCancelToken,
  mintRescheduleToken,
  verifyCancelToken,
  verifyRescheduleToken,
} from "./sign";

// AES-GCM encryption + base64 helpers (Web Crypto)
export {
  encrypt,
  decrypt,
  bytesToBase64,
  base64ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
} from "./crypto";

// Prefill token for PlaydateForm → /book/[slug] handoff
export { mintPrefillToken } from "./prefill";

// Intake routing (quadrant + keywords → event_type slug)
export type { Intake, RoutingDecision } from "./intake-routing";
export { routeIntake } from "./intake-routing";
