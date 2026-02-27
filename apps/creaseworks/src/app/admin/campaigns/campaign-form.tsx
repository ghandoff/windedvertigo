"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CampaignForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !title.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (res.ok) {
        setMessage({
          type: "success",
          text: `campaign "${slug}" created`,
        });
        setSlug("");
        setTitle("");
        setDescription("");
        router.refresh();
      } else {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error ?? "something went wrong",
        });
      }
    } catch {
      setMessage({ type: "error", text: "network error — try again" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-cadet/10 bg-white p-6 space-y-4"
    >
      {/* slug + title row */}
      <div className="flex gap-4">
        <div className="w-40">
          <label
            htmlFor="campaign-slug"
            className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
          >
            slug
          </label>
          <input
            id="campaign-slug"
            type="text"
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/-+/g, "-"),
              )
            }
            placeholder="acetate"
            required
            className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet placeholder:text-cadet/30 focus:border-sienna focus:outline-none font-mono"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="campaign-title"
            className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
          >
            title
          </label>
          <input
            id="campaign-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="color acetate adventures"
            required
            className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet placeholder:text-cadet/30 focus:border-sienna focus:outline-none"
          />
        </div>
      </div>

      {/* description */}
      <div>
        <label
          htmlFor="campaign-desc"
          className="block text-xs font-semibold text-cadet/50 uppercase tracking-wide mb-1"
        >
          description
        </label>
        <textarea
          id="campaign-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="shown on the campaign landing page..."
          rows={3}
          className="w-full rounded-lg border border-cadet/10 px-3 py-2 text-sm text-cadet placeholder:text-cadet/30 focus:border-sienna focus:outline-none resize-none"
        />
      </div>

      {/* submit + message */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving || !slug.trim() || !title.trim()}
          className="rounded-lg bg-redwood px-5 py-2.5 text-sm font-medium text-white hover:bg-sienna transition-colors disabled:opacity-40"
        >
          {saving ? "creating..." : "create campaign"}
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
