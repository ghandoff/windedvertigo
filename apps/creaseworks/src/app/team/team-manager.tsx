"use client";

/**
 * Team member manager — client component with role and removal controls.
 *
 * Org admins see promote/demote and remove buttons.
 * Regular members see a read-only list.
 *
 * Post-MVP — team management.
 */

import { useState } from "react";
import { apiUrl } from "@/lib/api-url";

interface MemberRow {
  membership_id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  joined_at: string;
}

export default function TeamManager({
  initialMembers,
  currentUserId,
  isOrgAdmin,
}: {
  initialMembers: MemberRow[];
  currentUserId: string;
  isOrgAdmin: boolean;
}) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: "member" | "admin") {
    setLoading(userId);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/team/members"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to update role");

      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId ? { ...m, role: newRole } : m,
        ),
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`remove ${email} from this organisation?`)) return;

    setLoading(userId);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/team/members"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to remove member");

      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  const adminCount = members.filter((m) => m.role === "admin").length;

  return (
    <div>
      {error && (
        <div className="rounded-xl border border-redwood/20 bg-redwood/5 px-4 py-3 mb-6">
          <p className="text-sm text-redwood">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cadet/10 text-left text-xs text-cadet/50">
              <th className="pb-2 pr-4">email</th>
              <th className="pb-2 pr-4">name</th>
              <th className="pb-2 pr-4">role</th>
              <th className="pb-2 pr-4">joined</th>
              {isOrgAdmin && <th className="pb-2">actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isYou = m.user_id === currentUserId;
              const isLoading = loading === m.user_id;
              const isLastAdmin = m.role === "admin" && adminCount <= 1;

              return (
                <tr key={m.membership_id} className="border-b border-cadet/5">
                  <td className="py-3 pr-4">
                    {m.email}
                    {isYou && (
                      <span className="ml-2 text-xs text-cadet/40">(you)</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-cadet/50">
                    {m.name || "\u2014"}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.role === "admin"
                          ? "bg-burnt-sienna/10 text-burnt-sienna"
                          : "bg-cadet/5 text-cadet/50"
                      }`}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-cadet/50 text-xs">
                    {m.joined_at
                      ? new Date(m.joined_at).toLocaleDateString("en-GB")
                      : "\u2014"}
                  </td>
                  {isOrgAdmin && (
                    <td className="py-3">
                      {isLoading ? (
                        <span className="text-xs text-cadet/30">
                          updating\u2026
                        </span>
                      ) : isYou ? (
                        <span className="text-xs text-cadet/30">
                          \u2014
                        </span>
                      ) : (
                        <div className="flex gap-3">
                          {m.role === "member" ? (
                            <button
                              onClick={() =>
                                handleRoleChange(m.user_id, "admin")
                              }
                              className="text-xs text-cadet/40 hover:text-burnt-sienna transition-colors"
                            >
                              make admin
                            </button>
                          ) : !isLastAdmin ? (
                            <button
                              onClick={() =>
                                handleRoleChange(m.user_id, "member")
                              }
                              className="text-xs text-cadet/40 hover:text-burnt-sienna transition-colors"
                            >
                              make member
                            </button>
                          ) : (
                            <span className="text-xs text-cadet/30">
                              last admin
                            </span>
                          )}
                          <button
                            onClick={() => handleRemove(m.user_id, m.email)}
                            className="text-xs text-cadet/40 hover:text-redwood transition-colors"
                          >
                            remove
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <p className="text-sm text-cadet/40 mt-4">
          no members yet. people with a verified email domain will be
          added automatically when they sign in.
        </p>
      )}
    </div>
  );
}

