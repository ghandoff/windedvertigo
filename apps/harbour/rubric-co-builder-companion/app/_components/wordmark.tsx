export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`fixed bottom-6 left-6 z-10 no-print ${className}`}
      style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      <span
        className="font-semibold tracking-tight text-sm"
        style={{ color: "var(--color-cadet)" }}
      >
        winded.vertigo
      </span>
    </div>
  );
}
