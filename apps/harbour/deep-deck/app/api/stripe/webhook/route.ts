import { handleStripeWebhook } from "@windedvertigo/stripe/webhook";

export async function POST(req: Request) {
  return handleStripeWebhook(req, "deep-deck");
}
