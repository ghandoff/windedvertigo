import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";

const VALID_CATEGORIES = ["bug", "confusion", "idea", "praise"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

const EMOJI_MAP: Record<Category, string> = {
  bug: "\u{1F41B}",
  confusion: "\u{1F635}",
  idea: "\u{1F4A1}",
  praise: "\u{1F64C}",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return error("invalid json", 400);

  const { category, description, path } = body;

  if (!VALID_CATEGORIES.includes(category)) {
    return error("invalid category", 400);
  }

  if (!description || typeof description !== "string" || !description.trim()) {
    return error("description is required", 400);
  }

  const firstName =
    session.user.name?.split(" ")[0]?.toLowerCase() ??
    session.user.email?.split("@")[0] ??
    "unknown";
  const email = session.user.email ?? "unknown";

  const emoji = EMOJI_MAP[category as Category];
  const text = `${emoji} *${category}* from ${firstName} (${email})\n\u{1F4CD} ${path}\n\n${description}`;

  const webhookUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("[feedback] SLACK_FEEDBACK_WEBHOOK_URL not configured");
    return error("feedback channel not configured", 500);
  }

  const slackRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!slackRes.ok) {
    console.error("[feedback] slack webhook failed:", slackRes.status);
    return error("failed to send feedback", 500);
  }

  return json({ ok: true });
}
