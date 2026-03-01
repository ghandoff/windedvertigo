"use client";

/**
 * Pill button — large, tactile, child-friendly selection toggle.
 *
 * 48px min touch target with emoji support. Bouncy spring animation
 * on select, wobble on hover, satisfying "pop" when toggling.
 * Designed so a kid can tap these confidently.
 */
export function Pill({
  label,
  emoji,
  selected,
  accentColor = "var(--wv-redwood)",
  onClick,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  accentColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-2.5 text-sm border select-none active:scale-90"
      style={{
        backgroundColor: selected ? accentColor : "transparent",
        color: selected ? "var(--wv-white)" : "var(--wv-cadet)",
        borderColor: selected ? accentColor : "rgba(39, 50, 72, 0.12)",
        opacity: selected ? 1 : 0.8,
        minHeight: 48,
        boxShadow: selected
          ? `0 3px 12px ${accentColor}40`
          : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: selected ? "scale(1.02)" : "scale(1)",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "var(--wv-champagne)";
          e.currentTarget.style.borderColor = "rgba(203, 120, 88, 0.3)";
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.transform = "scale(1.06)";
          e.currentTarget.style.boxShadow =
            "0 2px 8px rgba(203, 120, 88, 0.15)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "rgba(39, 50, 72, 0.12)";
          e.currentTarget.style.opacity = "0.8";
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
        }
      }}
    >
      {emoji && (
        <span
          className="mr-1.5"
          style={{
            fontSize: "1.1em",
            display: "inline-block",
            transition: "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            transform: selected ? "scale(1.15)" : "scale(1)",
          }}
        >
          {emoji}
        </span>
      )}
      {label}
      {selected && (
        <span
          className="ml-1.5 inline-block"
          style={{
            fontSize: "0.85em",
            animation: "pillCheckPop 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}
