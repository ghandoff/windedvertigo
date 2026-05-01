import { cn } from "@/lib/utils";

const FIT_LABELS: Record<string, string> = {
  "🔥 Perfect fit": "🔥 Perfect",
  "✅ Strong fit": "✅ Strong",
  "🟡 Moderate fit": "🟡 Moderate",
};

interface FitBadgeProps {
  value: string;
  className?: string;
}

export function FitBadge({ value, className }: FitBadgeProps) {
  if (!value) return null;
  return (
    <span className={cn("text-xs", className)}>
      {FIT_LABELS[value] ?? value}
    </span>
  );
}
