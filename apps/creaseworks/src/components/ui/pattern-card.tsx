import Link from "next/link";

interface PatternCardProps {
  slug: string;
  title: string;
  headline: string | null;
  primaryFunction: string | null;
  arcEmphasis: string[];
  contextTags: string[];
  frictionDial: number | null;
  startIn120s: boolean;
  hasFindAgain?: boolean;
}

export function PatternCard({
  slug,
  title,
  headline,
  primaryFunction,
  arcEmphasis,
  contextTags,
  frictionDial,
  startIn120s,
  hasFindAgain,
}: PatternCardProps) {
  return (
    <Link
      href={`/sampler/${slug}`}
      className="block rounded-xl border border-cadet/10 bg-white p-6 shadow-sm hover:shadow-md hover:border-sienna/40 transition-all"
    >
      <h2 className="text-lg font-semibold text-cadet mb-1">{title}</h2>

      {headline && (
        <p className="text-sm text-cadet/60 mb-3">{headline}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {primaryFunction && (
          <span className="inline-block rounded-full bg-champagne px-2.5 py-0.5 text-xs font-medium text-cadet">
            {primaryFunction}
          </span>
        )}
        {arcEmphasis.map((arc) => (
          <span
            key={arc}
            className="inline-block rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs text-cadet/70"
          >
            {arc}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-cadet/50">
        {frictionDial !== null && (
          <span>effort: {frictionDial}/5</span>
        )}
        {startIn120s && <span>ready in 2 min</span>}
        {hasFindAgain && (
          <span className="inline-block rounded-full bg-sienna/10 px-2 py-0.5 text-xs font-medium text-sienna">
            spot it again
          </span>
        )}
      </div>
    </Link>
  );
}
