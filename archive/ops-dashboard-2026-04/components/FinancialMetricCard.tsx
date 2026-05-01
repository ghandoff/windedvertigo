'use client';

import { FinancialMetric } from '@/lib/data';

interface FinancialMetricCardProps {
  metric: FinancialMetric;
  index: number;
}

export function FinancialMetricCard({ metric, index }: FinancialMetricCardProps) {
  return (
    <div
      className="card-animate p-4 bg-dark-card border border-dark-border rounded-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <p className="text-xs text-dark-textMuted mb-3 uppercase tracking-wide">{metric.label}</p>
      {metric.hasData ? (
        <p className="text-2xl font-semibold text-dark-text">
          {metric.currency && '$'}
          {metric.value}
        </p>
      ) : (
        <div className="data-placeholder h-12 flex items-center justify-center">
          <span className="text-xs text-dark-textMuted italic">awaiting data</span>
        </div>
      )}
    </div>
  );
}
