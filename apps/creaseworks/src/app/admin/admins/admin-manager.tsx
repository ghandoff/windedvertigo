"use client";

/**
 * Admin list manager — client component with add/remove operations.
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { useState } from "react";
import { apiUrl } from "@/lib/api-url";

interface AdminRow {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  granted_by_email: string | null;
  created_at: string;
}

export default function AdminListManager({
  initialAdmins,
  currentUserId,
}: {
  initialAdmins: AdminRow[];
  currentUserId: string;
}) {
  const [admins, setAdmins] = useState<AdminRow[]>(initialAdmins);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newEmail.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/admin/admins"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to add admin");

      // refresh the list
      const listRes = await fetch(apiUrl("/api/admin/admins"));
      const listData = await listRes.json();
      setAdmins(listData.admins);
      setNewEmail("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(adminId: string, email: string) {
    if (!confirm(`remove ${email} from the admin list?`)) return;

    try {
      const res = await fetch(apiUrl("/api/admin/admins"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to remove");

      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      {/* add form */}
      <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-5 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-3">add admin</h2>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="rounded-lg border border-cadet/15 px-3 py-2 text-sm flex-1 min-w-48 outline-none focus:ring-2"
            aria-label="admin email address"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !newEmail.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 transition-all"
            style={{ backgroundColor: "var(--wv-redwood)" }}
          >
            {loading ? "adding\u2026" : "add"}
          </button>
        </div>
        {error && <p id="admin-error" className="text-sm mt-2 text-redwood">{error}</p>}
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cadet/10 text-left text-xs text-cadet/50">
              <th className="pb-2 pr-4">email</th>
              <th className="pb-2 pr-4">name</th>
              <th className="pb-2 pr-4">granted by</th>
              <th className="pb-2 pr-4">added</th>
              <th className="pb-2">actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b border-cadet/5">
                <td className="py-2 pr-4">{a.email}</td>
                <td className="py-2 pr-4 text-cadet/50">{a.name || "\u2014"}</td>
                <td className="py-2 pr-4 text-cadet/50 text-xs">
                  {a.granted_by_email || "system"}
                </td>
                <td className="py-2 pr-4 text-cadet/50 text-xs">
                  {a.created_at
                    ? new Date(a.created_at).toLocaleDateString("en-GB")
                    : "\u2014"}
                </td>
                <td className="py-2">
                  {admins.length > 1 ? (
                    <button
                      onClick={() => handleRemove(a.id, a.email)}
                      className="text-xs text-cadet/40 hover:text-redwood transition-colors"
                    >
                      remove
                    </button>
                  ) : (
                    <span className="text-xs text-cadet/30">last admin</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

