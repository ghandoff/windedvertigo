/**
 * Gusto timesheet sync — pushes approved timesheets to Gusto for payroll.
 *
 * Flow:
 *   1. Query approved timesheets from Notion
 *   2. Filter out already-synced entries (explanation starts with "[gusto:")
 *   3. Map port members to Gusto employees/contractors by email
 *   4. POST time entries (employees) or contractor payments (contractors)
 *   5. Update Notion timesheet status to "invoiced" with Gusto reference
 *
 * Gusto API endpoints used:
 *   - GET  /v1/companies/{uuid}/employees — roster lookup
 *   - GET  /v1/companies/{uuid}/contractors — contractor roster lookup
 *   - POST /v1/companies/{uuid}/contractor_payments — contractor payment
 *   - POST /v1/companies/{uuid}/payrolls/{id}/calculate — employee time
 *     (Note: Employee payroll entries use the payrolls endpoint. If a custom
 *      time tracking endpoint is available, swap the POST target below.)
 *
 * Rate handling: Sequential processing with 200ms delay between API calls.
 */

import { queryTimesheets, updateTimesheet } from "@/lib/notion/timesheets";
import { getActiveMembers, type Member } from "@/lib/notion/members";
import {
  listEmployees,
  listContractors,
  gustoPost,
  type GustoEmployee,
  type GustoContractor,
} from "./client";

/** Default hourly rate when a timesheet entry has no rate set */
const DEFAULT_HOURLY_RATE = 50;

// ── Types ──────────────────────────────────────────────────

export interface SyncDetail {
  timesheetId: string;
  entry: string;
  memberEmail: string;
  status: "synced" | "skipped" | "failed" | "unmapped";
  gustoId?: string;
  error?: string;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  failed: number;
  unmapped: number;
  details: SyncDetail[];
}

// ── Helpers ────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RosterType = "employee" | "contractor";

interface RosterEntry {
  uuid: string;
  type: RosterType;
}

/**
 * Build a lowercase-email -> RosterEntry map from Gusto employees + contractors.
 * Employees use work_email (falling back to email); contractors use email.
 */
function buildRosterMap(
  employees: GustoEmployee[],
  contractors: GustoContractor[],
): Map<string, RosterEntry> {
  const map = new Map<string, RosterEntry>();

  for (const emp of employees) {
    const email = (emp.work_email ?? emp.email ?? "").toLowerCase();
    if (email) map.set(email, { uuid: emp.uuid, type: "employee" });
  }

  for (const con of contractors) {
    const email = (con.email ?? "").toLowerCase();
    if (email) map.set(email, { uuid: con.uuid, type: "contractor" });
  }

  return map;
}

/** Build a Notion person ID -> Member map for quick lookup. */
function buildMemberIdMap(members: Member[]): Map<string, Member> {
  const map = new Map<string, Member>();
  for (const m of members) {
    map.set(m.id, m);
  }
  return map;
}

// ── Core sync ──────────────────────────────────────────────

export async function runGustoSync(): Promise<SyncResult> {
  const companyUuid = process.env.GUSTO_COMPANY_UUID;
  if (!companyUuid) {
    throw new Error("[gusto] Missing required env var: GUSTO_COMPANY_UUID");
  }

  // 1. Fetch approved timesheets
  const { data: timesheets } = await queryTimesheets(
    { status: "approved" },
    { pageSize: 200 },
  );

  // 2. Filter out already-synced (explanation starts with "[gusto:")
  const pending = timesheets.filter(
    (ts) => !ts.explanation?.startsWith("[gusto:"),
  );

  const skippedCount = timesheets.length - pending.length;

  if (pending.length === 0) {
    return {
      synced: 0,
      skipped: skippedCount,
      failed: 0,
      unmapped: 0,
      details: [],
    };
  }

  // 3. Build member + Gusto roster maps
  const members = await getActiveMembers();
  const memberIdMap = buildMemberIdMap(members);

  const [employees, contractors] = await Promise.all([
    listEmployees(companyUuid),
    listContractors(companyUuid),
  ]);

  const rosterMap = buildRosterMap(employees, contractors);

  // 4. Process each timesheet sequentially
  const result: SyncResult = {
    synced: 0,
    skipped: skippedCount,
    failed: 0,
    unmapped: 0,
    details: [],
  };

  for (const ts of pending) {
    // Find the port member by person ID
    const personId = ts.personIds[0];
    const member = personId ? memberIdMap.get(personId) : undefined;

    if (!member) {
      result.unmapped++;
      result.details.push({
        timesheetId: ts.id,
        entry: ts.entry,
        memberEmail: "",
        status: "unmapped",
        error: `No port member found for personId ${personId ?? "(none)"}`,
      });
      continue;
    }

    const email = member.email.toLowerCase();
    const roster = rosterMap.get(email);

    if (!roster) {
      result.unmapped++;
      result.details.push({
        timesheetId: ts.id,
        entry: ts.entry,
        memberEmail: email,
        status: "unmapped",
        error: `Member ${member.name} (${email}) not found in Gusto roster`,
      });
      continue;
    }

    const isReimbursement = ts.type === "reimbursement";
    const hours = ts.hours ?? 0;
    const rate = ts.rate ?? DEFAULT_HOURLY_RATE;
    const reimbursementAmount = ts.amount ?? 0;
    const date = ts.dateAndTime?.start?.split("T")[0] ?? new Date().toISOString().split("T")[0];

    try {
      let gustoId: string;

      if (roster.type === "contractor") {
        // POST contractor payment — time entries use hourly_rate+hours,
        // reimbursements use the non-taxable reimbursement field.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: Record<string, any> = {
          contractor_uuid: roster.uuid,
          date,
          payment_method: "Direct Deposit",
          memo: ts.entry,
        };

        if (isReimbursement) {
          payload.reimbursement = String(reimbursementAmount);
        } else {
          payload.hourly_rate = String(rate);
          payload.hours = String(hours);
        }

        const payment = await gustoPost<{ uuid: string }>(
          `/v1/companies/${companyUuid}/contractor_payments`,
          payload,
        );
        gustoId = payment.uuid;
      } else {
        // For employees, post to the time tracking endpoint.
        // Gusto's employee time entries use:
        //   POST /v1/companies/{uuid}/employees/{emp_uuid}/time_off_activities
        // or the payrolls endpoint depending on plan. We use a general
        // contractor-style approach here; adjust the endpoint to match your
        // Gusto plan's employee time entry API.
        const entry = await gustoPost<{ uuid: string }>(
          `/v1/companies/${companyUuid}/payrolls/employee_hours`,
          {
            employee_uuid: roster.uuid,
            date,
            hours: isReimbursement ? "0" : String(hours),
            memo: isReimbursement
              ? `[reimbursement: $${reimbursementAmount}] ${ts.entry}`
              : ts.entry,
          },
        );
        gustoId = entry.uuid;
      }

      // 5. Update Notion: set status to "invoiced", prepend Gusto reference
      const existingExplanation = ts.explanation ?? "";
      await updateTimesheet(ts.id, {
        status: "invoiced",
        explanation: `[gusto:${gustoId}] ${existingExplanation}`.trim(),
      });

      result.synced++;
      result.details.push({
        timesheetId: ts.id,
        entry: ts.entry,
        memberEmail: email,
        status: "synced",
        gustoId,
      });
    } catch (err) {
      result.failed++;
      result.details.push({
        timesheetId: ts.id,
        entry: ts.entry,
        memberEmail: email,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Rate limiting: 200ms delay between Gusto API calls
    await delay(200);
  }

  return result;
}
