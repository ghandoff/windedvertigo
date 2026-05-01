/**
 * Notion CRM logging for booking events.
 *
 * Uses @windedvertigo/notion's upsertCrmContact() for the dedup-by-email
 * + update-or-create pattern. This file only builds the domain-specific
 * nextAction string and calls the shared function.
 *
 * Failures are always non-fatal — CRM logging never breaks a booking flow.
 */

import { Client } from "@notionhq/client";
import { upsertCrmContact } from "@windedvertigo/notion";

let cachedClient: Client | null = null;

function getClient(): Client | null {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.warn("[booking.notion] NOTION_TOKEN not set — skipping CRM log");
    return null;
  }
  if (!cachedClient) cachedClient = new Client({ auth: token });
  return cachedClient;
}

interface LogBookingParams {
  name: string;
  email: string;
  eventTypeSlug: string;
  eventTitle: string;
  startAt: Date;
  hostNames: string[];
  curious?: string;
  valuable?: string;
  quadrant?: string | null;
}

/**
 * Log a confirmed booking to the CRM. Idempotent-ish: dedups by email
 * and updates the existing contact if found. Failures are non-fatal.
 */
export async function logBookingToNotion(params: LogBookingParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(params.startAt);

  const hosts =
    params.hostNames.length === 1
      ? params.hostNames[0]
      : params.hostNames.join(" + ");

  let nextAction = `playdate booked (${params.eventTypeSlug}): ${dateLabel} with ${hosts}`;
  if (params.curious) nextAction += ` — curious: ${params.curious}`;
  if (params.valuable) nextAction += ` — values: ${params.valuable}`;
  if (params.quadrant) nextAction += ` — quadrant: ${params.quadrant}`;

  try {
    await upsertCrmContact({
      client,
      email: params.email,
      name: params.name,
      warmth: "warm",
      stage: "introduced",
      nextAction,
    });
  } catch (err) {
    // upsertCrmContact is already non-throwing, but belt-and-suspenders.
    console.error("[booking.notion] logBookingToNotion failed:", String(err));
  }
}

/**
 * Log a cancellation. Updates next_action on the existing contact (if found).
 */
export async function logCancellationToNotion(params: {
  email: string;
  eventTitle: string;
  startAt: Date;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(params.startAt);

  try {
    await upsertCrmContact({
      client,
      email: params.email,
      nextAction: `playdate cancelled (${params.eventTitle}, ${dateLabel})`,
    });
  } catch (err) {
    console.warn("[booking.notion] logCancellationToNotion failed:", String(err));
  }
}
