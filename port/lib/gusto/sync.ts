/**
 * Gusto timesheet sync — pushes approved Notion timesheets into the open
 * Gusto payroll for the matching pay period.
 *
 * Flow:
 *   1. Query approved, un-synced Notion timesheets
 *   2. Group by pay-period month and by person
 *   3. Build email → Gusto employee map (employees only — no contractors)
 *   4. For each person+month group:
 *        a. Find the unprocessed Gusto payroll for that month
 *        b. Skip salaried employees (payment_unit !== "Hour")
 *        c. Aggregate total hours
 *        d. PUT the payroll with updated Regular hours
 *        e. Mark Notion timesheets as "invoiced"
 *
 * Already-synced guard: timesheet.explanation starts with "[gusto:"
 */

import { queryTimesheets, updateTimesheet } from "@/lib/notion/timesheets";
import { getActiveMembers, type Member } from "@/lib/notion/members";
import {
  listEmployees,
  findOpenPayroll,
  putEmployeeHours,
  type GustoEmployee,
} from "./client";

const DEFAULT_JOB_UUID = ""; // fallback — prefer job UUID from employee record

// ── Types ──────────────────────────────────────────────────

export interface SyncDetail {
  timesheetId: string;
  entry: string;
  memberEmail: string;
  status: "synced" | "skipped" | "failed" | "unmapped";
  gustoPayrollUuid?: string;
  error?: string;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  failed: number;
  unmapped: number;
  details: SyncDetail[];
}

interface RosterEntry {
  uuid: string;
  jobUuid: string;
  paymentUnit: "Hour" | "Week" | "Month" | "Year" | "Paycheck";
}

// ── Helpers ────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** YYYY-MM from an ISO date string — used as the pay-period bucket key. */
function yearMonth(dateStr: string): string {
  return dateStr.slice(0, 7); // "2026-04"
}

/**
 * Build a lowercase-email → RosterEntry map from the Gusto employee list.
 * Uses work_email (falling back to email).
 */
function buildRosterMap(employees: GustoEmployee[]): Map<string, RosterEntry> {
  const map = new Map<string, RosterEntry>();
  for (const emp of employees) {
    const email = (emp.work_email ?? emp.email ?? "").toLowerCase();
    if (!email) continue;
    const primaryJob = emp.jobs?.[0];
    map.set(email, {
      uuid: emp.uuid,
      jobUuid: primaryJob?.uuid ?? DEFAULT_JOB_UUID,
      paymentUnit: (primaryJob?.payment_unit ?? "Month") as RosterEntry["paymentUnit"],
    });
  }
  return map;
}

function buildMemberIdMap(members: Member[]): Map<string, Member> {
  const map = new Map<string, Member>();
  for (const m of members) map.set(m.id, m);
  return map;
}

// ── Core sync ──────────────────────────────────────────────

export async function runGustoSync(): Promise<SyncResult> {
  const companyUuid = process.env.GUSTO_COMPANY_UUID;
  if (!companyUuid) throw new Error("[gusto] Missing GUSTO_COMPANY_UUID");

  // 1. Fetch approved timesheets, skip already-synced
  const { data: timesheets } = await queryTimesheets(
    { status: "approved" },
    { pageSize: 200 },
  );

  const pending = timesheets.filter(
    (ts) => !ts.explanation?.startsWith("[gusto:"),
  );
  const skippedCount = timesheets.length - pending.length;

  if (pending.length === 0) {
    return { synced: 0, skipped: skippedCount, failed: 0, unmapped: 0, details: [] };
  }

  // 2. Build lookup maps
  const members = await getActiveMembers();
  const memberIdMap = buildMemberIdMap(members);
  const employees = await listEmployees(companyUuid);
  const rosterMap = buildRosterMap(employees);

  // 3. Group pending timesheets by [yearMonth]-[memberEmail]
  //    Key: "2026-04::payton@windedvertigo.com"
  const groups = new Map<
    string,
    { roster: RosterEntry; email: string; tsIds: string[]; totalHours: number }
  >();

  const result: SyncResult = {
    synced: 0,
    skipped: skippedCount,
    failed: 0,
    unmapped: 0,
    details: [],
  };

  for (const ts of pending) {
    const personId = ts.personIds[0];
    const member = personId ? memberIdMap.get(personId) : undefined;

    if (!member) {
      result.unmapped++;
      result.details.push({
        timesheetId: ts.id,
        entry: ts.entry,
        memberEmail: "",
        status: "unmapped",
        error: `No member for personId ${personId ?? "(none)"}`,
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
        error: `${member.name} (${email}) not found in Gusto roster`,
      });
      continue;
    }

    // Skip salaried employees — Gusto pays them automatically
    if (roster.paymentUnit !== "Hour") {
      result.skipped++;
      result.details.push({
        timesheetId: ts.id,
        entry: ts.entry,
        memberEmail: email,
        status: "skipped",
        error: `${member.name} is salaried (${roster.paymentUnit}) — no hours to push`,
      });
      continue;
    }

    const date = ts.dateAndTime?.start?.split("T")[0]
      ?? new Date().toISOString().split("T")[0];
    const month = yearMonth(date);
    const groupKey = `${month}::${email}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { roster, email, tsIds: [], totalHours: 0 });
    }
    const group = groups.get(groupKey)!;
    group.tsIds.push(ts.id);
    group.totalHours += (ts.hours ?? 0) + (ts.minutes ?? 0) / 60;
  }

  // 4. Push each group to Gusto
  for (const [groupKey, group] of groups) {
    const [month] = groupKey.split("::");
    const dateStr = `${month}-01`;

    try {
      const payroll = await findOpenPayroll(companyUuid, dateStr);

      if (!payroll) {
        for (const tsId of group.tsIds) {
          result.failed++;
          result.details.push({
            timesheetId: tsId,
            entry: "",
            memberEmail: group.email,
            status: "failed",
            error: `No open payroll found for ${month}`,
          });
        }
        continue;
      }

      // PUT hours into the payroll
      await putEmployeeHours(
        companyUuid,
        payroll.uuid,
        group.roster.uuid,
        group.roster.jobUuid,
        group.totalHours,
      );

      // Mark Notion timesheets as invoiced
      for (const tsId of group.tsIds) {
        await updateTimesheet(tsId, {
          status: "invoiced",
          explanation: `[gusto:${payroll.uuid}] pushed ${group.totalHours.toFixed(2)}h for ${month}`,
        });
        result.synced++;
        result.details.push({
          timesheetId: tsId,
          entry: "",
          memberEmail: group.email,
          status: "synced",
          gustoPayrollUuid: payroll.uuid,
        });
        await delay(100);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      for (const tsId of group.tsIds) {
        result.failed++;
        result.details.push({
          timesheetId: tsId,
          entry: "",
          memberEmail: group.email,
          status: "failed",
          error,
        });
      }
    }

    await delay(300); // rate limiting between groups
  }

  return result;
}
