'use client';

interface Option {
  label: string;
  followUp: string;
}

interface Props {
  options: Option[];
  onSelect: (option: Option) => void;
}

export default function FeltSensePicker({ options, onSelect }: Props) {
  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs text-white/50 font-mono uppercase tracking-widest mb-3">
        what do you feel?
      </p>
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt)}
          className="w-full text-left px-4 py-3 border border-white/20 text-white/80 font-mono text-sm hover:border-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 rounded"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
