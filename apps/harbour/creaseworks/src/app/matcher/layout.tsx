/**
 * Shared layout for /matcher routes (find phase).
 *
 * Sky-blue tinted background — discovery, curiosity.
 */

export default function MatcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen cw-find-bg">
      {children}
    </div>
  );
}
