"use client";

import { useMemo, useState } from "react";
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

/** Parse a raw string of emails separated by commas, newlines, semicolons, or spaces. */
function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\n\r\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}

export default function InviteForm({ packs }: InviteFormProps) {
  const router = useRouter();
  const [emailText, setEmailText] = useState("");
  const [tier, setTier] = useState<"explorer" | "practitioner">("explorer");
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const parsedEmails = useMemo(() => parseEmails(emailText), [emailText]);

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
    if (parsedEmails.length === 0) return;
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
          emails: parsedEmails,
          tier,
          note: note.trim() || undefined,
          expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
          packIds: Array.from(selectedPackIds),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results as { email: string; success: boolean; error?: string }[];
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.length - succeeded;

        const text = failed > 0
          ? `${succeeded} invite${succeeded !== 1 ? "s" : ""} sent, ${failed} failed — ${selectedPackIds.size} pack${selectedPackIds.size !== 1 ? "s" : ""} granted`
          : `${succeeded} invite${succeeded !== 1 ? "s" : ""} sent — ${selectedPackIds.size} pack${selectedPackIds.size !== 1 ? "s" : ""} granted`;

        setMessage({ type: failed > 0 ? "error" : "success", text });
        setEmailText("");
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
      {/* emails */}
      <div>
        <label
          htmlFor="invite-emails"
          className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
        >
          email addresses
        </label>
        <textarea
          id="invite-emails"
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          placeholder={"one@school.edu, two@school.edu\nor paste one per line"}
          rows={3}
          className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet placeholder:text-cadet/30 focus:border-sienna focus:outline-none resize-y"
        />
        <p className="text-xs text-cadet/40 mt-1">
          {parsedEmails.length > 0
            ? `${parsedEmails.length} valid email${parsedEmails.length !== 1 ? "s" : ""} found`
            : "separate with commas, semicolons, or new lines"}
        </p>
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
          disabled={saving || parsedEmails.length === 0 || selectedPackIds.size === 0}
          className="rounded-lg bg-redwood px-5 py-2.5 text-sm font-medium text-white hover:bg-sienna transition-colors disabled:opacity-40"
        >
          {saving
            ? "sending..."
            : `send ${parsedEmails.length || ""} invite${parsedEmails.length !== 1 ? "s" : ""}`}
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
