"use client";

/**
 * InvoiceGenerator — interactive form for generating, previewing, and
 * sending invoices. Selects a project + month, fetches preview data,
 * and provides send/print actions.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Printer, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { InvoicePreview } from "./invoice-preview";

interface ProjectOption {
  id: string;
  name: string;
}

interface InvoiceLineItem {
  date: string;
  description: string;
  member: string;
  hours: number;
  rate: number;
  amount: number;
  isReimbursement?: boolean;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  project: { id: string; name: string; budgetHours: number | null };
  client: { name: string; email: string; address: string | null };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  totalHours: number;
  totalReimbursements: number;
  timesheetIds: string[];
  warnings: string[];
}

interface Props {
  projects: ProjectOption[];
  initialProjectId?: string;
  initialMonth?: string;
}

function getPreviousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthToDateRange(month: string): { startDate: string; endDate: string } {
  const [year, m] = month.split("-").map(Number);
  const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
  // Last day of month
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

export function InvoiceGenerator({ projects, initialProjectId, initialMonth }: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [month, setMonth] = useState(initialMonth ?? getPreviousMonth());
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceHtml, setInvoiceHtml] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [generating, startGenerate] = useTransition();
  const [sending, startSend] = useTransition();
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleGenerate() {
    if (!projectId) return;
    setErrorMsg("");
    setSent(false);

    startGenerate(async () => {
      try {
        const { startDate, endDate } = monthToDateRange(month);
        const res = await fetch("/api/invoices/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, startDate, endDate }),
        });
        if (!res.ok) {
          const data = await res.json();
          setErrorMsg(data.error ?? "Failed to generate invoice preview");
          return;
        }
        const data: InvoiceData & { html?: string } = await res.json();
        setInvoiceData(data);
        setInvoiceNumber(data.invoiceNumber);
        setRecipientEmail(data.client.email);

        // Use server-generated HTML from the API response
        setInvoiceHtml(data.html ?? "");
      } catch {
        setErrorMsg("Network error — check your connection and try again");
      }
    });
  }

  function handleSend() {
    if (!invoiceData || !invoiceNumber || !recipientEmail) return;
    setErrorMsg("");

    startSend(async () => {
      try {
        const { startDate, endDate } = monthToDateRange(month);
        const res = await fetch("/api/invoices/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            startDate,
            endDate,
            invoiceNumber,
            recipientEmail,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setErrorMsg(data.error ?? "Failed to send invoice");
          return;
        }
        setSent(true);
        router.refresh();
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
            <FileText className="h-4 w-4" />
            generate invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* project picker */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">project</label>
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setInvoiceData(null); setSent(false); }}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                <option value="">select a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* month picker */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">period</label>
              <input
                type="month"
                value={month}
                onChange={(e) => { setMonth(e.target.value); setInvoiceData(null); setSent(false); }}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              />
            </div>

            {/* generate button */}
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={!projectId || generating}
                className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {generating ? "generating..." : "generate preview"}
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
      {invoiceData && invoiceData.warnings.length > 0 && (
        <div className="space-y-2 no-print">
          {invoiceData.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 text-yellow-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* invoice details + actions */}
      {invoiceData && invoiceData.lineItems.length > 0 && !sent && (
        <Card className="no-print">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">invoice number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => {
                    const newNumber = e.target.value;
                    setInvoiceNumber(newNumber);
                    // Update preview HTML with new number via string replacement
                    if (invoiceHtml && invoiceNumber) {
                      setInvoiceHtml(invoiceHtml.replaceAll(invoiceNumber, newNumber));
                    }
                  }}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">send to</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  placeholder="client@example.com"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleSend}
                  disabled={!recipientEmail || !invoiceNumber || sending}
                  className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending ? "sending..." : "send invoice"}
                </button>
                <button
                  onClick={handlePrint}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  print
                </button>
              </div>
            </div>

            {/* summary line */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3 flex-wrap">
              <span>{invoiceData.lineItems.length} line items</span>
              <span>·</span>
              <span>{invoiceData.totalHours.toFixed(1)} hours</span>
              {invoiceData.totalReimbursements > 0 && (
                <>
                  <span>·</span>
                  <span className="text-purple-600">{formatCurrency(invoiceData.totalReimbursements)} reimbursements</span>
                </>
              )}
              <span>·</span>
              <span className="font-medium text-foreground">{formatCurrency(invoiceData.total)}</span>
              {invoiceData.project.budgetHours && (
                <>
                  <span>·</span>
                  <span>budget: {invoiceData.project.budgetHours}h</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* empty state */}
      {invoiceData && invoiceData.lineItems.length === 0 && (
        <Card className="no-print">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">no approved billable timesheets found</p>
            <p className="text-xs mt-1">check that timesheets are approved, billable, and linked to work items in this project</p>
          </CardContent>
        </Card>
      )}

      {/* sent confirmation */}
      {sent && (
        <Card className="no-print border-green-200">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-green-500" />
            <p className="text-sm font-medium">invoice sent</p>
            <p className="text-xs text-muted-foreground mt-1">
              {invoiceNumber} sent to {recipientEmail} · {invoiceData?.timesheetIds.length} timesheets marked as invoiced
            </p>
            <button
              onClick={() => { setSent(false); setInvoiceData(null); }}
              className="mt-4 text-xs text-primary hover:underline"
            >
              generate another invoice
            </button>
          </CardContent>
        </Card>
      )}

      {/* invoice preview */}
      {invoiceHtml && !sent && (
        <InvoicePreview html={invoiceHtml} />
      )}
    </div>
  );
}
