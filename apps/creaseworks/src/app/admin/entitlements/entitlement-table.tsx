"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";

interface Entitlement {
  id: string;
  org_id: string;
  org_name: string;
  pack_cache_id: string;
  pack_title: string;
  granted_at: string | null;
  revoked_at: string | null;
}

export default function EntitlementTable({
  entitlements,
}: {
  entitlements: Entitlement[];
}) {
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(e: Entitlement) {
    if (!confirm(`revoke "${e.pack_title}" from ${e.org_name}?`)) return;
    setRevoking(e.id);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/entitlements"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: e.org_id, packCacheId: e.pack_cache_id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "failed to revoke entitlement");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRevoking(null);
    }
  }

  if (entitlements.length === 0) {
    return <p className="text-sm text-cadet/40">no entitlements granted yet.</p>;
  }

  return (
    <>
      {error && <p className="text-sm text-redwood mb-3">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cadet/10 text-left text-xs text-cadet/50">
              <th className="pb-2 pr-4">organisation</th>
              <th className="pb-2 pr-4">pack</th>
              <th className="pb-2 pr-4">granted</th>
              <th className="pb-2 pr-4">status</th>
              <th className="pb-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {entitlements.map((e) => {
              const isActive = !e.revoked_at;
              return (
                <tr key={e.id} className="border-b border-cadet/5">
                  <td className="py-2 pr-4">{e.org_name}</td>
                  <td className="py-2 pr-4">{e.pack_title}</td>
                  <td className="py-2 pr-4 text-cadet/50">
                    {e.granted_at
                      ? new Date(e.granted_at).toLocaleDateString("en-GB")
                      : "\u2014"}
                  </td>
                  <td className="py-2 pr-4">
                    {isActive ? (
                      <span className="text-green-700">active</span>
                    ) : (
                      <span className="text-redwood">revoked</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(e)}
                        disabled={revoking === e.id}
                        className="text-xs text-redwood hover:text-sienna transition-colors disabled:opacity-50"
                      >
                        {revoking === e.id ? "revoking\u2026" : "revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

