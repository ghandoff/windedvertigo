"use client";

/**
 * ReimbursementGenerator — interactive form for generating and printing
 * personal reimbursement invoices. Fetches approved reimbursement entries
 * for the logged-in user within a date range and renders a printable invoice.
 *
 * Note: The HTML preview uses dangerouslySetInnerHTML for the server-generated
 * invoice template. This is safe because the HTML is generated entirely on our
 * server (not from user input) — the same pattern used by the main invoice
 * generator component (invoice-generator.tsx / invoice-preview.tsx).
 */

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Receipt,
  Printer,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface ReimbursementLineItem {
  date: string;
  description: string;
  member: string;
  amount: number;
}

interface ReimbursementData {
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  submitter: { name: string; email: string };
  lineItems: ReimbursementLineItem[];
  total: number;
  timesheetIds: string[];
  html: string;
  warnings?: string[];
}

interface Props {
  userName: string;
  userEmail: string;
}

function getPreviousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthToDateRange(month: string): { startDate: string; endDate: string } {
  const [year, m] = month.split("-").map(Number);
  const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const endDate = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function ReimbursementGenerator({ userName, userEmail }: Props) {
  const [month, setMonth] = useState(getPreviousMonth());
  const [data, setData] = useState<ReimbursementData | null>(null);
  const [generating, startGenerate] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");

  function handleGenerate() {
    setErrorMsg("");
    startGenerate(async () => {
      try {
        const { startDate, endDate } = monthToDateRange(month);
        const res = await fetch("/api/invoices/reimbursement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate, endDate }),
        });
        if (!res.ok) {
          const err = await res.json();
          setErrorMsg(err.error ?? "Failed to generate reimbursement invoice");
          return;
        }
        const result: ReimbursementData = await res.json();
        setData(result);
      } catch {
        setErrorMsg("Network error — check your connection and try again");
      }
    });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* form */}
      <Card className="no-print">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            reimbursement invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            generates a printable invoice of your approved reimbursement entries.
            create reimbursement entries in Notion with type = &quot;reimbursement&quot; and
            set the amount. once approved, they&apos;ll appear here.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">submitter</label>
              <div className="rounded-md border px-3 py-2 text-sm bg-muted/50 text-muted-foreground">
                {userName || userEmail}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">period</label>
              <input
                type="month"
                value={month}
                onChange={(e) => { setMonth(e.target.value); setData(null); }}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                {generating ? "generating..." : "generate"}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {/* warnings */}
      {data?.warnings?.map((w, i) => (
        <div key={i} className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 text-yellow-700 text-sm no-print">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {w}
        </div>
      ))}

      {/* summary + actions */}
      {data && data.lineItems.length > 0 && (
        <Card className="no-print">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{data.lineItems.length} reimbursement{data.lineItems.length !== 1 ? "s" : ""}</span>
                <span>&middot;</span>
                <span className="font-medium text-purple-600">{formatCurrency(data.total)}</span>
              </div>
              <button
                onClick={handlePrint}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                print / save PDF
              </button>
            </div>

            {/* line items preview */}
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-purple-50">
                    <th className="text-left text-xs font-medium text-purple-700 px-4 py-2">date</th>
                    <th className="text-left text-xs font-medium text-purple-700 px-4 py-2">description</th>
                    <th className="text-right text-xs font-medium text-purple-700 px-4 py-2">amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lineItems.map((li, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{li.date}</td>
                      <td className="px-4 py-2 text-sm">{li.description}</td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums font-medium">{formatCurrency(li.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* empty state */}
      {data && data.lineItems.length === 0 && (
        <Card className="no-print">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">no approved reimbursements found</p>
            <p className="text-xs mt-1">
              create entries in Notion with type = &quot;reimbursement&quot;, set the amount,
              and make sure they&apos;re approved before generating an invoice.
            </p>
          </CardContent>
        </Card>
      )}

      {/* printable invoice — HTML is generated server-side from trusted data */}
      {data?.html && (
        <div
          className="print:block"
          dangerouslySetInnerHTML={{ __html: data.html }}
        />
      )}
    </div>
  );
}
