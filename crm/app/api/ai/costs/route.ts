import { error, json } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { getCostBreakdown } from "@/lib/ai/usage-store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const breakdown = await getCostBreakdown();
  return json(breakdown);
}
