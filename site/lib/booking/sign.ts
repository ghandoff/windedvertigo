/**
 * Re-export shim — HMAC-SHA256 signing lives in @windedvertigo/booking.
 * This file preserves all existing import paths within site/.
 */
export type {
  CancelTokenPayload,
  RescheduleTokenPayload,
  OauthStateTokenPayload,
  PrefillTokenPayload,
} from "@windedvertigo/booking";
export {
  mint,
  verify,
  nowSec,
  mintCancelToken,
  mintRescheduleToken,
  verifyCancelToken,
  verifyRescheduleToken,
} from "@windedvertigo/booking";
