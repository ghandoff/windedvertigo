"use client";

import { useState, useTransition } from "react";
import { generateReportAction, type ReportData } from "./actions";
import { ReportViewer } from "./report-viewer";

type ReportType = "family_group_sheet" | "ancestor_report" | "descendant_report";

type PersonOption = {
  id: string;
  name: string;
};

export function ReportForm({ persons }: { persons: PersonOption[] }) {
  const [personId, setPersonId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("family_group_sheet");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (!personId) return;
    setError(null);
    startTransition(async () => {
      const result = await generateReportAction(personId, reportType);
      if (result.ok) {
        setReportData(result.data);
      } else {
        setError(result.error);
        setReportData(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* controls — hidden when printing */}
      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <div className="space-y-1">
          <label htmlFor="person-select" className="text-xs font-medium text-muted-foreground">
            person
          </label>
          <select
            id="person-select"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">select a person...</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="report-type" className="text-xs font-medium text-muted-foreground">
            report type
          </label>
          <select
            id="report-type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="family_group_sheet">family group sheet</option>
            <option value="ancestor_report">ancestor report (ahnentafel)</option>
            <option value="descendant_report">descendant report</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!personId || isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "generating..." : "generate report"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 print:hidden">{error}</p>
      )}

      {reportData && <ReportViewer data={reportData} />}
    </div>
  );
}
