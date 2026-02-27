"use client";

/**
 * Pill button component — 44px min touch target, playful hover micro-interactions.
 *
 * Session 31: aesthetic refresh — added hover scale, background tint on hover,
 * smooth spring-like transition, and subtle shadow on selected state.
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
      className="rounded-full px-3.5 py-2 text-sm sm:text-xs sm:px-3 sm:py-1.5 border select-none active:scale-95"
      style={{
        backgroundColor: selected ? accentColor : "transparent",
        color: selected ? "var(--wv-white)" : "var(--wv-cadet)",
        borderColor: selected ? accentColor : "rgba(39, 50, 72, 0.15)",
        opacity: selected ? 1 : 0.75,
        minHeight: 44,
        boxShadow: selected ? `0 2px 8px ${accentColor}33` : "none",
        transition: "all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "var(--wv-champagne)";
          e.currentTarget.style.borderColor = "rgba(203, 120, 88, 0.3)";
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.transform = "scale(1.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "rgba(39, 50, 72, 0.15)";
          e.currentTarget.style.opacity = "0.75";
          e.currentTarget.style.transform = "scale(1)";
        }
      }}
    >
      {label}
    </button>
  );
}
