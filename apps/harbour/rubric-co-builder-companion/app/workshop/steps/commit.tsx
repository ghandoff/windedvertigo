"use client";

import { useState } from "react";
import { downloadMarkdown } from "@/lib/export-rubric";
import { SCALE_LEVELS } from "@/lib/types";
import type { Draft } from "@/lib/types";

type Props = {
  draft: Draft;
  onBack: () => void;
  onReset: () => void;
};

export function StepCommit({ draft, onBack, onReset }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  function copyMarkdown() {
    import("@/lib/export-rubric").then(({ draftToMarkdown }) => {
      navigator.clipboard.writeText(draftToMarkdown(draft));
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 no-print">
        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          step 5 of 5 · rubric
        </p>
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-cadet)" }}>
          your rubric.
        </h1>
        <p style={{ color: "var(--color-cadet)" }}>
          print it, copy it as markdown, or download the .md file. nothing was
          uploaded anywhere — this lived only in your browser.
        </p>
      </header>

      <article
        className="rounded-lg bg-white p-6 space-y-6 rubric-print-table"
        style={{
          border: "1px solid color-mix(in srgb, var(--color-cadet) 15%, transparent)",
        }}
      >
        <header className="space-y-1">
          {draft.learning_outcome && (
            <p style={{ color: "var(--color-cadet)" }}>
              <strong>learning outcome:</strong> {draft.learning_outcome}
            </p>
          )}
          {draft.artefact && (
            <p style={{ color: "var(--color-cadet)" }}>
              <strong>artefact:</strong> {draft.artefact}
            </p>
          )}
        </header>

        {draft.pledge.text.trim() && (
          <aside
            className="rounded border-l-4 p-3 text-sm leading-relaxed"
            style={{
              borderColor: "var(--color-sienna)",
              background: "var(--color-champagne)",
              color: "var(--color-cadet)",
            }}
          >
            <p
              className="text-xs uppercase tracking-widest mb-1"
              style={{ opacity: 0.7 }}
            >
              quality pledge
            </p>
            {draft.pledge.text}
          </aside>
        )}

        <div className="overflow-x-auto">
          <table
            className="w-full text-sm border-collapse"
            // UDL 1.3 / WCAG 1.3.1: scope attributes turn this from a
            // visual grid into a programmatically-navigable rubric.
            // Screen readers and printed-to-PDF readers can now announce
            // each cell as "<criterion>, level N <descriptor>".
            aria-label="rubric — criteria × proficiency levels"
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-left p-2 align-top w-1/5"
                  style={{
                    color: "var(--color-cadet)",
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--color-cadet) 30%, transparent)",
                  }}
                >
                  criterion
                </th>
                {SCALE_LEVELS.map((lvl) => (
                  <th
                    key={lvl.level}
                    scope="col"
                    className="text-left p-2 align-top"
                    style={{
                      color: "var(--color-cadet)",
                      borderBottom:
                        "1px solid color-mix(in srgb, var(--color-cadet) 30%, transparent)",
                    }}
                  >
                    {lvl.level} · {lvl.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.criteria.map((c) => (
                <tr key={c.id}>
                  <th
                    scope="row"
                    className="p-2 align-top text-left font-normal"
                    style={{
                      color: "var(--color-cadet)",
                      borderBottom:
                        "1px solid color-mix(in srgb, var(--color-cadet) 10%, transparent)",
                    }}
                  >
                    <div className="font-bold">{c.name}</div>
                    {c.required && (
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: "var(--color-redwood)" }}
                      >
                        required
                      </div>
                    )}
                    {c.good_description && (
                      <p
                        className="text-xs italic mt-1"
                        style={{ opacity: 0.75 }}
                      >
                        {c.good_description}
                      </p>
                    )}
                  </th>
                  {SCALE_LEVELS.map((lvl) => {
                    const d = draft.descriptors.find(
                      (x) => x.criterion_id === c.id && x.level === lvl.level,
                    );
                    return (
                      <td
                        key={lvl.level}
                        className="p-2 align-top text-xs leading-relaxed"
                        style={{
                          color: "var(--color-cadet)",
                          borderBottom:
                            "1px solid color-mix(in srgb, var(--color-cadet) 10%, transparent)",
                        }}
                      >
                        {d?.text || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer
          className="text-[10px] uppercase tracking-widest pt-2 print-only"
          style={{ color: "var(--color-cadet)", opacity: 0.6 }}
        >
          drafted with the rubric co-builder companion · winded.vertigo
        </footer>
      </article>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <button
          type="button"
          onClick={() => downloadMarkdown(draft)}
          className="btn-primary text-sm"
        >
          download as .md
        </button>
        <button type="button" onClick={copyMarkdown} className="btn-secondary text-sm">
          copy markdown
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-secondary text-sm"
        >
          print rubric
        </button>
        <button type="button" onClick={onBack} className="btn-secondary text-sm">
          back
        </button>
        {confirmReset ? (
          <button
            type="button"
            onClick={onReset}
            className="text-sm underline"
            style={{ color: "var(--color-redwood)" }}
          >
            confirm: clear this draft and start over
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-sm underline underline-offset-4"
            style={{ color: "var(--color-cadet)", opacity: 0.7 }}
          >
            start a new draft
          </button>
        )}
      </div>
    </div>
  );
}
