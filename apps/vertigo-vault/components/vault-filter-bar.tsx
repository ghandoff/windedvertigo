"use client";

interface VaultFilterBarProps {
  types: string[];
  durations: string[];
  activeType: string | null;
  activeDuration: string | null;
  onTypeChange: (type: string | null) => void;
  onDurationChange: (duration: string | null) => void;
}

export default function VaultFilterBar({
  types,
  durations,
  activeType,
  activeDuration,
  onTypeChange,
  onDurationChange,
}: VaultFilterBarProps) {
  return (
    <div className="mb-8 space-y-4">
      {/* type filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider opacity-40 mr-1">
          type
        </span>
        <Pill
          label="all"
          active={activeType === null}
          onClick={() => onTypeChange(null)}
        />
        {types.map((t) => (
          <Pill
            key={t}
            label={t}
            active={activeType === t}
            onClick={() => onTypeChange(activeType === t ? null : t)}
          />
        ))}
      </div>

      {/* duration filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider opacity-40 mr-1">
          duration
        </span>
        <Pill
          label="all"
          active={activeDuration === null}
          onClick={() => onDurationChange(null)}
        />
        {durations.map((d) => (
          <Pill
            key={d}
            label={d}
            active={activeDuration === d}
            onClick={() => onDurationChange(activeDuration === d ? null : d)}
          />
        ))}
      </div>
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-all cursor-pointer ${
        active
          ? "bg-[var(--vault-accent)] border-[var(--vault-accent)] text-white"
          : "border-white/20 text-white/60 hover:border-white/40 hover:text-white/80 bg-transparent"
      }`}
    >
      {label}
    </button>
  );
}
