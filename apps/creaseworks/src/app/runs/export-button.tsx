"use client";

/**
 * Export dropdown button for the runs page.
 *
 * Session 12: run export / reporting.
 *
 * Renders a button that opens a small dropdown with CSV and PDF options.
 * Each option triggers a download via the /api/runs/export endpoint.
 * Mobile-friendly: full-width on small screens, 44px touch targets.
 */

import { useState, useRef, useEffect } from "react";

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  async function handleExport(format: "csv" | "pdf") {
    setDownloading(format);
    setOpen(false);

    try {
      const res = await fetch(`/api/runs/export?format=${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `export failed (${res.status})`);
      }

      // trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ||
        `creaseworks-runs.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "export failed");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={downloading !== null}
        className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80 active:scale-[0.98] disabled:opacity-40"
        style={{
          borderColor: "rgba(39, 50, 72, 0.15)",
          color: "var(--wv-cadet)",
          minHeight: 44,
        }}
      >
        {downloading ? `exporting ${downloading}…` : "export"}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-10 rounded-xl border shadow-lg overflow-hidden"
          style={{
            backgroundColor: "var(--wv-white)",
            borderColor: "rgba(39, 50, 72, 0.1)",
            minWidth: 180,
          }}
        >
          <button
            onClick={() => handleExport("csv")}
            className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-gray-50 flex items-center gap-2"
            style={{ color: "var(--wv-cadet)", minHeight: 44 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="flex-shrink-0"
            >
              <path
                d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
              <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M5 9h6M5 11h4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            download CSV
          </button>
          <div
            style={{
              height: 1,
              backgroundColor: "rgba(39, 50, 72, 0.06)",
            }}
          />
          <button
            onClick={() => handleExport("pdf")}
            className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-gray-50 flex items-center gap-2"
            style={{ color: "var(--wv-cadet)", minHeight: 44 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="flex-shrink-0"
            >
              <path
                d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
              <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.2" />
              <text
                x="5"
                y="12.5"
                fontSize="5"
                fontWeight="bold"
                fill="currentColor"
              >
                PDF
              </text>
            </svg>
            download PDF report
          </button>
        </div>
      )}
    </div>
  );
}
