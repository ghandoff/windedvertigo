# Claude Code prompt — PR #295 QC-gate fixes (BIZ-Q1 figure detector)

Work on PR #295 (branch `claude/biz-eligibility-qc-gates-ce655b71`) in ghandoff/windedvertigo. Garrett reviewed it and approved the direction. Make the changes below, run tests + migration, and report back. Do NOT merge — leave it for Garrett's approval.

## 1. Narrow BIZ-Q1's figure detector (main change)
In `port/lib/biz/qc-scrub.ts`, `findUnsourcedFigures()` currently hard-flags ANY number ≥1000 without a nearby citation. That false-positives on legitimate scale figures (our own drafts say "40,000+ educators", "45,000+ professionals"). Split into hard-block vs warning:
- HARD BLOCK: unsourced currency-prefixed amounts ($20M, USD 1.2 billion) and magnitude amounts (1.2 million, 500 billion).
- WARNING (not a block): unsourced plain large integers ≥1000 with no currency/magnitude.

Replace `findUnsourcedFigures` with `scanFigures` returning `{ blocking, warnings }`:

```ts
export interface FigureScan { blocking: string[]; warnings: string[]; }

const CURRENCY_OR_MAGNITUDE = /[$€£¥]|USD|EUR|MXN|BRL|COP|million|billion/i;

export function scanFigures(text: string): FigureScan {
  const blocking: string[] = [];
  const warnings: string[] = [];
  let match: RegExpExecArray | null;
  FIGURE_PATTERN.lastIndex = 0;
  while ((match = FIGURE_PATTERN.exec(text)) !== null) {
    const figure = match[0].trim();
    const digitsOnly = figure.replace(/[^0-9]/g, "");
    if (YEAR_PATTERN.test(digitsOnly)) continue;
    const isCurMag = CURRENCY_OR_MAGNITUDE.test(figure);
    if (!isCurMag && Number(digitsOnly) < 1000) continue;
    const before = text.slice(Math.max(0, match.index - 120), match.index);
    const after = text.slice(match.index + figure.length, match.index + figure.length + 120);
    if (SOURCE_MARKER.test(before) || SOURCE_MARKER.test(after)) continue;
    (isCurMag ? blocking : warnings).push(figure);
  }
  return { blocking: [...new Set(blocking)], warnings: [...new Set(warnings)] };
}
```

Also broaden `SOURCE_MARKER` to recognise markdown footnotes — add `\[\^?\d+\]` (covers `[1]` and `[^1]`). If other code imports `findUnsourcedFigures`, keep a thin wrapper returning `scanFigures(text).blocking`, or update callers.

## 2. Wire into the QC route
In `port/app/api/rfp-radar/[id]/qc-review/route.ts`: only `blocking` figures count toward pass/fail. Include `warnings` in the response payload so reviewers see them, but they must NOT fail the bundle. (CV-verification and ToR page/word/section checks stay as hard blocks — unchanged.)

## 3. Update tests + rules (keep them in sync)
- `port/lib/biz/__tests__/qc-scrub.test.ts`: assert `$20M` (no source) → blocking; `"40,000 educators"` (no source) → warning not blocking; `"$20M [1]"` or `"per ToR"` nearby → neither; `"[^1]"` recognised as a source marker.
- `.brain/memory/biz/auto-draft-scrub-list.md`: update the rule text so currency/magnitude unsourced = hard block, plain large integers unsourced = warning. Code and memory must match.

## 4. Run it
- `cd port && npm test` — all green (was 35; add the new cases). This is our CI substitute; paste the output.
- Run the migration against live Supabase: from `port/`, `npx supabase db push` (or paste `port/supabase/migrations/20260623_eligibility_verdict.sql` into the SQL editor). It's additive (two nullable columns + a partial index), safe anytime.
- Do NOT deploy or merge. Report the test output and confirm the migration ran; leave the PR for Garrett.

## 5. Agent-path follow-up (file, don't implement)
The hard gate covers the port route (human/board bids). The MCP `biz_*` tools (`biz_set_bid_decision`) are server-defined in the separate Biz connector and are NOT gated by this PR — an agent-set bid can still bypass eligibility. Open a follow-up issue to enforce the same eligibility check inside the connector's `biz_set_bid_decision` before it advances to pursuing (ideally by calling the same shared gate logic), and note in the PR description that agent-path enforcement is tracked separately. Do not block this PR on it.

Report back: files changed, test results, migration status, and the follow-up issue link.
