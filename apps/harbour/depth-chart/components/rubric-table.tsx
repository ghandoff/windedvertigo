"use client";

import { BrandStrip } from "./brand-strip";
import type { AnalyticRubric } from "@/lib/types";

interface RubricTableProps {
  rubric: AnalyticRubric;
}

const LEVEL_LABELS = ["beginning", "developing", "proficient", "exemplary"] as const;

export function RubricTable({ rubric }: RubricTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-text-on-dark)]">
          analytic rubric
        </p>
        <div className="flex gap-3 text-xs text-[var(--color-text-on-dark-muted)]">
          <span>raters: {rubric.reliability_estimate.recommended_raters}</span>
          <span>
            expected ICC: {rubric.reliability_estimate.expected_icc_range[0].toFixed(2)}–
            {rubric.reliability_estimate.expected_icc_range[1].toFixed(2)}
          </span>
        </div>
      </div>

      {rubric.reliability_estimate.validity_tradeoff && (
        <p className="text-xs text-[var(--dc-bloom-evaluate)] bg-white/3 rounded px-3 py-2">
          {rubric.reliability_estimate.validity_tradeoff}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border-b border-white/10 text-[var(--color-text-on-dark-muted)] font-medium w-32">
                criterion
              </th>
              <th className="text-center p-2 border-b border-white/10 text-[var(--color-text-on-dark-muted)] font-medium w-12">
                weight
              </th>
              {LEVEL_LABELS.map((label) => (
                <th
                  key={label}
                  className="text-left p-2 border-b border-white/10 text-[var(--color-text-on-dark-muted)] font-medium"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rubric.criteria.map((criterion, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="p-2 align-top">
                  <span className="text-[var(--color-text-on-dark)] font-medium">
                    {criterion.name}
                  </span>
                  <br />
                  <span className="text-[var(--color-text-on-dark-muted)]">
                    {criterion.blooms_alignment} / {criterion.authenticity_dimension}
                  </span>
                </td>
                <td className="p-2 text-center align-top text-[var(--color-text-on-dark-muted)]">
                  {(criterion.weight * 100).toFixed(0)}%
                </td>
                {LEVEL_LABELS.map((label) => {
                  const level = criterion.levels.find((l) => l.label === label);
                  return (
                    <td key={label} className="p-2 align-top text-[var(--color-text-on-dark-muted)] leading-relaxed">
                      {level?.behavioral_anchor || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BrandStrip className="mt-4" />
    </div>
  );
}
