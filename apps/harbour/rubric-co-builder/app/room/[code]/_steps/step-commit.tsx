"use client";

import { useMemo, useState } from "react";
import type {
  AiUseProposal,
  AiUseProposalVote,
  AiUseVote,
  Criterion,
  PledgeSlot,
  Room,
  Scale,
} from "@/lib/types";
import { PLEDGE_SLOTS, SCALE_LEVELS } from "@/lib/types";
import {
  computeCeiling,
  computeCeilingFromProposals,
  levelMeta,
} from "@/lib/ai-contract";

type Props = {
  room: Room;
  criteria: Criterion[];
  scales: Scale[];
  votes: AiUseVote[];
  proposals?: AiUseProposal[];
  proposalVotes?: AiUseProposalVote[];
  slots: PledgeSlot[];
};

export function StepCommit({
  room,
  criteria,
  scales,
  votes,
  proposals,
  proposalVotes,
  slots,
}: Props) {
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const selected = useMemo(
    () =>
      criteria
        .filter((c) => c.status === "selected")
        .sort((a, b) => a.position - b.position),
    [criteria],
  );
  const useProposals = (proposals?.length ?? 0) > 0;
  const { ceiling } = useProposals
    ? computeCeilingFromProposals(proposals ?? [], proposalVotes ?? [])
    : computeCeiling(votes);
  const rung = levelMeta(ceiling);

  const markdown = useMemo(
    () => buildMarkdown(room, selected, scales, ceiling, rung.name, slots),
    [room, selected, scales, ceiling, rung.name, slots],
  );

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyMsg("markdown copied.");
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("couldn't copy — try manually.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMsg("link copied.");
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("couldn't copy — try manually.");
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rubric-and-contract-${room.code}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    window.print();
  }

  return (
    <div className="space-y-8 print:pt-0">
      <header className="space-y-3 print:hidden">
        <h1 className="text-3xl font-bold">
          you co-designed what counts as good, and you committed to how to make it
          with integrity. use them together.
        </h1>
        <p className="text-[color:var(--color-cadet)]/85">
          rubric plus contract — one artefact. copy, download, or print to pdf.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <button onClick={downloadMarkdown} className="btn-primary text-sm">
            download markdown
          </button>
          <button onClick={copyMarkdown} className="btn-secondary text-sm">
            copy markdown
          </button>
          <button onClick={copyLink} className="btn-secondary text-sm">
            copy link
          </button>
          <button onClick={printPdf} className="btn-secondary text-sm">
            print / save as pdf
          </button>
          {copyMsg ? (
            <span className="text-sm text-[color:var(--color-cadet)]/70 self-center">
              {copyMsg}
            </span>
          ) : null}
        </div>
      </header>

      {/* page 1 + 2: the rubric */}
      <article className="rounded-lg bg-white border border-[color:var(--color-cadet)]/15 p-6 print:border-0 print:p-0 print:break-after-page">
        <div className="border-b border-[color:var(--color-cadet)]/15 pb-4 mb-6">
          <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70 mb-1">
            rubric · {room.code}
          </p>
          <h2 className="text-2xl font-bold text-[color:var(--color-cadet)]">
            {room.project_description}
          </h2>
          <p className="text-sm text-[color:var(--color-cadet)]/75 mt-2 leading-relaxed">
            <strong>learning outcome:</strong> {room.learning_outcome}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left font-semibold bg-[color:var(--color-cadet)] text-white p-3 w-40 align-bottom">
                  criterion
                </th>
                {SCALE_LEVELS.map(({ level, label }) => (
                  <th
                    key={level}
                    className="text-left font-semibold bg-[color:var(--color-cadet)] text-white p-3 align-bottom"
                  >
                    <span className="block text-xs tracking-wider opacity-80">
                      level {level}
                    </span>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.map((c, idx) => (
                <tr
                  key={c.id}
                  className={idx % 2 === 0 ? "bg-[color:var(--color-champagne)]/30" : ""}
                >
                  <th className="text-left align-top p-3 font-semibold text-[color:var(--color-cadet)]">
                    <div>{c.name}</div>
                    {c.good_description ? (
                      <div className="text-[11px] font-normal text-[color:var(--color-cadet)]/70 mt-1 leading-relaxed">
                        {c.good_description}
                      </div>
                    ) : null}
                  </th>
                  {SCALE_LEVELS.map(({ level }) => {
                    const descriptor = scales.find(
                      (s) => s.criterion_id === c.id && s.level === level,
                    )?.descriptor;
                    return (
                      <td
                        key={level}
                        className="align-top p-3 text-[color:var(--color-cadet)]/90 leading-relaxed"
                      >
                        {descriptor || <span className="opacity-40">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs tracking-wider text-[color:var(--color-cadet)]/60 mt-6">
          co-designed in a rubric co-builder session · winded.vertigo
        </p>
      </article>

      {/* page 3: the contract */}
      <article className="rounded-lg bg-white border border-[color:var(--color-cadet)]/15 p-6 print:border-0 print:p-0">
        <div className="border-b border-[color:var(--color-cadet)]/15 pb-4 mb-6">
          <p className="text-xs tracking-widest text-[color:var(--color-cadet)]/70 mb-1">
            our AI-use contract · {room.code}
          </p>
          <h2 className="text-2xl font-bold text-[color:var(--color-cadet)]">
            {room.project_description}
          </h2>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-cadet)] text-white px-4 py-1.5 text-sm">
            <span className="font-bold">ceiling · level {ceiling}</span>
            <span className="opacity-80">— {rung.name}</span>
          </div>
          <p className="text-xs text-[color:var(--color-cadet)]/70 mt-2 max-w-2xl leading-relaxed">
            {rung.helper}
          </p>
        </div>

        <dl className="space-y-4">
          {PLEDGE_SLOTS.map(({ index, label, placeholder }) => {
            const slot = slots.find((s) => s.slot_index === index);
            const content = slot?.content?.trim() ?? "";
            return (
              <div key={index} className="rounded bg-[color:var(--color-champagne)]/30 p-4">
                <dt className="font-semibold text-[color:var(--color-cadet)] mb-1">
                  {label}
                </dt>
                <dd className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-cadet)]/90">
                  {content || (
                    <span className="opacity-50 italic">
                      [not filled in — {placeholder}]
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="text-xs tracking-wider text-[color:var(--color-cadet)]/60 mt-6">
          co-designed in a rubric co-builder session · winded.vertigo
        </p>
      </article>
    </div>
  );
}

function buildMarkdown(
  room: Room,
  criteria: Criterion[],
  scales: Scale[],
  ceiling: number,
  ceilingName: string,
  slots: PledgeSlot[],
): string {
  const lines: string[] = [];
  lines.push(`# rubric + AI-use contract — ${room.project_description}`);
  lines.push("");
  lines.push(`**learning outcome:** ${room.learning_outcome}`);
  lines.push("");
  lines.push(`**room code:** ${room.code}`);
  lines.push("");
  lines.push("## rubric");
  lines.push("");
  const header = `| criterion | ${SCALE_LEVELS.map((l) => `${l.level}. ${l.label}`).join(" | ")} |`;
  const divider = `|---|${SCALE_LEVELS.map(() => "---").join("|")}|`;
  lines.push(header);
  lines.push(divider);
  for (const c of criteria) {
    const good = c.good_description ? ` — ${c.good_description}` : "";
    const cells = SCALE_LEVELS.map(
      ({ level }) =>
        (scales.find((s) => s.criterion_id === c.id && s.level === level)?.descriptor ?? "")
          .replace(/\s*\n\s*/g, " ")
          .replace(/\|/g, "\\|"),
    );
    lines.push(`| **${c.name}**${good} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## our AI-use contract");
  lines.push("");
  lines.push(`**ceiling:** level ${ceiling} — ${ceilingName}`);
  lines.push("");
  for (const { index, label } of PLEDGE_SLOTS) {
    const content = slots.find((s) => s.slot_index === index)?.content?.trim() ?? "";
    lines.push(`### ${label}`);
    lines.push("");
    lines.push(content || "_[not filled in]_");
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("_co-designed in a rubric co-builder session · winded.vertigo_");
  return lines.join("\n");
}
