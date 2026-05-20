import Image from "next/image";

/**
 * Site footer for the co.rubric companion.
 *
 * Replaces the previous floating wordmark that hovered at the bottom-left.
 * Now lives in a short, full-width white bar at the bottom of the page,
 * with the wv-cadet.svg wordmark right-aligned. Tapping the wordmark
 * navigates to windedvertigo.com/harbour. Kept intentionally small in
 * height so it doesn't rob mobile viewfinder real estate.
 *
 * Hidden on print by the `.no-print` class (see globals.css print rules).
 *
 * The component is still named Wordmark to avoid touching every layout
 * import site-wide. Functionally it's a footer now.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <footer
      role="contentinfo"
      className={`no-print w-full bg-white border-t flex items-center justify-end px-4 py-3 ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--color-cadet) 10%, transparent)",
      }}
    >
      <a
        href="https://windedvertigo.com/harbour"
        aria-label="winded.vertigo — visit harbour"
        className="inline-flex items-center opacity-80 hover:opacity-100 transition-opacity"
      >
        <Image
          src="/wordmark/wv-cadet.svg"
          alt="winded.vertigo"
          width={110}
          height={20}
          priority
          unoptimized
        />
      </a>
    </footer>
  );
}
