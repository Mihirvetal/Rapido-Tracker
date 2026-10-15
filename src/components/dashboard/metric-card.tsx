import type { DashboardMetric } from "@/lib/dashboard/queries";

interface MetricCardProps {
  metric: DashboardMetric;
}

export function MetricCard({ metric }: MetricCardProps) {
  const valueClass =
    metric.tone === "expense" ? "expense-text" : "profit-text";

  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-medium text-muted">{metric.label}</p>
      <p
        className={`mt-2 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${valueClass}`}
      >
        {metric.valueLabel}
      </p>
      <p className="mt-1 break-words text-xs text-muted">{metric.hint}</p>
    </article>
  );
}
