/**
 * Reimbursement invoice — generates a printable expense reimbursement
 * invoice for collective members who submit outside of Gusto.
 *
 * Produces a branded PDF-ready HTML document listing approved reimbursement
 * entries with their amounts, addressed from the member to winded.vertigo LLC.
 */

import { brand, typography } from "@/lib/shared/tokens";

// ── types ───────────────────────────────────────────���──────

export interface ReimbursementLineItem {
  date: string;
  description: string;
  member: string;
  amount: number;
}

export interface ReimbursementInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  submitter: {
    name: string;
    email: string;
  };
  lineItems: ReimbursementLineItem[];
  total: number;
  timesheetIds: string[];
}

// ── helpers ────────────────────────────────────────────────

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

export function buildReimbursementInvoiceHtml(
  data: ReimbursementInvoiceData,
): string {
  const lineRows = data.lineItems
    .map(
      (li) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${li.date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${li.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right;font-weight:500;">${formatCurrency(li.amount)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reimbursement ${data.invoiceNumber}</title>
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
    <div style="padding:32px 32px 24px;border-bottom:3px solid #7c3aed;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;">
            <div style="font-size:20px;font-weight:700;color:${brand.cadet};letter-spacing:${typography.letterSpacing};">winded.vertigo</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">San Francisco, CA</div>
            <div style="font-size:12px;color:#6b7280;">garrett@windedvertigo.com</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="font-size:28px;font-weight:700;color:#7c3aed;letter-spacing:0.05em;">REIMBURSEMENT</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- meta + submitter -->
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px;">Submitted By</div>
            <div style="font-size:15px;font-weight:600;color:${brand.cadet};">${data.submitter.name}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:2px;">${data.submitter.email}</div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <table style="border-collapse:collapse;margin-left:auto;">
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Reference</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;font-weight:600;">${data.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Date</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;">${formatDateLong(data.invoiceDate)}</td>
              </tr>
              <tr>
                <td style="padding:3px 16px 3px 0;font-size:12px;color:#9ca3af;text-align:right;">Period</td>
                <td style="padding:3px 0;font-size:13px;color:#111827;">${formatDateShort(data.periodStart)} \u2013 ${formatDateShort(data.periodEnd)}</td>
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
          <tr style="background:#7c3aed;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#f5f3ff;text-transform:uppercase;letter-spacing:0.05em;">Date</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#f5f3ff;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#f5f3ff;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
      </table>
    </div>

    <!-- total -->
    <div style="padding:0 32px 24px;">
      <table style="width:250px;margin-left:auto;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;">${data.lineItems.length} item${data.lineItems.length !== 1 ? "s" : ""}</td>
          <td style="padding:6px 0;font-size:13px;text-align:right;"></td>
        </tr>
        <tr style="border-top:2px solid #7c3aed;">
          <td style="padding:12px 0 6px;font-size:16px;font-weight:700;color:#7c3aed;">Total Reimbursement</td>
          <td style="padding:12px 0 6px;font-size:16px;font-weight:700;color:${brand.redwood};text-align:right;">${formatCurrency(data.total)}</td>
        </tr>
      </table>
    </div>

    <!-- note -->
    <div style="padding:20px 32px;background:#f5f3ff;border-top:1px solid #e5e7eb;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin-bottom:8px;">Reimbursement Note</div>
      <div style="font-size:13px;color:#374151;">These expenses have been approved in the w.v timesheet system. Please reimburse via preferred payment method or Gusto contractor payment.</div>
    </div>

    <!-- footer -->
    <div style="padding:16px 32px;background:${brand.cadet};text-align:center;">
      <div style="font-size:11px;color:${brand.champagne};opacity:0.85;">winded.vertigo LLC \u00b7 San Francisco, CA \u00b7 windedvertigo.com</div>
    </div>
  </div>
</body>
</html>`;
}
