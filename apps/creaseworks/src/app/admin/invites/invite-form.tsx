"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";

interface Pack {
  id: string;
  slug: string;
  title: string;
}

interface InviteFormProps {
  packs: Pack[];
}

export default function InviteForm({ packs }: InviteFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<"explorer" | "practitioner">("explorer");
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function togglePack(packId: string) {
    setSelectedPackIds((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) {
        next.delete(packId);
      } else {
        next.add(packId);
      }
      return next;
    });
  }

  function selectAllPacks() {
    setSelectedPackIds(new Set(packs.map((p) => p.id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    if (selectedPackIds.size === 0) {
      setMessage({ type: "error", text: "select at least one pack to grant access to" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(apiUrl("/api/admin/invites"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          tier,
          note: note.trim() || undefined,
          expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
          packIds: Array.from(selectedPackIds),
        }),
      });

      if (res.ok) {
        setMessage({
          type: "success",
          text: `invite sent to ${email} — ${selectedPackIds.size} pack${selectedPackIds.size !== 1 ? "s" : ""} granted`,
        });
        setEmail("");
        setNote("");
        setExpiresInDays("");
        setSelectedPackIds(new Set());
        router.refresh();
      } else {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error ?? "something went wrong",
        });
      }
    } catch {
      setMessage({ type: "error", text: "network error \u2014 try again" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-cadet/10 bg-white p-6 space-y-4"
    >
      {/* email */}
      <div>
        <label
          htmlFor="invite-email"
          className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
        >
          email address
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@school.edu"
          required
          className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet placeholder:text-cadet/30 focus:border-sienna focus:outline-none"
        />
      </div>

      {/* tier + expiry row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label
            htmlFor="invite-tier"
            className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
          >
            access tier
          </label>
          <select
            id="invite-tier"
            value={tier}
            onChange={(e) =>
              setTier(e.target.value as "explorer" | "practitioner")
            }
            className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet bg-white focus:border-sienna focus:outline-none"
          >
            <option value="explorer">explorer (read-only)</option>
            <option value="practitioner">practitioner (full access)</option>
          </select>
        </div>

        <div className="w-32">
          <label
            htmlFor="invite-expires"
            className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
          >
            expires in
          </label>
          <select
            id="invite-expires"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet bg-white focus:border-sienna focus:outline-none"
          >
            <option value="">never</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </select>
        </div>
      </div>

      {/* note */}
      <div>
        <label
          htmlFor="invite-note"
          className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
        >
          note (optional)
        </label>
        <input
          id="invite-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. pilot partner, Maria's colleague"
          maxLength={200}
          className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet placeholder:text-cadet/30 focus:border-sienna focus:outline-none"
        />
      </div>

      {/* pack selector */}
      {packs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide">
              packs to grant
            </label>
            <button
              type="button"
              onClick={selectAllPacks}
              className="text-xs text-sienna/60 hover:text-sienna transition-colors"
            >
              select all
            </button>
          </div>
          <div className="rounded-lg border border-cadet/10 p-3 max-h-48 overflow-y-auto space-y-1.5">
            {packs.map((pack) => (
              <label
                key={pack.id}
                className="flex items-center gap-2.5 cursor-pointer hover:bg-cadet/[0.02] rounded-md px-1.5 py-1 -mx-1.5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedPackIds.has(pack.id)}
                  onChange={() => togglePack(pack.id)}
                  className="rounded border-cadet/20 text-sienna focus:ring-sienna/30"
                />
                <span className="text-sm text-cadet">{pack.title}</span>
              </label>
            ))}
          </div>
          {selectedPackIds.size > 0 && (
            <p className="text-xs text-cadet/35 mt-1">
              {selectedPackIds.size} pack{selectedPackIds.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      )}

      {/* submit + message */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving || !email.includes("@") || selectedPackIds.size === 0}
          className="rounded-lg bg-redwood px-5 py-2.5 text-sm font-medium text-white hover:bg-sienna transition-colors disabled:opacity-40"
        >
          {saving ? "sending..." : "send invite"}
        </button>

        {message && (
          <p
            className={`text-sm ${
              message.type === "success"
                ? "text-green-600"
                : "text-redwood"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

