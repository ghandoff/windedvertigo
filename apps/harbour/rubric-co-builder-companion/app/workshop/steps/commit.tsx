"use client";

import { useState } from "react";
// downloadMarkdown export from lib/export-rubric.ts is no longer used here;
// the markdown export buttons were removed in PR #113. draftToMarkdown is
// still exported from that module in case it's wanted elsewhere later.
import { AI_USE_LEVELS, SCALE_LEVELS } from "@/lib/types";
import type { Draft } from "@/lib/types";

type Props = {
  draft: Draft;
  onBack: () => void;
  onReset: () => void;
};

export function StepCommit({ draft, onBack, onReset }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  // Markdown export buttons (download / copy) removed per PR #113.
  // The draftToMarkdown function in lib/export-rubric.ts is still exported
  // and may be used elsewhere later — kept untouched.

  return (
    <div className="space-y-8">
      <header className="space-y-2 no-print">
        <p
          className="text-xs tracking-widest"
          style={{ color: "var(--color-cadet)", opacity: 0.7 }}
        >
          step 5 of 5 · rubric
        </p>
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-cadet)" }}>
          your rubric.
        </h1>
        <p style={{ color: "var(--color-cadet)" }}>
          print it, copy it as markdown, or download the .md file. nothing was
          uploaded anywhere. this lived only in your browser.
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

        {(() => {
          const p = draft.pledge;
          const hasAny =
            p.ai_level !== null ||
            p.will_use_for.trim() ||
            p.will_not_use_for.trim() ||
            p.will_disclose.trim() ||
            p.if_cross_line.trim();
          if (!hasAny) return null;
          const aiRung =
            p.ai_level !== null
              ? AI_USE_LEVELS.find((r) => r.level === p.ai_level)
              : null;
          return (
            <aside
              // rubric-print-pledge: print stylesheet hook. globals.css
              // drops the champagne fill and thins the border for ink
              // efficiency, and applies page-break-inside: avoid so the
              // pledge doesn't split mid-section. (PR #114 polish #2.)
              className="rubric-print-pledge rounded border-l-4 p-4 text-sm leading-relaxed space-y-3"
              style={{
                borderColor: "var(--color-sienna)",
                background: "var(--color-champagne)",
                color: "var(--color-cadet)",
              }}
            >
              <p
                className="text-xs tracking-widest"
                style={{ opacity: 0.7 }}
              >
                AI use pledge
              </p>
              {aiRung && (
                <p>
                  <strong>rung {aiRung.level}:</strong> {aiRung.name}{" "}
                  <span style={{ opacity: 0.75 }}>{aiRung.helper}</span>
                </p>
              )}
              {p.will_use_for.trim() && (
                <p>
                  <strong>we will use AI for:</strong> {p.will_use_for}
                </p>
              )}
              {p.will_not_use_for.trim() && (
                <p>
                  <strong>we will NOT use AI for:</strong> {p.will_not_use_for}
                </p>
              )}
              {p.will_disclose.trim() && (
                <p>
                  <strong>we will disclose:</strong> {p.will_disclose}
                </p>
              )}
              {p.if_cross_line.trim() && (
                <p>
                  <strong>if we cross our own line, we will:</strong> {p.if_cross_line}
                </p>
              )}
            </aside>
          );
        })()}

        <div className="overflow-x-auto">
          <table
            className="w-full text-sm border-collapse"
            // UDL 1.3 / WCAG 1.3.1: scope attributes turn this from a
            // visual grid into a programmatically-navigable rubric.
            // Screen readers and printed-to-PDF readers can now announce
            // each cell as "<criterion>, level N <descriptor>".
            aria-label="rubric: criteria × proficiency levels"
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
                        className="text-[10px] tracking-widest"
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
                        {d?.text || "…"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer
          className="text-[10px] tracking-widest pt-2 print-only"
          style={{ color: "var(--color-cadet)", opacity: 0.6 }}
        >
          drafted with co.rubric companion · winded.vertigo
        </footer>
      </article>

      <div className="flex flex-wrap items-center gap-3 no-print">
        <button type="button" onClick={onBack} className="btn-secondary text-sm">
          back
        </button>
        {/* Button triggers window.print() — Chrome and Safari default the
            "Destination" dropdown in that dialog to "Save as PDF", so
            naming the button after what 99% of users will do (PDF) is
            more honest than naming it after the underlying mechanic
            (print). Hint sentence below covers the two dialog
            checkboxes worth tweaking for the cleanest output. */}
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-secondary text-sm"
        >
          save as PDF
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

      {/* One-line hint nudging users toward the two browser-print-dialog
          settings that materially improve the saved PDF. We can't enforce
          either from CSS, so the cheapest move is just to tell people. */}
      <p
        className="text-xs no-print"
        style={{ color: "var(--color-cadet)", opacity: 0.65 }}
      >
        opens your browser&apos;s print dialog with{" "}
        <strong>save as PDF</strong> pre-selected. for the cleanest output,
        uncheck <em>headers and footers</em> and check{" "}
        <em>background graphics</em>.
      </p>
    </div>
  );
}
