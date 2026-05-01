"use client";

/**
 * Matcher result card — playful, warm, child-friendly.
 *
 * Replaces the numeric score with a visual match quality indicator
 * (stars + color), uses friendlier language, bigger touch targets,
 * and more inviting CTAs.
 */

import { useState } from "react";
import Link from "next/link";
import { MaterialIllustration } from "@/components/material-illustration";
import CharacterSlot, {
  resolveCharacterFromForm,
  type CharacterName,
} from "@windedvertigo/characters";
import { useCharacterVariant } from "@windedvertigo/characters/variant-context";

/* ── types ─────────────────────────────────────────────────────────── */

interface SubstitutionSuggestion {
  missingMaterial: string;
  availableAlternatives: { id: string; title: string }[];
}

interface Coverage {
  materialsCovered: { id: string; title: string; formPrimary: string }[];
  materialsMissing: { id: string; title: string; formPrimary: string }[];
  formsCovered: string[];
  formsMissing: string[];
  suggestedSubstitutions: SubstitutionSuggestion[];
}

interface RankedPlaydate {
  playdateId: string;
  slug: string;
  title: string;
  headline: string | null;
  score: number;
  primaryFunction: string | null;
  arcEmphasis: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  coverage: Coverage;
  substitutionsNotes: string | null;
  hasFindAgain: boolean;
  findAgainMode: string | null;
  isEntitled: boolean;
  packSlugs: string[];
}

/* ── helpers ───────────────────────────────────────────────────────── */

/** Convert 0-100 score to a playful match quality label + emoji. */
function getMatchQuality(score: number) {
  if (score >= 80)
    return { label: "perfect match!", emoji: "🌟", stars: 3, color: "var(--wv-redwood)" };
  if (score >= 55)
    return { label: "great match", emoji: "⭐", stars: 2, color: "var(--wv-sienna)" };
  if (score >= 30)
    // UDL fix: champagne on a white card is ~1.15:1 (invisible).
    // Use sienna — same warm accent family, 3.7:1 AA large-text on white.
    return { label: "good match", emoji: "✨", stars: 1, color: "var(--wv-sienna)" };
  return { label: "worth a try", emoji: "💫", stars: 0, color: "rgba(39, 50, 72, 0.45)" };
}

/** One-liner identity per character. Used to turn a cast set into a
 *  short tagline like "bendy meets holder meets drape" that sits next
 *  to the cast avatars as the playdate's pedagogical read.             */
const CHARACTER_VERB: Record<CharacterName, string> = {
  cord:   "bendy",
  twig:   "stiff",
  swatch: "drape",
  jugs:   "holder",
  crate:  "stack",
  mud:    "shape-shifter",
  drip:   "flow",
};

/** Deduplicate + order-preserve characters encountered in the cast.
 *  Covered materials come first (the kid brought them); missing after
 *  (swap candidates). We take the cast across BOTH so the card always
 *  represents the playdate's full material family lineup.              */
function resolveCast(coverage: Coverage): CharacterName[] {
  const seen = new Set<CharacterName>();
  const out: CharacterName[] = [];
  const all = [...coverage.materialsCovered, ...coverage.materialsMissing];
  for (const m of all) {
    const c = resolveCharacterFromForm(m.formPrimary, m.title);
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/* ── component ─────────────────────────────────────────────────────── */

export default function MatcherResultCard({
  playdate,
}: {
  playdate: RankedPlaydate;
}) {
  const { coverage } = playdate;
  const match = getMatchQuality(playdate.score);
  const hasCoverageDetail =
    coverage.materialsCovered.length > 0 ||
    coverage.materialsMissing.length > 0 ||
    coverage.formsCovered.length > 0 ||
    coverage.formsMissing.length > 0;

  // Resolve the cast of characters this playdate's materials belong to.
  // Gives every result a pedagogical read ("Cord meets Crate: bendy meets
  // holder") without requiring new DB fields — the character taxonomy
  // lives in form_primary already and the cast surfaces it.
  const cast = resolveCast(coverage);
  const castTagline =
    cast.length >= 2
      ? cast.map((c) => CHARACTER_VERB[c]).join(" · ")
      : null;
  // Ambient kid/grownup register — passed explicitly to the cast avatars
  // so the toggle in /profile propagates to result cards automatically.
  const characterVariant = useCharacterVariant();

  const [coverageOpen, setCoverageOpen] = useState(false);

  return (
    <div
      role="group"
      aria-label={`${playdate.title} — ${match.label}`}
      className="rounded-2xl border-2 p-5"
      style={{
        borderColor: "rgba(39, 50, 72, 0.08)",
        backgroundColor: "var(--wv-white)",
        transition: "all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow =
          "0 6px 24px rgba(203, 120, 88, 0.12)";
        e.currentTarget.style.borderColor = "rgba(203, 120, 88, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "rgba(39, 50, 72, 0.08)";
      }}
    >
      {/* ── header: match quality + title ──────────────── */}
      <div className="flex items-start gap-3">
        {/* match quality badge — visual, not numeric */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl w-14 h-14"
          style={{
            backgroundColor: `${match.color}18`,
          }}
        >
          <span className="text-xl leading-none">{match.emoji}</span>
          <span
            className="text-[9px] font-bold mt-0.5 tracking-wider"
            style={{ color: match.color }}
          >
            {playdate.score}%
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="text-base sm:text-lg font-bold tracking-tight leading-snug"
            style={{ color: "var(--wv-cadet)" }}
          >
            {playdate.title}
          </h3>
          {playdate.headline && (
            <p
              className="text-sm mt-0.5 line-clamp-2"
              style={{ color: "var(--color-text-on-cream-muted)" }}
            >
              {playdate.headline}
            </p>
          )}
          {/* match quality label */}
          <p
            className="text-xs font-medium mt-1"
            style={{ color: match.color }}
          >
            {match.label}
          </p>
        </div>
      </div>

      {/* ── tags row ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {playdate.primaryFunction && (
          <span
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              // don't use var(--wv-champagne) here — globals.css line 986
              // hijacks it to a dark brown inside .cw-find-bg to fix legacy
              // text-on-cadet components. for this pill we need a cream-ish
              // bg with cadet text, so use a warm sienna-tinted surface +
              // sienna text to stay in the card's warm accent family.
              backgroundColor: "rgba(203, 120, 88, 0.14)",
              color: "var(--wv-sienna)",
              fontWeight: 600,
            }}
          >
            {playdate.primaryFunction}
          </span>
        )}
        {playdate.arcEmphasis.map((arc) => (
          <span
            key={arc}
            className="rounded-full px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "rgba(39, 50, 72, 0.05)",
              color: "var(--wv-cadet)",
              opacity: 0.7,
            }}
          >
            {arc}
          </span>
        ))}
        {playdate.startIn120s && (
          <span
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: "rgba(177, 80, 67, 0.1)",
              color: "var(--wv-redwood)",
            }}
          >
            ⚡ ready in 2 min
          </span>
        )}
        {playdate.frictionDial != null && (
          <span
            className="text-xs px-1"
            style={{ color: "var(--color-text-on-cream-muted)" }}
          >
            {"🟢🟡🟠🔴🔴".charAt(playdate.frictionDial - 1) || "🟢"}{" "}
            effort {playdate.frictionDial}/5
          </span>
        )}
        {playdate.hasFindAgain &&
          (playdate.isEntitled && playdate.findAgainMode ? (
            <span
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(177, 80, 67, 0.1)",
                color: "var(--wv-redwood)",
              }}
            >
              🔄 find again: {playdate.findAgainMode}
            </span>
          ) : (
            <span
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(203, 120, 88, 0.1)",
                color: "var(--wv-sienna)",
              }}
            >
              ✨ includes find again
            </span>
          ))}
      </div>

      {/* ── cast row — the playdate as a character pairing ─
          Renders every harbour character whose form_primary
          appears in this playdate's materials. 2+ characters is
          where this gets interesting ("Cord meets Crate: bendy
          meets holder"). Quiet enough not to dominate, present
          enough to carry the pedagogical read.                */}
      {cast.length >= 2 && (
        <div
          className="flex items-center gap-3 mt-3 pt-3 border-t"
          style={{ borderColor: "rgba(39, 50, 72, 0.05)" }}
          aria-label={`cast: ${cast.join(" meets ")} — ${castTagline}`}
        >
          <div className="flex items-center" style={{ gap: 4 }}>
            {cast.map((c, i) => (
              <span
                key={c}
                className="inline-flex items-center justify-center"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(203, 120, 88, 0.08)",
                  marginLeft: i === 0 ? 0 : -6, // overlap for cast-feel
                  border: "1.5px solid var(--wv-cream, #fff6e8)",
                  flexShrink: 0,
                }}
              >
                <CharacterSlot
                  character={c}
                  size={28}
                  animate={false}
                  variant={characterVariant}
                />
              </span>
            ))}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className="text-xs font-bold leading-tight"
              style={{
                color: "var(--wv-sienna)",
                letterSpacing: "0.02em",
              }}
            >
              {cast.join(" meets ")}
            </span>
            {castTagline && (
              <span
                className="text-xs mt-0.5 leading-tight truncate"
                style={{
                  color: "var(--wv-cadet)",
                  opacity: 0.55,
                }}
              >
                {castTagline}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── coverage detail ────────────────────────────── */}
      {hasCoverageDetail && (
        <div
          className="mt-3 pt-3 border-t"
          style={{ borderColor: "rgba(39, 50, 72, 0.05)" }}
        >
          {/* mobile toggle */}
          <button
            type="button"
            onClick={() => setCoverageOpen(!coverageOpen)}
            aria-expanded={coverageOpen}
            className="flex items-center gap-1.5 text-xs font-medium sm:hidden mb-2"
            style={{ color: "var(--wv-cadet)", opacity: 0.65 }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform duration-200"
              style={{
                transform: coverageOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {coverageOpen ? "hide details" : "what you need"}
            <span style={{ opacity: 0.7 }}>
              ({coverage.materialsCovered.length} of{" "}
              {coverage.materialsCovered.length +
                coverage.materialsMissing.length}{" "}
              materials)
            </span>
          </button>

          <div className={`${coverageOpen ? "" : "hidden"} sm:block`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(coverage.materialsCovered.length > 0 ||
                coverage.materialsMissing.length > 0) && (
                <div>
                  <h4
                    className="font-bold mb-1"
                    style={{ color: "var(--color-text-on-cream-muted)" }}
                  >
                    materials
                  </h4>
                  <div className="space-y-0.5">
                    {coverage.materialsCovered.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-1.5"
                        style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
                      >
                        <MaterialIllustration formPrimary={m.formPrimary} size={16} />
                        <span style={{ color: "#22c55e" }}>✓</span>
                        {m.title}
                      </div>
                    ))}
                    {coverage.materialsMissing.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-1.5"
                        style={{ color: "var(--wv-cadet)", opacity: 0.62 }}
                      >
                        <MaterialIllustration formPrimary={m.formPrimary} size={16} />
                        <span style={{ color: "var(--wv-redwood)" }}>✗</span>
                        {m.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(coverage.formsCovered.length > 0 ||
                coverage.formsMissing.length > 0) && (
                <div>
                  <h4
                    className="font-bold mb-1"
                    style={{ color: "var(--color-text-on-cream-muted)" }}
                  >
                    types
                  </h4>
                  <div className="space-y-0.5">
                    {coverage.formsCovered.map((f) => (
                      <div
                        key={f}
                        style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
                      >
                        <span style={{ color: "#22c55e" }}>
                          ✓
                        </span>{" "}
                        {f}
                      </div>
                    ))}
                    {coverage.formsMissing.map((f) => (
                      <div
                        key={f}
                        style={{ color: "var(--wv-cadet)", opacity: 0.62 }}
                      >
                        <span style={{ color: "var(--wv-redwood)" }}>✗</span>{" "}
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── substitution suggestions ───────────────────── */}
      {coverage.suggestedSubstitutions.length > 0 && (
        <div
          className="mt-3 rounded-xl p-4 text-xs"
          style={{
            // UDL time-bomb fix: previously bg used var(--wv-champagne)
            // AND text used var(--wv-cadet). Inside .cw-find-bg the hijack
            // remapped champagne → #3a3024 so this rendered as dark-brown
            // on dark-cadet at ~1.4:1 — invisible copy. Now the bg uses
            // the semantic surface-cream token (stable across routes) and
            // the text is cadet for 10.3:1 AAA regardless of parent.
            backgroundColor: "var(--color-surface-cream)",
            color: "var(--color-text-on-cream)",
            border: "1px solid rgba(39, 50, 72, 0.08)",
          }}
        >
          <h4 className="font-bold mb-1">💡 swap ideas</h4>
          {coverage.suggestedSubstitutions.map((sub, i) => (
            <p key={i} style={{ opacity: 0.8 }}>
              instead of <strong>{sub.missingMaterial}</strong>, try{" "}
              {sub.availableAlternatives.map((a) => a.title).join(" or ")}
            </p>
          ))}
        </div>
      )}

      {/* ── author substitution notes ──────────────────── */}
      {playdate.isEntitled && playdate.substitutionsNotes && (
        <div
          className="mt-3 rounded-xl p-4 text-xs"
          style={{
            backgroundColor: "rgba(177, 80, 67, 0.05)",
            color: "var(--wv-cadet)",
          }}
        >
          <h4
            className="font-bold mb-1"
            style={{ color: "var(--wv-redwood)" }}
          >
            🔧 tips on swapping materials
          </h4>
          <p style={{ opacity: 0.8 }}>{playdate.substitutionsNotes}</p>
        </div>
      )}

      {/* ── CTAs ───────────────────────────────────────── */}
      {playdate.packSlugs.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          {playdate.isEntitled
            ? playdate.packSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/packs/${slug}/playdates/${playdate.slug}`}
                  className="flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{
                    backgroundColor: "var(--wv-redwood)",
                    color: "var(--wv-white)",
                    minHeight: 48,
                    boxShadow: "0 2px 12px rgba(177, 80, 67, 0.2)",
                  }}
                >
                  let&apos;s make this! →
                </Link>
              ))
            : playdate.packSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/packs/${slug}`}
                  className="flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--wv-redwood)",
                    border: "2px solid var(--wv-redwood)",
                    minHeight: 48,
                  }}
                >
                  see the pack →
                </Link>
              ))}
        </div>
      )}

      {/* sampler-only playdates */}
      {playdate.packSlugs.length === 0 && (
        <div className="mt-4">
          <Link
            href={`/sampler/${playdate.slug}`}
            className="inline-flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold transition-opacity hover:opacity-80 active:scale-[0.97]"
            style={{ color: "var(--wv-redwood)", minHeight: 48 }}
          >
            check it out →
          </Link>
        </div>
      )}
    </div>
  );
}
