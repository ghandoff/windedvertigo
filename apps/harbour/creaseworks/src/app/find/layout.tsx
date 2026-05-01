/**
 * Shared layout for all /find/* routes.
 *
 * Provides the cadet-blue background that persists across route
 * transitions (rooms ↔ classic ↔ challenge ↔ hunt), eliminating
 * the white flash caused by per-page background mounting/unmounting.
 *
 * Next.js layouts don't unmount during sibling navigation — that's
 * exactly why the background lives here instead of on each page.
 */

export default function MatcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen cw-find-bg"
    >
      {children}
    </div>
  );
}
