'use client';

/**
 * Wave 6.0 Data Hub — Export panel.
 *
 * Shallow wrap of /pcs/export body so it can be rendered as a tab inside
 * /pcs/data. No refactor — same DOCX / CSV export UX.
 */

import { useState } from 'react';
import { useToast } from '@/components/Toast';

const CSV_EXPORTS = [
  { type: 'documents', label: 'PCS Documents', description: 'All documents with classification, status, and dates' },
  { type: 'claims', label: 'Claims', description: 'All claims with bucket, status, evidence count' },
  { type: 'evidence', label: 'Evidence Library', description: 'All evidence items with SQR scores and ingredients' },
  { type: 'requests', label: 'Requests', description: 'All PCS requests with status and dates' },
];

const DOCX_REPORTS = [
  {
    type: 'claims',
    label: 'Claims Summary Report',
    description: 'All claims grouped by evidence tier (3A/3B/3C) with linked evidence, SQR status, and evidence gap analysis',
    icon: (
      <svg className="w-5 h-5 text-pacific-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
  },
  {
    type: 'evidence',
    label: 'Evidence Library Report',
    description: 'Complete evidence inventory grouped by ingredient with SQR scores, review status, and unreviewed items list',
    icon: (
      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    type: 'full',
    label: 'Full PCS Report',
    description: 'Comprehensive report: portfolio overview, claims by tier, evidence gaps, open requests, and prioritized recommendations',
    icon: (
      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
];

export default function ExportPanel() {
  const toast = useToast();
  const [generating, setGenerating] = useState(null);

  function handleCsvDownload(type) {
    window.open(`/api/pcs/export?type=${type}`, '_blank');
  }

  async function handleDocxDownload(type) {
    setGenerating(type);
    try {
      const res = await fetch(`/api/pcs/export/docx?type=${type}`);
      if (!res.ok) throw new Error('Generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `pcs-report-${type}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DOCX download error:', err);
      toast.error('Failed to generate report. Click the button to try again.');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export & Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate Word reports or download raw data as CSV.</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Word Reports</h2>
        <p className="text-sm text-gray-500">Branded, formatted reports ready to share with stakeholders. Opens in Microsoft Word or Google Docs.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DOCX_REPORTS.map(report => (
            <div key={report.type} className="border border-gray-200 rounded-lg p-5 space-y-3 bg-white hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{report.icon}</div>
                <div>
                  <h3 className="font-medium text-gray-900">{report.label}</h3>
                  <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{report.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleDocxDownload(report.type)}
                disabled={generating !== null}
                className="w-full px-4 py-2.5 bg-pacific-600 text-white rounded-md text-sm font-medium hover:bg-pacific-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {generating === report.type ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download .docx
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Raw Data (CSV)</h2>
        <p className="text-sm text-gray-500">Database tables for spreadsheet analysis. Opens in Excel or Google Sheets.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CSV_EXPORTS.map(exp => (
            <div key={exp.type} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4 bg-white">
              <div>
                <h3 className="font-medium text-gray-900 text-sm">{exp.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{exp.description}</p>
              </div>
              <button
                onClick={() => handleCsvDownload(exp.type)}
                className="shrink-0 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                CSV
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
