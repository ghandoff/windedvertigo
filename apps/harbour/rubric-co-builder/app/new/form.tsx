"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPath } from "@/lib/paths";
import { ARTIFACT_EXAMPLES } from "@/lib/types";

type SeedInput = {
  id: string;
  name: string;
  good_description: string;
  required: boolean;
};

type Props = {
  seeds: Array<{ name: string; good_description: string | null }>;
};

export function NewRoomForm({ seeds }: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("");
  const [description, setDescription] = useState("");
  const [seedState, setSeedState] = useState<SeedInput[]>(
    seeds.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name,
      good_description: s.good_description ?? "",
      required: false,
    })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSeed(i: number, patch: Partial<SeedInput>) {
    setSeedState((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSeed(i: number) {
    setSeedState((cur) => cur.filter((_, idx) => idx !== i));
  }

  function addSeed() {
    setSeedState((cur) => [...cur, { id: crypto.randomUUID(), name: "", good_description: "", required: false }]);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!outcome.trim() || !description.trim()) {
      setError("learning outcome and artifact description are both required.");
      return;
    }
    const cleanSeeds = seedState
      .map((s) => ({
        name: s.name.trim(),
        good_description: s.good_description.trim(),
        required: s.required,
      }))
      .filter((s) => s.name.length > 0);

    setSubmitting(true);
    try {
      const res = await fetch(apiPath("/api/rooms"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learning_outcome: outcome.trim(),
          project_description: description.trim(),
          seeds: cleanSeeds,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "something wobbled. try again?");
        setSubmitting(false);
        return;
      }
      const { code } = (await res.json()) as { code: string };
      router.push(`/room/${code}/host`);
    } catch {
      setError("the network blinked. try again?");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-2">
        <label
          htmlFor="outcome"
          className="block text-sm font-medium text-[color:var(--color-cadet)]"
        >
          learning outcome
        </label>
        <textarea
          id="outcome"
          name="outcome"
          required
          rows={3}
          maxLength={1000}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="by the end of this assessment, students should be able to…"
          className="w-full rounded-lg border border-[color:var(--color-cadet)]/20 bg-white px-4 py-3 text-base leading-relaxed placeholder:text-[color:var(--color-cadet)]/40 focus:border-[color:var(--color-cadet)] focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="description"
          className="block text-sm font-medium text-[color:var(--color-cadet)]"
        >
          artifact
        </label>
        <p className="text-xs text-[color:var(--color-cadet)]/60">
          the deliverable students create to demonstrate learning.
        </p>
        <input
          id="description"
          name="description"
          type="text"
          list="artifact-examples"
          required
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. presentation, essay, prototype…"
          className="w-full rounded-lg border border-[color:var(--color-cadet)]/20 bg-white px-4 py-3 text-base placeholder:text-[color:var(--color-cadet)]/40 focus:border-[color:var(--color-cadet)] focus:outline-none"
        />
        <datalist id="artifact-examples">
          {ARTIFACT_EXAMPLES.map((ex) => (
            <option key={ex} value={ex} />
          ))}
        </datalist>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">seed criteria</h2>
          <span className="text-xs text-[color:var(--color-cadet)]/60">
            {seedState.length} card{seedState.length === 1 ? "" : "s"} · editable in-room
          </span>
        </div>

        <div className="space-y-3">
          {seedState.map((seed, i) => (
            <div
              key={seed.id}
              className="rounded-lg border border-[color:var(--color-cadet)]/15 bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={seed.name}
                  onChange={(e) => updateSeed(i, { name: e.target.value })}
                  maxLength={120}
                  placeholder="criterion name"
                  className="flex-1 rounded border border-transparent bg-[color:var(--color-champagne)]/40 px-3 py-2 font-medium focus:border-[color:var(--color-cadet)] focus:outline-none focus:bg-white"
                />
                <label
                  className="flex items-center gap-2 text-xs text-[color:var(--color-cadet)]/70 cursor-pointer relative group"
                  title="Students cannot remove this criterion."
                >
                  <input
                    type="checkbox"
                    checked={seed.required}
                    onChange={(e) => updateSeed(i, { required: e.target.checked })}
                    className="h-4 w-4 accent-[color:var(--color-sienna)]"
                  />
                  required
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded bg-[color:var(--color-cadet)] px-2 py-1 text-center text-[11px] leading-tight text-white opacity-0 transition-opacity group-hover:opacity-100">
                    students cannot remove this criterion.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => removeSeed(i)}
                  aria-label={`remove ${seed.name || "criterion"}`}
                  className="text-sm text-[color:var(--color-redwood)]/80 hover:text-[color:var(--color-redwood)] px-2"
                >
                  remove
                </button>
              </div>
              <textarea
                rows={2}
                value={seed.good_description}
                onChange={(e) => updateSeed(i, { good_description: e.target.value })}
                maxLength={500}
                placeholder="what good looks like, in one line"
                className="w-full rounded border border-transparent bg-[color:var(--color-champagne)]/40 px-3 py-2 text-sm leading-relaxed focus:border-[color:var(--color-cadet)] focus:outline-none focus:bg-white"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addSeed}
          className="text-sm text-[color:var(--color-cadet)] underline underline-offset-4 decoration-[color:var(--color-cadet)]/30 hover:decoration-[color:var(--color-cadet)]"
        >
          add another seed
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded border-l-4 border-[color:var(--color-redwood)] bg-[color:var(--color-redwood)]/10 px-4 py-3 text-sm text-[color:var(--color-cadet)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary text-base disabled:opacity-60 disabled:cursor-wait"
        >
          {submitting ? "spinning up the room…" : "open the room"}
        </button>
        <p className="text-xs text-[color:var(--color-cadet)]/60">
          you can keep editing everything once the room is live.
        </p>
      </div>
    </form>
  );
}
