/**
 * Stripe SDK singleton.
 *
 * Initialised lazily from STRIPE_SECRET_KEY.
 * Import `stripe` from this module in all server-side code.
 *
 * The API version is intentionally omitted so the SDK uses its
 * built-in default (matching the installed stripe package version).
 * Pin a version here only if you need to lock to a specific API
 * version across SDK upgrades.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}
