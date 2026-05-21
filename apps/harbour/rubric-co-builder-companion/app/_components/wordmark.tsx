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
        aria-label="winded.vertigo — visit harbour"
        className="inline-flex items-center opacity-90 hover:opacity-100 transition-opacity"
      >
        {/* Stacked WINDED VERTIGO wordmark (PR #123) — sourced as a
            dark-cadet PNG. PR #124 changed the footer bg to cadet, so
            the dark mark on cadet would be invisible. `filter:
            brightness(0) invert(1)` is a CSS-only inversion that
            turns any dark color into white while preserving the PNG's
            shape, stripes, and dimensional shading. If we ever want a
            "real" white-on-cadet variant of the wordmark, we can ship
            a wv-stacked-white.png and drop the filter. */}
        <Image
          src={`${BASE_PATH}/wordmark/wv-stacked.png`}
          alt="winded.vertigo"
          width={80}
          height={42}
          priority
          unoptimized
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </a>
    </footer>
  );
}
