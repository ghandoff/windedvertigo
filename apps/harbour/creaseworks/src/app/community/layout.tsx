/**
 * Shared layout for all /community/* routes (find again phase).
 *
 * Mint/teal-tinted background — fresh perspective, growth.
 */

export default function FindAgainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen cw-find-again-bg">
      {children}
    </div>
  );
}
