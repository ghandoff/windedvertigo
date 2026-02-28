"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";

interface GrantFormProps {
  orgs: { id: string; name: string }[];
  packs: { id: string; title: string }[];
}

export default function EntitlementGrantForm({ orgs, packs }: GrantFormProps) {
  const router = useRouter();
  const [orgId, setOrgId] = useState("");
  const [packCacheId, setPackCacheId] = useState("");
  const [trialDays, setTrialDays] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !packCacheId) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/admin/entitlements"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Session 11: include trialDays if set (free trial grant)
        body: JSON.stringify({
          orgId,
          packCacheId,
          ...(trialDays ? { trialDays: parseInt(trialDays, 10) } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "failed to grant entitlement");
      }

      const data = await res.json();
      const trialNote = data.expiresAt
        ? ` (trial expires ${new Date(data.expiresAt).toLocaleDateString("en-GB")})`
        : "";
      setMessage(`entitlement granted${trialNote}.`);
      setOrgId("");
      setPackCacheId("");
      setTrialDays("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-cadet/10 bg-champagne/30 p-5 mb-8">
      <h2 className="text-sm font-semibold text-cadet/80 mb-3">grant entitlement</h2>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label htmlFor="ent-org" className="block text-xs text-cadet/50 mb-1">
            organisation
          </label>
          <select
            id="ent-org"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
          >
            <option value="">select…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-48">
          <label htmlFor="ent-pack" className="block text-xs text-cadet/50 mb-1">
            pack
          </label>
          <select
            id="ent-pack"
            value={packCacheId}
            onChange={(e) => setPackCacheId(e.target.value)}
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
          >
            <option value="">select…</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="w-28">
          <label htmlFor="ent-trial" className="block text-xs text-cadet/50 mb-1">
            trial days
          </label>
          <input
            id="ent-trial"
            type="number"
            min="0"
            placeholder="—"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !orgId || !packCacheId}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 transition-all"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          {loading ? "granting…" : "grant"}
        </button>
      </div>

      {message && <p className="text-sm mt-3 text-sienna">{message}</p>}
      {error && <p className="text-sm mt-3 text-redwood">{error}</p>}
    </form>
  );
}

