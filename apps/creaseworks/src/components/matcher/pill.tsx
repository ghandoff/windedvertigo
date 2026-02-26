"use client";

/**
 * Pill button component — 44px min touch target
 */
export function Pill({
  label,
  selected,
  accentColor = "var(--wv-redwood)",
  onClick,
}: {
  label: string;
  selected: boolean;
  accentColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-2 text-sm sm:text-xs sm:px-3 sm:py-1.5 transition-all border select-none active:scale-95"
      style={{
        backgroundColor: selected ? accentColor : "transparent",
        color: selected ? "var(--wv-white)" : "var(--wv-cadet)",
        borderColor: selected ? accentColor : "rgba(39, 50, 72, 0.2)",
        opacity: selected ? 1 : 0.7,
        minHeight: 44,
      }}
    >
      {label}
    </button>
  );
}
