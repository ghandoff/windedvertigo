'use client';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-6 mt-10 first:mt-0">
      <h2 className="text-xl font-semibold text-dark-text lowercase tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-dark-textMuted mt-1">{subtitle}</p>
      )}
      <div className="h-px bg-gradient-to-r from-dark-border to-transparent mt-4"></div>
    </div>
  );
}
