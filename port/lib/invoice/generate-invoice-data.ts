/**
 * Invoice generation logic — resolves the timesheet→task→project→org chain
 * and produces structured invoice data + branded HTML.
 *
 * Used by both the preview API route and the send route.
 */

import { getProject } from "@/lib/notion/projects";
import { getOrganization } from "@/lib/notion/organizations";
import { queryWorkItems } from "@/lib/notion/work-items";
import { queryTimesheets } from "@/lib/notion/timesheets";
import { getActiveMembers } from "@/lib/notion/members";
import type { Timesheet, Project, Organization } from "@/lib/notion/types";
import type { Member } from "@/lib/notion/members";
import { brand, typography } from "@/lib/shared/tokens";

// ── types ──────────────────────────────────────────────────

export interface InvoiceLineItem {
  date: string;
  description: string;
  member: string;
  hours: number;
  rate: number;
  amount: number;
  /** Whether this line item is a flat-amount reimbursement. */
  isReimbursement?: boolean;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  project: { id: string; name: string; budgetHours: number | null };
  client: {
    name: string;
    email: string;
    address: string | null;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  totalHours: number;
  /** Total reimbursement amount (flat expenses). */
  totalReimbursements: number;
  timesheetIds: string[];
  warnings: string[];
}

// ── resolve ────────────────────────────────────────────────

/**
 * Fetches all data needed for an invoice: project, org, work items,
 * approved billable timesheets, and members. Returns structured invoice data.
 */
export async function resolveInvoiceData(
  projectId: string,
  startDate: string,
  endDate: string,
): Promise<InvoiceData> {
  // Fetch project + members in parallel
  const [project, members] = await Promise.all([
    getProject(projectId),
    getActiveMembers(),
  ]);

  // Fetch org (if project has one)
  let org: Organization | null = null;
  if (project.organizationIds.length > 0) {
    try {
      org = await getOrganization(project.organizationIds[0]);
    } catch {
      // Org lookup failed — proceed without client details
    }
  }

  // Get all work items for this project to resolve task IDs
  const { data: workItems } = await queryWorkItems(
    { projectId },
    { pageSize: 200 },
  );
  const projectTaskIds = new Set(workItems.map((wi) => wi.id));

  // Fetch approved billable timesheets in the date range
  const { data: timesheets } = await queryTimesheets(
    {
      status: "approved",
      billable: true,
      dateAfter: startDate,
      dateBefore: endDate,
    },
    { pageSize: 200 },
  );

  // Filter to only timesheets linked to this project's work items
  const projectTimesheets = timesheets.filter((ts) =>
    ts.taskIds.some((tid) => projectTaskIds.has(tid)),
  );

  // Check for unlinked approved timesheets in the date range
  const unlinkedCount = timesheets.filter((ts) => ts.taskIds.length === 0).length;

  const warnings: string[] = [];
  if (unlinkedCount > 0) {
    warnings.push(
      `${unlinkedCount} approved billable timesheet${unlinkedCount > 1 ? "s" : ""} in this period have no linked task — they may belong to this project but won't appear on the invoice.`,
    );
  }

  // Build line items
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const { lineItems, nullRateCount } = computeLineItems(
    projectTimesheets,
    memberMap,
  );

  if (nullRateCount > 0) {
    warnings.push(
      `${nullRateCount} entr${nullRateCount > 1 ? "ies have" : "y has"} no rate set — showing $0. Set rates on timesheets before invoicing.`,
    );
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const totalHours = lineItems
    .filter((li) => !li.isReimbursement)
    .reduce((sum, li) => sum + li.hours, 0);
  const totalReimbursements = lineItems
    .filter((li) => li.isReimbursement)
    .reduce((sum, li) => sum + li.amount, 0);

  // Build address from place
  let address: string | null = null;
  if (org?.place) {
    // Place object has a `name` field with the formatted address
    address = (org.place as { name?: string }).name ?? null;
  }

  const invoiceDate = new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + 30);
  const dueDate = due.toISOString().slice(0, 10);

  return {
    invoiceNumber: generateInvoiceNumber(new Date().getFullYear()),
    invoiceDate,
    dueDate,
    periodStart: startDate,
    periodEnd: endDate,
    project: {
      id: project.id,
      name: project.project,
      budgetHours: project.budgetHours,
    },
    client: {
      name: org?.organization ?? "—",
      email: org?.email ?? "",
      address,
    },
    lineItems,
    subtotal,
    total: subtotal, // No tax for consultancy services
    totalHours,
    totalReimbursements,
    timesheetIds: projectTimesheets.map((ts) => ts.id),
    warnings,
  };
}

// ── line items ─────────────────────────────────────────────

function computeLineItems(
  timesheets: Timesheet[],
  memberMap: Map<string, Member>,
): { lineItems: InvoiceLineItem[]; nullRateCount: number } {
  let nullRateCount = 0;

  // Sort by date ascending
  const sorted = [...timesheets].sort((a, b) => {
    const da = a.dateAndTime?.start ?? "";
    const db = b.dateAndTime?.start ?? "";
    return da.localeCompare(db);
  });

  const lineItems: InvoiceLineItem[] = sorted.map((ts) => {
    const isReimbursement = ts.type === "reimbursement";

    // Resolve member name from personIds
    const memberName = ts.personIds
      .map((pid) => memberMap.get(pid)?.name ?? "unknown")
      .join(", ") || "—";

    const date = ts.dateAndTime?.start
      ? new Date(ts.dateAndTime.start).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "—";

    if (isReimbursement) {
      // Flat-amount reimbursement — no hours/rate
      const amount = ts.amount ?? 0;
      return {
        date,
        description: ts.entry || "reimbursement",
        member: memberName,
        hours: 0,
        rate: 0,
        amount,
        isReimbursement: true,
      };
    }

    // Standard time-based entry
    const hours = ts.hours ?? 0;
    const rate = ts.rate ?? 0;
    if (ts.rate === null) nullRateCount++;

    return {
      date,
      description: ts.entry || "untitled entry",
      member: memberName,
      hours,
      rate,
      amount: hours * rate,
    };
  });

  return { lineItems, nullRateCount };
}

// ── invoice number ─────────────────────────────────────────

/**
 * Generates a suggested invoice number: WV-{YYYY}-{NNN}.
 * The number is a suggestion — the user can override it in the UI.
 * Uses timestamp-based incrementing for simplicity.
 */
export function generateInvoiceNumber(year: number): string {
  // Simple sequential based on month + day-of-month to be somewhat unique
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(now.getDate()).padStart(2, "0");
  return `WV-${year}-${month}${seq}`;
}

// ── currency formatter ─────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── HTML builder ───────────────────────────────────────────

/**
 * Builds branded invoice HTML. Used for both on-screen preview (with print
 * styles) and email delivery via Resend.
 */
export function buildInvoiceHtml(data: InvoiceData): string {
  const lineRows = data.lineItems
    .map(
      (li) => li.isReimbursement
        ? `
      <tr style="background:#faf5ff;">
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${li.date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#7c3aed;" colspan="1">${li.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${li.member}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:right;" colspan="2">reimbursement</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right;font-weight:500;">${formatCurrency(li.amount)}</td>
      </tr>`
        : `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${li.date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${li.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${li.member}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right;">${li.hours.toFixed(1)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right;">${formatCurrency(li.rate)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right;font-weight:500;">${formatCurrency(li.amount)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .invoice-container { box-shadow: none !important; border: none !important; max-width: 100% !important; margin: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;font-family:${typography.fontFamily};background:#f9fafb;">
  <div class="invoice-container" style="max-width:800px;margin:32px auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">

    <!-- header -->
    <div style="padding:32px 32px 24px;border-bottom:3px solid ${brand.cadet};">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;">
            <div style="font-size:20px;font-weight:700;color:${brand.cadet};letter-spacing:${typography.letterSpacing};">winded.vertigo</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">San Francisco, CA</div>
            <div style="font-size:12px;color:#6b7280;">garrett@windedvertigo.com</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="font-size:28px;font-weight:700;color:${brand.cadet};letter-spacing:0.05em;">INVOICE</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- meta + client -->
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px;">Bill To</div>
            <div style="font-size:15px;font-weight:600;color:${brand.cadet};">${data.client.name}</div>
            ${data.client.address ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${data.client.address}</div>` : ""}
            ${data.client.email ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${data.client.email}</div>` : ""}
          </td>
          <td style="vertical-align:top;text-align:right;">
            <table style="border-collapse:collapse;margin-left:auto;">
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Invoice No.</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;font-weight:600;">${data.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Date</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;">${formatDateLong(data.invoiceDate)}</td>
              </tr>
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Due Date</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;">${formatDateLong(data.dueDate)}</td>
              </tr>
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Period</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;">${formatDateShort(data.periodStart)} – ${formatDateShort(data.periodEnd)}</td>
              </tr>
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Project</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;">${data.project.name}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- line items -->
    <div style="padding:0 32px 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${brand.cadet};">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:${brand.champagne};text-transform:uppercase;letter-spacing:0.05em;">Date</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:${brand.champagne};text-transform:uppercase;letter-spacing:0.05em;">Description</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:${brand.champagne};text-transform:uppercase;letter-spacing:0.05em;">Team Member</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:${brand.champagne};text-transform:uppercase;letter-spacing:0.05em;">Hours</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:${brand.champagne};text-transform:uppercase;letter-spacing:0.05em;">Rate</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:${brand.champagne};text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
      </table>
    </div>

    <!-- totals -->
    <div style="padding:0 32px 24px;">
      <table style="width:300px;margin-left:auto;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;">Total Hours</td>
          <td style="padding:6px 0;font-size:13px;color:#111827;text-align:right;">${data.totalHours.toFixed(1)}</td>
        </tr>${data.totalReimbursements > 0 ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#7c3aed;">Reimbursements</td>
          <td style="padding:6px 0;font-size:13px;color:#7c3aed;text-align:right;">${formatCurrency(data.totalReimbursements)}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;">Subtotal</td>
          <td style="padding:6px 0;font-size:13px;color:#111827;text-align:right;">${formatCurrency(data.subtotal)}</td>
        </tr>
        <tr style="border-top:2px solid ${brand.cadet};">
          <td style="padding:12px 0 6px;font-size:16px;font-weight:700;color:${brand.cadet};">Total Due</td>
          <td style="padding:12px 0 6px;font-size:16px;font-weight:700;color:${brand.redwood};text-align:right;">${formatCurrency(data.total)}</td>
        </tr>
      </table>
    </div>

    <!-- payment terms -->
    <div style="padding:20px 32px;background:${brand.champagne}15;border-top:1px solid #e5e7eb;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px;">Payment Terms</div>
      <div style="font-size:13px;color:#374151;">Net 30 — payment due by ${formatDateLong(data.dueDate)}</div>
    </div>

    <!-- footer -->
    <div style="padding:16px 32px;background:${brand.cadet};text-align:center;">
      <div style="font-size:11px;color:${brand.champagne};opacity:0.85;">winded.vertigo LLC · San Francisco, CA · windedvertigo.com</div>
    </div>
  </div>
</body>
</html>`;
}
