import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  "Tier 1 – Pursue now": "bg-red-50 text-red-700 border-red-200",
  "Tier 2 – Warm up": "bg-orange-50 text-orange-700 border-orange-200",
  "Tier 3 – Monitor": "bg-gray-100 text-gray-600 border-gray-200",
};

const FIT_LABELS: Record<string, string> = {
  "🔥 Perfect fit": "🔥 Perfect",
  "✅ Strong fit": "✅ Strong",
  "🟡 Moderate fit": "🟡 Moderate",
};

interface PriorityBadgeProps {
  value: string;
  className?: string;
}

export function PriorityBadge({ value, className }: PriorityBadgeProps) {
  if (!value) return null;
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", PRIORITY_COLORS[value] ?? "bg-gray-50", className)}
    >
      {value.replace(/ – .+/, "")}
    </Badge>
  );
}

export function FitBadge({ value, className }: PriorityBadgeProps) {
  if (!value) return null;
  return (
    <span className={cn("text-xs", className)}>
      {FIT_LABELS[value] ?? value}
    </span>
  );
}
