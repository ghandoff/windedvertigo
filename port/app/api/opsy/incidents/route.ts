import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { insertOpsyIncident, getOpsyIncidents } from "@/lib/supabase/opsy";

const SEVERITIES = ["critical", "warning", "info"];
const STATUSES = ["open", "investigating", "resolved", "monitoring"];

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const incidents = await getOpsyIncidents({
      status: param(req, "status"),
      severity: param(req, "severity"),
      service: param(req, "service"),
      since: param(req, "since"),
      limit: param(req, "limit") ? Number(param(req, "limit")) : undefined,
    });
    return json(incidents);
  } catch (err) {
    console.error("[api/opsy/incidents] GET failed:", err);
    return error("failed to load incidents", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.service) return error("service is required");
  if (!body?.severity || !SEVERITIES.includes(body.severity)) {
    return error(`severity is required (one of: ${SEVERITIES.join(", ")})`);
  }
  if (!body?.symptoms) return error("symptoms is required");
  if (body.status && !STATUSES.includes(body.status)) {
    return error(`status must be one of: ${STATUSES.join(", ")}`);
  }

  try {
    const result = await insertOpsyIncident({
      service: body.service,
      severity: body.severity,
      symptoms: body.symptoms,
      cause: body.cause ?? undefined,
      remediation: body.remediation ?? undefined,
      auto_fixed: body.auto_fixed ?? false,
      status: body.status ?? undefined,
      metadata: body.metadata ?? {},
    });
    return json(result, 201);
  } catch (err) {
    console.error("[api/opsy/incidents] POST failed:", err);
    return error("failed to log incident", 500);
  }
}
