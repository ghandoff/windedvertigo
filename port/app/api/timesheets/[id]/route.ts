import { NextRequest } from "next/server";
import { getTimesheet, updateTimesheet, archiveTimesheet } from "@/lib/notion/timesheets";
import { json, withNotionError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(() => getTimesheet(id));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  // Capture previous status before update (only if status is changing)
  let previousStatus: string | undefined;
  if (body.status) {
    try {
      const before = await getTimesheet(id);
      previousStatus = before.status;
    } catch {
      // If we can't read the previous state, proceed without it
    }
  }

  const result = await withNotionError(() => updateTimesheet(id, body));

  // Fire Inngest event on meaningful status transitions
  if (body.status && body.status !== previousStatus) {
    // Fire-and-forget — don't block the response on event delivery
    inngest.send({
      name: "timesheet/status.changed",
      data: {
        timesheetId: id,
        newStatus: body.status,
        previousStatus,
        approverEmail: await getCallerEmail(req),
      },
    }).catch((err) => {
      console.warn("[inngest] failed to send timesheet event:", err);
    });
  }

  return result;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    await archiveTimesheet(id);
    return json({ archived: true });
  });
}

// ── helpers ──────────────────────────────────────────────

async function getCallerEmail(req: NextRequest): Promise<string> {
  try {
    const session = await auth();
    return session?.user?.email ?? "system";
  } catch {
    return "system";
  }
}
