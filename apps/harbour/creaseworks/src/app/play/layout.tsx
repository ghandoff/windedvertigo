/**
 * Shared layout for all /play/* routes (fold phase).
 *
 * Coral-tinted background — making, hands-on energy.
 */

export default function FoldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen cw-fold-bg">
      {children}
    </div>
  );
}
