"use client";

import { useState } from "react";
import type { Criterion } from "@/lib/types";
import { apiPath } from "@/lib/paths";

type Props = {
  code: string;
  criteria: Criterion[];
  canEdit: boolean;
};

export function StepPropose({ code, criteria, canEdit }: Props) {
  const [name, setName] = useState("");
  const [good, setGood] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/rooms/${code}/criteria`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, good_description: good }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? "something wobbled. try again?");
      } else {
        setName("");
        setGood("");
      }
    } catch {
      setError("the network blinked.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!canEdit) return;
    const res = await fetch(apiPath(`/api/rooms/${code}/criteria/${id}`), { method: "DELETE" });
    if (!res.ok) throw new Error("the network blinked.");
  }

  // instead of overwriting, propose a new version alongside the original
  async function proposeVersion(original: Criterion, nextName: string, nextGood: string) {
    if (!canEdit) return;
    const res = await fetch(apiPath(`/api/rooms/${code}/criteria`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: nextName,
        good_description: nextGood,
        version_of: original.id,
      }),
    });
    if (!res.ok) throw new Error("the network blinked.");
  }

  // group criteria: originals + their versions
  const originals = criteria.filter((c) => !c.version_of);
  const versions = criteria.filter((c) => !!c.version_of);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
      <aside className="space-y-5">
        <h1 className="text-3xl font-bold">propose a criterion.</h1>
        <p className="text-[color:var(--color-cadet)]/85 leading-relaxed">
          what should count? write a one-word (ish) name and, if you can, one line on
          what good looks like. every card is anonymous. propose a variation on any
          existing card — it stacks alongside the original.
        </p>

        {canEdit ? (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="criterion name"
              className="w-full rounded-lg border border-[color:var(--color-cadet)]/20 bg-white px-4 py-3 placeholder:text-[color:var(--color-cadet)]/40 focus:border-[color:var(--color-cadet)] focus:outline-none"
            />
            <textarea
              value={good}
              onChange={(e) => setGood(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="what good looks like (optional, one line)"
              className="w-full rounded-lg border border-[color:var(--color-cadet)]/20 bg-white px-4 py-3 text-sm leading-relaxed placeholder:text-[color:var(--color-cadet)]/40 focus:border-[color:var(--color-cadet)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "adding…" : "add to the board"}
            </button>
            {error ? (
              <p className="text-xs text-[color:var(--color-redwood)]">{error}</p>
            ) : null}
          </form>
        ) : (
          <p className="text-sm text-[color:var(--color-cadet)]/60 rounded border border-dashed border-[color:var(--color-cadet)]/20 p-4">
            you&apos;re watching. the host view is read-only.
          </p>
        )}

        <p className="text-xs text-[color:var(--color-cadet)]/60">
          the board has {criteria.length} criteri{criteria.length === 1 ? "on" : "a"} so far.
        </p>
      </aside>

      <section className="space-y-4">
        {originals.map((c) => {
          const cvs = versions.filter((v) => v.version_of === c.id);
          return (
            <div key={c.id} className="space-y-2">
              <CriterionCard
                criterion={c}
                canEdit={canEdit}
                onRemove={() => remove(c.id)}
                onProposeVersion={(nextName, nextGood) =>
                  proposeVersion(c, nextName, nextGood)
                }
              />
              {cvs.length > 0 ? (
                <div className="pl-6 space-y-2 border-l-2 border-[color:var(--color-sienna)]/30">
                  {cvs.map((v) => (
                    <CriterionCard
                      key={v.id}
                      criterion={v}
                      canEdit={canEdit}
                      isVersion
                      onRemove={() => remove(v.id)}
                      onProposeVersion={(nextName, nextGood) =>
                        proposeVersion(c, nextName, nextGood)
                      }
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {originals.length === 0 ? (
          <p className="text-[color:var(--color-cadet)]/60 p-8 text-center border-2 border-dashed border-[color:var(--color-cadet)]/15 rounded-lg">
            no criteria yet. what would your group want to be graded on?
          </p>
        ) : null}
      </section>
    </div>
  );
}

function CriterionCard({
  criterion,
  canEdit,
  isVersion = false,
  onRemove,
  onProposeVersion,
}: {
  criterion: Criterion;
  canEdit: boolean;
  isVersion?: boolean;
  onRemove: () => Promise<void>;
  onProposeVersion: (name: string, good: string) => Promise<void>;
}) {
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [vName, setVName] = useState(criterion.name);
  const [vGood, setVGood] = useState(criterion.good_description ?? "");
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function submitVersion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vName.trim()) return;
    setSubmittingVersion(true);
    await onProposeVersion(vName.trim(), vGood.trim());
    setSubmittingVersion(false);
    setShowVersionForm(false);
    setVName(criterion.name);
    setVGood(criterion.good_description ?? "");
  }

  return (
    <div
      className={`rounded-lg p-4 space-y-2 bg-white ${
        isVersion
          ? "border border-[color:var(--color-sienna)]/30"
          : "border border-[color:var(--color-cadet)]/15"
      }`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 font-semibold text-[color:var(--color-cadet)]">
          {criterion.name}
        </p>
        {criterion.required ? (
          <span className="text-xs uppercase tracking-wider bg-[color:var(--color-cadet)] text-white rounded px-2 py-0.5 mt-1 shrink-0">
            required
          </span>
        ) : null}
        {isVersion ? (
          <span className="text-xs uppercase tracking-wider bg-[color:var(--color-sienna)]/15 text-[color:var(--color-sienna)] rounded px-2 py-0.5 mt-1 shrink-0">
            variation
          </span>
        ) : null}
        {canEdit && !criterion.required ? (
          <button
            onClick={async () => {
              setRemoveError(null);
              try { await onRemove(); } catch { setRemoveError("the network blinked."); }
            }}
            aria-label={`remove ${criterion.name}`}
            className="text-xs text-[color:var(--color-redwood)]/80 hover:text-[color:var(--color-redwood)] shrink-0"
          >
            remove
          </button>
        ) : null}
      </div>

      {removeError ? (
        <p className="text-xs text-[color:var(--color-redwood)]">{removeError}</p>
      ) : null}

      {criterion.good_description ? (
        <p className="text-sm leading-relaxed text-[color:var(--color-cadet)]/80">
          {criterion.good_description}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-[color:var(--color-cadet)]/50">
          {criterion.source}
        </p>
        {canEdit && !isVersion ? (
          <button
            onClick={() => setShowVersionForm((v) => !v)}
            className="text-xs uppercase tracking-wider text-[color:var(--color-cadet)]/50 hover:text-[color:var(--color-sienna)] transition-colors"
          >
            {showVersionForm ? "cancel" : "+ propose variation"}
          </button>
        ) : null}
      </div>

      {showVersionForm ? (
        <form onSubmit={submitVersion} className="space-y-2 pt-2 border-t border-[color:var(--color-cadet)]/10">
          <input
            type="text"
            value={vName}
            onChange={(e) => setVName(e.target.value)}
            maxLength={120}
            placeholder="variation name"
            className="w-full rounded border border-[color:var(--color-cadet)]/20 bg-[color:var(--color-champagne)]/30 px-3 py-2 text-sm focus:border-[color:var(--color-cadet)] focus:outline-none"
          />
          <textarea
            value={vGood}
            onChange={(e) => setVGood(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="what good looks like"
            className="w-full rounded border border-[color:var(--color-cadet)]/20 bg-[color:var(--color-champagne)]/30 px-3 py-2 text-sm leading-relaxed focus:border-[color:var(--color-cadet)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={submittingVersion || !vName.trim()}
            className="text-xs px-3 py-1.5 rounded bg-[color:var(--color-sienna)] text-white disabled:opacity-60"
          >
            {submittingVersion ? "adding…" : "add variation"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
