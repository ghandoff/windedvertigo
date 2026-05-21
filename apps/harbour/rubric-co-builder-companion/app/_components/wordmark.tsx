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
 * Image src manually prefixes BASE_PATH because `next/image` with
 * `unoptimized: true` doesn't auto-prepend basePath for string-literal
 * src values. Without this the image 404s (resolves to
 * /wordmark/wv-cadet.svg instead of /harbour/co-rubric-companion/wordmark/wv-cadet.svg).
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
      className={`no-print fixed bottom-0 inset-x-0 z-10 bg-white border-t flex items-center justify-end px-4 py-3 ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--color-cadet) 10%, transparent)",
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <a
        href="https://windedvertigo.com/harbour"
        aria-label="winded.vertigo — visit harbour"
        className="inline-flex items-center opacity-80 hover:opacity-100 transition-opacity"
      >
        <Image
          src={`${BASE_PATH}/wordmark/wv-cadet.svg`}
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
