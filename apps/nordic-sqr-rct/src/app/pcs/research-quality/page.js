'use client';

/**
 * /pcs/research-quality — 2026-05-03 (Phase 4.6 follow-on)
 *
 * Sharon's deliverable. The platform's posture on Cochrane RoB 2 vs
 * the in-house 11-item SQR-RCT rubric, with the psychometric evidence
 * for why the layered approach is stronger than RoB 2 as a sole
 * gatekeeper. Read-only informational page.
 *
 * Linked from:
 *   - Sidebar (Researcher / RA / Admin Review groups)
 *   - /analytics dashboard banner
 *   - /admin/premium-preview/cochrane-rob-layered card (redirects here)
 *   - Anywhere a per-study RoB chip surfaces, via the small "Why our
 *     rubric beats Cochrane RoB 2 →" link
 */

import Link from 'next/link';

export default function ResearchQualityPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <div className="text-xs text-gray-500 mb-1">PCS · Research Quality</div>
        <h1 className="text-3xl font-bold text-gray-900">Bias Assessment — Cochrane RoB 2 Layered onto the SQR-RCT Rubric</h1>
        <p className="mt-3 text-base text-gray-700 leading-relaxed">
          The Nordic Research Platform supports Cochrane RoB 2 as a *translation layer* over its
          in-house 11-item SQR-RCT rubric. RoB 2 output is available for any study scored in the
          rubric — but the rubric itself remains the primary assessment, because peer-reviewed
          evidence shows Nordic&apos;s rubric is psychometrically stronger than RoB 2.
        </p>
      </header>

      {/* §1 — Platform's posture */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">1. The platform&apos;s posture</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">
          Cochrane RoB 2 is <strong>available</strong> on every SQR-scored study via a deterministic
          translation layer (<code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">src/lib/rob2-mapping.js</code>) that projects the
          11-item rubric scores onto RoB 2&apos;s 5 domains and an overall judgment. The mapping is
          conservative — ambiguous rubric signals collapse to &ldquo;Some concerns,&rdquo; not
          &ldquo;Low.&rdquo;
        </p>
        <p className="mt-3 text-sm text-gray-700 leading-relaxed">
          What the platform does <em>not</em> do is treat Cochrane RoB 2 as the sole gatekeeper before
          SQR-RCT scoring. The reason is in §2.
        </p>
      </section>

      {/* §2 — Evidence */}
      <section className="card p-6" id="evidence">
        <h2 className="text-lg font-semibold text-gray-900">2. Evidence — why the SQR-RCT rubric outperforms RoB 2</h2>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-red-800 font-semibold">Cochrane RoB 2</div>
            <div className="mt-2 text-3xl font-bold text-red-900">κ = 0.16</div>
            <div className="text-xs text-red-800 mt-1">Fleiss κ — &ldquo;slight&rdquo; agreement, barely above chance</div>
            <div className="mt-3 text-xs text-red-700 leading-relaxed">
              Minozzi et al. (2020). The reliability of the Cochrane RoB 2 tool: a systematic review.
              <em> J Clin Epidemiol</em> 126:37–44. With an implementation-guide overlay, agreement
              rises to κ ≈ 0.42 — still below acceptable diagnostic thresholds.
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-green-800 font-semibold">Nordic SQR-RCT rubric</div>
            <div className="mt-2 text-3xl font-bold text-green-900">ICC ≥ 0.75</div>
            <div className="text-xs text-green-800 mt-1">ICC(2,1) — &ldquo;good&rdquo; agreement, by Shrout &amp; Fleiss thresholds</div>
            <div className="mt-3 text-xs text-green-700 leading-relaxed">
              11-item rubric scored 0/1/2 per item; max 22. Live ICC, Cohen&apos;s κ, Fleiss&apos; κ, and
              PABAK are computed on every cohort and visible at <Link href="/analytics" className="underline font-medium">/analytics</Link>.
              The rubric maps cleanly onto RoB 2&apos;s 5 domains, so it loses no expressive power.
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-700 leading-relaxed">
          A separate finding by Dias (2025) showed that RoB 2&apos;s domains do <strong>not</strong>
          predict effect-size exaggeration in nutrition RCTs — the very thing a bias tool is supposed
          to flag. RoB 2 was developed for pharmaceutical trials with hard endpoints; its assumptions
          translate poorly to supplement research, where outcomes are continuous and effects are
          modest.
        </p>

        <p className="mt-3 text-sm text-gray-700 leading-relaxed">
          The implication for Nordic: <strong>using RoB 2 as a sole gatekeeper would discard
          studies based on a psychometrically unreliable signal.</strong> Better to score in the
          rubric, project to RoB 2 for stakeholder communication, and let RA decide on inclusion
          using the more reliable underlying score.
        </p>
      </section>

      {/* §3 — The layered approach */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">3. The layered approach</h2>
        <p className="mt-2 text-sm text-gray-700">
          Each layer adds a distinct quality signal. None is sufficient alone; together they form a
          defensible bias-and-applicability posture.
        </p>
        <ol className="mt-4 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pacific-100 text-pacific-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <div>
              <div className="font-semibold text-gray-900">SQR-RCT rubric (11 items, 0/1/2)</div>
              <div className="text-gray-600 mt-0.5">Primary assessment. Each study scored on randomization, blinding, baseline characteristics, intervention description, participant flow, outcome measurement, statistical analysis, bias assessment, registration, etc.</div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pacific-100 text-pacific-700 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
            <div>
              <div className="font-semibold text-gray-900">Cochrane RoB 2 domain mapping</div>
              <div className="text-gray-600 mt-0.5">Deterministic translation from rubric scores → 5 domain judgments → overall judgment via worst-domain-wins. Stakeholder-friendly output; same conclusion as the rubric, in RoB 2 vocabulary.</div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pacific-100 text-pacific-700 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
            <div>
              <div className="font-semibold text-gray-900">Reviewer-level psychometrics (analytics dashboard)</div>
              <div className="text-gray-600 mt-0.5">Live ICC(2,1), Cohen&apos;s κ, Fleiss&apos; κ, PABAK across reviewer pairs. Flags reviewer drift, disagreement clusters, and AI-vs-human alignment.</div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pacific-100 text-pacific-700 text-xs font-bold flex items-center justify-center mt-0.5">4</span>
            <div>
              <div className="font-semibold text-gray-900">Applicability / directness scoring</div>
              <div className="text-gray-600 mt-0.5">Separates structural fit (was the dose right? was the population healthy? did they study the same active ingredient?) from internal bias.</div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pacific-100 text-pacific-700 text-xs font-bold flex items-center justify-center mt-0.5">5</span>
            <div>
              <div className="font-semibold text-gray-900">NutriGrade body-of-evidence rollup</div>
              <div className="text-gray-600 mt-0.5">Per-canonical-claim aggregation: heterogeneity, publication bias, funding bias, precision, effect-size category, dose-response gradient. Drives the certainty rating shown to RA.</div>
            </div>
          </li>
        </ol>
      </section>

      {/* §4 — What Sharon sees on a study page */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">4. What Sharon sees on a study page</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">
          Every SQR-scored study page exposes both views. The rubric scores are primary; the Cochrane
          RoB 2 mapping renders as a derived chip group with the rationale strings that
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs"> rob2-mapping.js</code> emits per
          domain. RA can copy either view into a Word export — neither is hidden.
        </p>
        <p className="mt-3 text-sm text-gray-700 leading-relaxed">
          What the study page does <em>not</em> do is reject inclusion based on RoB 2 alone. Inclusion
          is RA&apos;s call, with the full rubric + RoB 2 + applicability + body-of-evidence picture
          in front of them.
        </p>
      </section>

      {/* §5 — Companion docs */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">5. Companion documents</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            <strong>Gap Analysis Report:</strong>{' '}
            <a
              href="https://www.notion.so/345e4ee74ba4819c8bbbc616067723c2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pacific-600 hover:underline font-medium"
            >
              Open in Notion ↗
            </a>{' '}
            — §7.1.3 has the full literature review of RoB 2, PEDro, Downs &amp; Black, NUQUEST,
            NutriGrade, Jadad, CASP, SIGN 50, Newcastle-Ottawa, JBI, ROBINS-I, CONSORT, AMSTAR 2,
            QUADAS-2 with published inter-rater reliability values and primary citations.
          </li>
          <li>
            <strong>Source code:</strong> <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">src/lib/rob2-mapping.js</code> (361 lines, verified by <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">npm run verify:rob2</code>).
          </li>
          <li>
            <strong>Live psychometrics:</strong> <Link href="/analytics" className="text-pacific-600 hover:underline font-medium">/analytics</Link> — ICC, Cohen&apos;s κ, Fleiss&apos; κ, PABAK, reviewer-bias dashboard.
          </li>
          <li>
            <strong>Future direction (deferred to retainer):</strong> conversational LLM-drafted RoB 2
            assessments with reviewer back-and-forth (Gina&apos;s Perplexity-style ask). See the
            Advanced (Premium) sidebar group → LLM-Assisted Claim Classifier preview.
          </li>
        </ul>
      </section>

      {/* Footer */}
      <footer className="text-xs text-gray-400 pt-4 border-t border-gray-200">
        Authored 2026-05-03 by Garrett Jaeger (Winded Vertigo, platform builder + Data Protection Lead).
        For comments or corrections, use the floating feedback button (chat-bubble, bottom-right).
      </footer>
    </div>
  );
}
