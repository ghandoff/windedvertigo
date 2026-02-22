"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      const res = await fetch("/api/admin/entitlements", {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="org" className="block text-xs text-cadet/60 mb-1">
          organisation
        </label>
        <select
          id="org"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="w-full rounded-lg border border-cadet/20 bg-white px-3 py-2 text-sm"
          required
        >
          <option value="">select an organisation</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pack" className="block text-xs text-cadet/60 mb-1">
          pack
        </label>
        <select
          id="pack"
          value={packCacheId}
          onChange={(e) => setPackCacheId(e.target.value)}
          className="w-full rounded-lg border border-cadet/20 bg-white px-3 py-2 text-sm"
          required
        >
          <option value="">select a pack</option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* Session 11: optional trial days for free trial grants */}
      <div>
        <label htmlFor="trialDays" className="block text-xs text-cadet/60 mb-1">
          trial days <span className="text-cadet/40">(optional — leave blank for perpetual)</span>
        </label>
        <input
          id="trialDays"
          type="number"
          min="1"
          max="365"
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
          placeholder="e.g. 14"
          className="w-full rounded-lg border border-cadet/20 bg-white px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !orgId || !packCacheId}
        className="rounded-lg bg-redwood px-4 py-2 text-sm text-white font-medium hover:bg-sienna transition-colors disabled:opacity-50"
      >
        {loading ? "granting…" : "grant entitlement"}
      </button>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-redwood">{error}</p>}
    </form>
  );
}
