"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";

interface Invite {
  id: string;
  email: string;
  tier: string;
  note: string | null;
  invited_by_email?: string;
  invited_at: string;
  accepted_at: string | null;
  expires_at: string | null;
}

interface Props {
  invites: Invite[];
  showRevoke?: boolean;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InviteTable({ invites, showRevoke = false }: Props) {
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(inviteId: string) {
    if (!confirm("revoke this invite?")) return;
    setRevoking(inviteId);
    try {
      await fetch(apiUrl("/api/admin/invites"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      router.refresh();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="rounded-xl border border-cadet/10 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cadet/5 text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-cadet/40 uppercase tracking-wide">
              email
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold text-cadet/40 uppercase tracking-wide">
              tier
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold text-cadet/40 uppercase tracking-wide hidden sm:table-cell">
              note
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold text-cadet/40 uppercase tracking-wide">
              {showRevoke ? "invited" : "accepted"}
            </th>
            {showRevoke && (
              <th className="px-4 py-2.5 text-xs font-semibold text-cadet/40 uppercase tracking-wide w-20" />
            )}
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-cadet/5 last:border-0"
            >
              <td className="px-4 py-2.5 text-cadet font-medium truncate max-w-[200px]">
                {inv.email}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`text-[10px] font-semibold tracking-wide uppercase px-1.5 py-px rounded-full ${
                    inv.tier === "practitioner"
                      ? "bg-sienna/10 text-sienna"
                      : "bg-cadet/5 text-cadet/50"
                  }`}
                >
                  {inv.tier}
                </span>
              </td>
              <td className="px-4 py-2.5 text-cadet/40 truncate max-w-[160px] hidden sm:table-cell">
                {inv.note ?? "\u2014"}
              </td>
              <td className="px-4 py-2.5 text-cadet/40 whitespace-nowrap">
                {showRevoke
                  ? formatDate(inv.invited_at)
                  : inv.accepted_at
                    ? formatDate(inv.accepted_at)
                    : "\u2014"}
                {inv.expires_at && (
                  <span className="text-xs text-cadet/25 ml-1">
                    (exp {formatDate(inv.expires_at)})
                  </span>
                )}
              </td>
              {showRevoke && (
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    disabled={revoking === inv.id}
                    onClick={() => handleRevoke(inv.id)}
                    className="text-xs text-cadet/20 hover:text-redwood/60 transition-colors disabled:opacity-40"
                  >
                    {revoking === inv.id ? "..." : "revoke"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

