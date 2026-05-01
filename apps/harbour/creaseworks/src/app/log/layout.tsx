/**
 * Shared layout for all /log/* routes (unfold phase).
 *
 * Sunshine/amber-tinted background — reflection, warmth.
 */

export default function UnfoldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen cw-unfold-bg">
      {children}
    </div>
  );
}
