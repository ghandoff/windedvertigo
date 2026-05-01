/**
 * Shared empty-state component with brand-aligned SVG illustrations.
 *
 * Provides a consistent look for "nothing here yet" states across
 * the app: a centred illustration, heading, subtext, and optional CTA.
 *
 * Each `type` maps to a hand-crafted SVG using brand colours
 * (sienna, champagne, cadet, redwood) at low opacity so they feel
 * warm and unobtrusive.
 *
 * All SVG is rendered as React JSX elements — no raw HTML injection.
 */

import Link from "next/link";

/* ── illustration types ── */
type IllustrationType =
  | "bookshelf"    // playbook collections
  | "journal"      // reflections list / run-list
  | "magnifier"    // matcher no-results
  | "seedling";    // generic "growing" fallback

interface EmptyStateProps {
  type: IllustrationType;
  heading: string;
  body: string;
  /** Optional call-to-action */
  cta?: { label: string; href: string };
}

/* ── SVG illustrations ── */

function BookshelfIllustration() {
  return (
    <svg
      viewBox="0 0 80 60"
      width={80}
      height={60}
      className="mx-auto mb-4"
      aria-hidden="true"
    >
      {/* shelf */}
      <rect
        x="10" y="46" width="60" height="2" rx="1"
        fill="var(--wv-sienna)" opacity="0.25"
      />
      {/* book 1 — tall, leaning */}
      <rect
        x="18" y="14" width="8" height="32" rx="1.5"
        fill="var(--wv-champagne)" stroke="var(--wv-sienna)"
        strokeWidth="0.8" opacity="0.6"
        transform="rotate(-4 22 30)"
      />
      {/* book 2 — medium */}
      <rect
        x="28" y="20" width="7" height="26" rx="1.5"
        fill="none" stroke="var(--wv-sienna)"
        strokeWidth="1" opacity="0.4"
      />
      {/* book 3 — short, thick */}
      <rect
        x="37" y="26" width="10" height="20" rx="1.5"
        fill="var(--wv-champagne)" stroke="var(--wv-sienna)"
        strokeWidth="0.8" opacity="0.5"
      />
      {/* book 4 — tall */}
      <rect
        x="49" y="16" width="7" height="30" rx="1.5"
        fill="none" stroke="var(--wv-sienna)"
        strokeWidth="1" opacity="0.35"
        transform="rotate(3 52 31)"
      />
      {/* spine lines */}
      <line x1="22" y1="18" x2="22" y2="42" stroke="var(--wv-sienna)" strokeWidth="0.5" opacity="0.2" />
      <line x1="42" y1="30" x2="42" y2="42" stroke="var(--wv-sienna)" strokeWidth="0.5" opacity="0.2" />
      {/* sparkle */}
      <path
        d="M62 12l1.5 3 3 0.4-2.2 2.2 0.4 3-2.7-1.4-2.7 1.4 0.4-3-2.2-2.2 3-0.4z"
        fill="var(--wv-champagne)" stroke="var(--wv-sienna)"
        strokeWidth="0.6" opacity="0.5"
      />
    </svg>
  );
}

function JournalIllustration() {
  return (
    <svg
      viewBox="0 0 80 60"
      width={80}
      height={60}
      className="mx-auto mb-4"
      aria-hidden="true"
    >
      {/* notebook cover */}
      <rect
        x="18" y="10" width="38" height="40" rx="2"
        fill="var(--wv-champagne)" stroke="var(--wv-sienna)"
        strokeWidth="1" opacity="0.5"
      />
      {/* spine binding */}
      <line
        x1="24" y1="10" x2="24" y2="50"
        stroke="var(--wv-sienna)" strokeWidth="1.2" opacity="0.3"
      />
      {/* writing lines */}
      <line x1="28" y1="20" x2="50" y2="20" stroke="var(--wv-sienna)" strokeWidth="0.6" opacity="0.15" />
      <line x1="28" y1="26" x2="48" y2="26" stroke="var(--wv-sienna)" strokeWidth="0.6" opacity="0.15" />
      <line x1="28" y1="32" x2="46" y2="32" stroke="var(--wv-sienna)" strokeWidth="0.6" opacity="0.15" />
      <line x1="28" y1="38" x2="42" y2="38" stroke="var(--wv-sienna)" strokeWidth="0.6" opacity="0.15" />
      {/* pencil */}
      <line
        x1="52" y1="42" x2="62" y2="14"
        stroke="var(--wv-redwood)" strokeWidth="1.5"
        strokeLinecap="round" opacity="0.4"
      />
      <circle cx="52" cy="42" r="1" fill="var(--wv-redwood)" opacity="0.4" />
      {/* eraser end */}
      <line
        x1="62" y1="14" x2="63" y2="11"
        stroke="var(--wv-sienna)" strokeWidth="2.5"
        strokeLinecap="round" opacity="0.3"
      />
    </svg>
  );
}

function MagnifierIllustration() {
  return (
    <svg
      viewBox="0 0 80 60"
      width={80}
      height={60}
      className="mx-auto mb-4"
      aria-hidden="true"
    >
      {/* magnifier glass */}
      <circle
        cx="34" cy="26" r="14"
        fill="none" stroke="var(--wv-sienna)"
        strokeWidth="1.5" opacity="0.4"
      />
      <circle
        cx="34" cy="26" r="10"
        fill="var(--wv-champagne)" opacity="0.2"
      />
      {/* handle */}
      <line
        x1="44" y1="36" x2="56" y2="48"
        stroke="var(--wv-sienna)" strokeWidth="2.5"
        strokeLinecap="round" opacity="0.35"
      />
      {/* question mark inside */}
      <text
        x="34" y="30" textAnchor="middle"
        dominantBaseline="central"
        fontSize="12" fontWeight="600"
        fill="var(--wv-sienna)" opacity="0.25"
      >
        ?
      </text>
      {/* scattered dots — things not quite found */}
      <circle cx="60" cy="14" r="1.5" fill="var(--wv-sienna)" opacity="0.12" />
      <circle cx="66" cy="22" r="1" fill="var(--wv-sienna)" opacity="0.1" />
      <circle cx="14" cy="42" r="1.2" fill="var(--wv-sienna)" opacity="0.1" />
      <circle cx="18" cy="12" r="1" fill="var(--wv-sienna)" opacity="0.08" />
    </svg>
  );
}

function SeedlingIllustration() {
  return (
    <svg
      viewBox="0 0 80 60"
      width={80}
      height={60}
      className="mx-auto mb-4"
      aria-hidden="true"
    >
      {/* ground line */}
      <path
        d="M10 48c10-2 20-1 30-2s20-1 30-2"
        stroke="var(--wv-sienna)" strokeWidth="1"
        strokeLinecap="round" fill="none" opacity="0.2"
      />
      {/* stem */}
      <path
        d="M40 48c0-8 -1-14 0-20"
        stroke="var(--wv-sienna)" strokeWidth="1.2"
        strokeLinecap="round" fill="none" opacity="0.35"
      />
      {/* left leaf */}
      <path
        d="M40 34c-8-4-14-2-14 4 0 4 6 5 14-4z"
        fill="var(--wv-champagne)" stroke="var(--wv-sienna)"
        strokeWidth="0.8" opacity="0.45"
      />
      {/* right leaf */}
      <path
        d="M40 28c6-6 14-6 14 0 0 4-6 6-14 0z"
        fill="var(--wv-champagne)" stroke="var(--wv-sienna)"
        strokeWidth="0.8" opacity="0.45"
      />
      {/* sparkle */}
      <path
        d="M50 16l1.2 2.4 2.4 0.3-1.8 1.8 0.3 2.4-2.1-1.1-2.1 1.1 0.3-2.4-1.8-1.8 2.4-0.3z"
        fill="var(--wv-champagne)" stroke="var(--wv-sienna)"
        strokeWidth="0.5" opacity="0.4"
      />
    </svg>
  );
}

const ILLUSTRATIONS: Record<IllustrationType, () => React.ReactElement> = {
  bookshelf: BookshelfIllustration,
  journal: JournalIllustration,
  magnifier: MagnifierIllustration,
  seedling: SeedlingIllustration,
};

/* ── public component ── */

export default function EmptyState({ type, heading, body, cta }: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[type];

  return (
    <div
      className="rounded-xl p-10 text-center max-w-md mx-auto"
      style={{
        background: "var(--wv-cream)",
        border: "1.5px solid rgba(39, 50, 72, 0.08)",
      }}
    >
      <Illustration />
      <p
        className="text-base font-medium mb-1"
        style={{ color: "var(--wv-sienna)" }}
      >
        {heading}
      </p>
      <p className="text-sm text-cadet/50 leading-relaxed">
        {body}
      </p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block mt-4 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
