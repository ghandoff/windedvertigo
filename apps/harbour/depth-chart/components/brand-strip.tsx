"use client";

/**
 * compact branding strip: "depth.chart — winded.vertigo"
 * used on generated outputs (task cards, rubric, scaffold) to establish provenance.
 */
export function BrandStrip({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-between bg-[var(--wv-cadet)] border border-white/10 rounded-lg px-3 py-1.5 ${className}`}
    >
      <span className="text-[10px] font-semibold tracking-[0.15em] text-[var(--wv-champagne)]">
        depth.chart
      </span>
      <span className="text-[10px] text-[var(--color-text-on-dark-muted)]">
        winded.vertigo
      </span>
    </div>
  );
}
