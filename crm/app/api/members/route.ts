import { getActiveMembers } from "@/lib/notion/members";
import { withNotionError } from "@/lib/api-helpers";

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  return withNotionError(async () => {
    const members = await getActiveMembers();
    return { data: members };
  });
}
