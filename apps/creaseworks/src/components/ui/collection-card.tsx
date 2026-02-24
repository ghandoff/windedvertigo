import Link from "next/link";

interface CollectionCardProps {
  slug: string;
  title: string;
  description: string | null;
  iconEmoji: string | null;
  playdateCount: number;
  /** Progress counts — null when user is not logged in */
  progress: {
    tried: number;
    found: number;
    folded: number;
    foundAgain: number;
  } | null;
  /** Number of evidence items in this collection */
  evidenceCount?: number;
}

export default function CollectionCard({
  slug,
  title,
  description,
  iconEmoji,
  playdateCount,
  progress,
  evidenceCount,
}: CollectionCardProps) {
  const hasTried = progress && progress.tried > 0;
  const pct = hasTried ? Math.round((progress.tried / playdateCount) * 100) : 0;

  return (
    <Link
      href={`/playbook/${slug}`}
      className="block rounded-xl border border-cadet/10 bg-white p-5 shadow-sm hover:shadow-md hover:border-sienna/40 transition-all"
    >
      <div className="flex items-start gap-3 mb-2">
        {iconEmoji && (
          <span className="text-xl leading-none mt-0.5" aria-hidden>
            {iconEmoji}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-cadet leading-snug">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-cadet/50 mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* progress bar — only renders when there's something to show */}
      {hasTried ? (
        <div className="mt-3">
          <div className="h-1 rounded-full bg-cadet/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-champagne transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-cadet/40 mt-1.5">
            {progress.tried} of {playdateCount} tried
            {progress.foundAgain > 0 && (
              <span className="text-redwood/70"> · {progress.foundAgain} found again</span>
            )}
            {!!evidenceCount && evidenceCount > 0 && (
              <span className="text-cadet/30"> · {evidenceCount} evidence</span>
            )}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-cadet/30 mt-3">
          {playdateCount} playdate{playdateCount !== 1 ? "s" : ""}
        </p>
      )}
    </Link>
  );
}
