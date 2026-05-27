import Image from "next/image";
import { BASE_PATH } from "@/lib/paths";

/**
 * Site footer for the co.rubric companion.
 *
 * Pinned to the viewport bottom (`position: fixed`) so it's always
 * visible regardless of scroll position on long workshop pages. The
 * fixed positioning takes the footer out of flow, which means any
 * scrollable content needs bottom padding to clear the footer (see
 * layout.tsx — `pb-20` on the page wrapper).
 *
 * Wordmark: the stacked WINDED VERTIGO PNG (wv-stacked.png), pinned
 * to the LEFT of the footer (PR #123). Previously the flat horizontal
 * SVG (wv-cadet.svg), right-aligned. The stacked treatment is more
 * visually distinctive in a small footer space.
 *
 * Image src manually prefixes BASE_PATH because `next/image` with
 * `unoptimized: true` doesn't auto-prepend basePath for string-literal
 * src values. Without this the image 404s.
 *
 * `env(safe-area-inset-bottom)` keeps the wordmark above the iPhone
 * home indicator when the page is added to home screen as a PWA.
 * `.no-print` hides the footer when printing (see globals.css).
 *
 * The component is still named Wordmark to avoid touching every layout
 * import site-wide. Functionally it's a fixed footer.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <footer
      role="contentinfo"
      className={`no-print fixed bottom-0 inset-x-0 z-10 flex items-center justify-start px-4 py-2 ${className}`}
      style={{
        background: "var(--color-cadet)",
        paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
      }}
    >
      <a
        href="https://windedvertigo.com/harbour"
        aria-label="winded.vertigo · visit harbour"
        className="inline-flex items-center opacity-80 hover:opacity-100 transition-opacity"
      >
        {/* Stacked WINDED VERTIGO wordmark (PR #123). Footer reverted
            to white bg in PR #125, so the dark-cadet PNG renders at
            its natural color and reads cleanly. The earlier inversion
            filter (PR #124) was dropped per Garrett's feedback. */}
        <Image
          src={`${BASE_PATH}/wordmark/wv-stacked.png`}
          alt="winded.vertigo"
          width={80}
          height={42}
          priority
          unoptimized
        />
      </a>
    </footer>
  );
}
