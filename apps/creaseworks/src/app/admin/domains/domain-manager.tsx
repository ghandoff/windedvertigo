"use client";

/**
 * Domain blocklist manager — client component with CRUD operations.
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { useState } from "react";
import { apiUrl } from "@/lib/api-url";

interface BlockedDomain {
  id: string;
  domain: string;
  enabled: boolean;
  reason: string | null;
  created_at: string;
}

export default function DomainBlocklistManager({
  initialDomains,
}: {
  initialDomains: BlockedDomain[];
}) {
  const [domains, setDomains] = useState<BlockedDomain[]>(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [newReason, setNewReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newDomain.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/admin/domains"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain, reason: newReason || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "failed to add");

      const data = await res.json();
      setDomains((prev) => [...prev, data.domain].sort((a, b) => a.domain.localeCompare(b.domain)));
      setNewDomain("");
      setNewReason("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await fetch(apiUrl("/api/admin/domains"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      setDomains((prev) =>
        prev.map((d) => (d.id === id ? { ...d, enabled } : d)),
      );
    } catch {
      // silent — could add toast
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("remove this domain from the blocklist?")) return;
    try {
      await fetch(apiUrl("/api/admin/domains"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setDomains((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // silent
    }
  }

  return (
    <div>
      {/* add form */}
      <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-5 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-3">add domain</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="e.g. example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="rounded-lg border border-cadet/15 px-3 py-2 text-sm flex-1 min-w-48 outline-none focus:ring-2"
            aria-label="domain to block"
          />
          <input
            type="text"
            placeholder="reason (optional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            className="rounded-lg border border-cadet/15 px-3 py-2 text-sm flex-1 min-w-48 outline-none focus:ring-2"
            aria-label="reason for blocking"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newDomain.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 transition-all"
            style={{ backgroundColor: "var(--wv-redwood)" }}
          >
            {loading ? "adding…" : "add"}
          </button>
        </div>
        {error && <p id="domain-block-error" className="text-sm mt-2 text-redwood">{error}</p>}
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cadet/10 text-left text-xs text-cadet/50">
              <th className="pb-2 pr-4">domain</th>
              <th className="pb-2 pr-4">enabled</th>
              <th className="pb-2 pr-4">reason</th>
              <th className="pb-2 pr-4">added</th>
              <th className="pb-2">actions</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id} className="border-b border-cadet/5">
                <td className="py-2 pr-4 font-mono text-xs">{d.domain}</td>
                <td className="py-2 pr-4">
                  <button
                    onClick={() => handleToggle(d.id, !d.enabled)}
                    className="text-xs px-2 py-0.5 rounded-full transition-all"
                    style={{
                      backgroundColor: d.enabled
                        ? "rgba(177, 80, 67, 0.1)"
                        : "rgba(39, 50, 72, 0.06)",
                      color: d.enabled ? "var(--wv-redwood)" : "var(--wv-cadet)",
                      opacity: d.enabled ? 1 : 0.5,
                    }}
                  >
                    {d.enabled ? "blocking" : "disabled"}
                  </button>
                </td>
                <td className="py-2 pr-4 text-cadet/50 text-xs">
                  {d.reason || "—"}
                </td>
                <td className="py-2 pr-4 text-cadet/50 text-xs">
                  {d.created_at
                    ? new Date(d.created_at).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td className="py-2">
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-xs text-cadet/40 hover:text-redwood transition-colors"
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {domains.length === 0 && (
          <p className="text-sm text-cadet/40 py-4">no blocked domains.</p>
        )}
      </div>
    </div>
  );
}

