import Link from "next/link";
import Image from "next/image";

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
  /** Cover image URL from R2 */
  coverUrl?: string | null;
}

export default function CollectionCard({
  slug,
  title,
  description,
  iconEmoji,
  playdateCount,
  progress,
  evidenceCount,
  coverUrl,
}: CollectionCardProps) {
  const hasTried = progress && progress.tried > 0;
  const pct = hasTried ? Math.round((progress.tried / playdateCount) * 100) : 0;

  return (
    <Link
      href={`/playbook/${slug}`}
      className="block rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{ background: "var(--wv-cream)", border: "1.5px solid rgba(39, 50, 72, 0.08)" }}
    >
      {/* cover image header */}
      {coverUrl && (
        <div className="relative w-full h-[100px] overflow-hidden">
          <Image
            src={coverUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
        </div>
      )}

      <div className="p-5">
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
              className="h-full rounded-full bg-cream transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-cadet/40 mt-1.5">
            {progress.tried} of {playdateCount} tried
            {progress.foundAgain > 0 && (
              <span className="text-redwood/70"> · {progress.foundAgain} found again</span>
            )}
            {!!evidenceCount && evidenceCount > 0 && (
              <span className="text-cadet/40"> · {evidenceCount} evidence</span>
            )}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-cadet/40 mt-3">
          {playdateCount} playdate{playdateCount !== 1 ? "s" : ""}
        </p>
      )}
      </div>
    </Link>
  );
}
