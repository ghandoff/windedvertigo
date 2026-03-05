/**
 * Stripe SDK singleton.
 *
 * Initialised lazily from STRIPE_SECRET_KEY.
 * Import `getStripe` from this module in all server-side code.
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
