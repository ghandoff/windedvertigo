import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getOpenFinItems, createFinItem } from "@/lib/fin-data";

const VALID_TYPES = ["bill", "invoice", "tax_notice", "deadline", "bank_alert", "taxdome_message", "renewal", "other"];

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const items = await getOpenFinItems();
    return json(items);
  } catch (err) {
    console.error("[api/fin/items] GET failed:", err);
    return error("failed to load items", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.type || !VALID_TYPES.includes(body.type)) {
    return error(`type is required (one of: ${VALID_TYPES.join(", ")})`);
  }
  if (!body?.title) return error("title is required");

  try {
    const item = await createFinItem({
      type: body.type,
      title: body.title,
      source: body.source ?? undefined,
      amount_cents: body.amount_cents ?? undefined,
      currency: body.currency ?? undefined,
      due_date: body.due_date ?? undefined,
      notes: body.notes ?? undefined,
      raw_email_id: body.raw_email_id ?? undefined,
    });
    return json(item, 201);
  } catch (err) {
    console.error("[api/fin/items] POST failed:", err);
    return error("failed to create item", 500);
  }
}
