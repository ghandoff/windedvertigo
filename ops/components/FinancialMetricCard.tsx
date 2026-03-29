import { FinancialMetric } from '@/lib/data';

interface FinancialMetricCardProps {
  metric: FinancialMetric;
  index: number;
}

export function FinancialMetricCard({ metric, index }: FinancialMetricCardProps) {
  return (
    <div
      className="card-animate p-4 bg-ops-card border border-ops-border rounded-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <p className="text-xs text-ops-text-muted mb-3 uppercase tracking-wide">{metric.label}</p>
      {metric.hasData ? (
        <p className="text-2xl font-semibold text-ops-text">
          {metric.currency && '$'}
          {metric.value}
        </p>
      ) : (
        <div className="data-placeholder h-12 flex items-center justify-center">
          <span className="text-xs text-ops-text-muted italic">awaiting data</span>
        </div>
      )}
    </div>
  );
}
