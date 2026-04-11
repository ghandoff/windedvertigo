"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function GedcomImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ personsImported: number; familiesImported: number } | null>(null);
  const router = useRouter();

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();

    setImporting(false);
    setResult(data);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        import gedcom
      </h3>
      <input
        ref={fileRef}
        type="file"
        accept=".ged,.gedcom"
        className="w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary truncate"
      />
      <button
        onClick={handleImport}
        disabled={importing}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {importing ? "importing..." : "import"}
      </button>
      {result && (
        <p className="text-xs text-muted-foreground">
          imported {result.personsImported} people and {result.familiesImported} families
        </p>
      )}
    </div>
  );
}
