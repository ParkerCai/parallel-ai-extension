import { useTranslation } from "@/shared/contexts/I18nContext";
import {
  formatShortDuration,
  selectMostConstrainedMetric,
  sortMetricsByConstraint,
  usedFraction,
  type ProviderUsageSnapshot,
  type UsageMetric,
} from "@/shared/lib/usage-snapshots";

const HIGH_USAGE_FRACTION = 0.85;

interface PanelUsageStripProps {
  snapshot: ProviderUsageSnapshot | undefined;
}

function metricSummary(
  metric: UsageMetric,
  remainingLabel: (count: string) => string,
  percentRemainingLabel: (value: string) => string,
) {
  if (metric.kind === "percent") {
    const value =
      metric.showAs === "remaining"
        ? percentRemainingLabel(`${Math.round(100 - metric.usedPercent)}`)
        : `${Math.round(metric.usedPercent)}%`;
    return `${metric.label} ${value}`;
  }
  if (metric.kind === "count") {
    return `${metric.label} ${remainingLabel(`${metric.remaining} / ${metric.total}`)}`;
  }
  return `${metric.label} ${metric.value}`;
}

// One-line usage status overlaid on the bottom of a provider pane. It only
// renders when the provider actually reports usage; providers with no usage
// data (or an error) show nothing at all, so the pane looks untouched.
export function PanelUsageStrip({ snapshot }: PanelUsageStripProps) {
  const { t } = useTranslation();

  if (!snapshot || snapshot.status !== "ok") {
    return null;
  }

  const metric = selectMostConstrainedMetric(snapshot.metrics);
  if (!metric) {
    return null;
  }

  const fraction = usedFraction(metric) ?? 0;
  const isHighUsage = fraction >= HIGH_USAGE_FRACTION;
  const resetsAt = "resetsAt" in metric ? metric.resetsAt : undefined;
  const now = Date.now();
  const showsRemaining = metric.kind === "percent" && metric.showAs === "remaining";
  const barFillPercent = showsRemaining ? 100 - metric.usedPercent : fraction * 100;

  const summarize = (item: UsageMetric) =>
    metricSummary(
      item,
      (count) => t("usageRemainingCount", "$1 left", count),
      (value) => t("usagePercentRemaining", "$1% remaining", value),
    );

  // Every row on one line, tightest first, joined by a middot. It truncates in
  // a narrow pane.
  const allMetricsText = sortMetricsByConstraint(snapshot.metrics)
    .map(summarize)
    .join(" · ");

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[9] flex justify-center px-2 pb-2">
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-[hsl(var(--shadow-ambient)/0.55)] px-3 py-1 text-[10px] leading-none text-white/90 shadow-[0_6px_20px_-10px_hsl(var(--shadow-ambient)/0.9)] backdrop-blur-md">
        <span className="h-1 w-14 flex-none overflow-hidden rounded-full bg-white/20">
          <span
            className={`block h-full rounded-full ${
              isHighUsage ? "bg-[hsl(var(--danger))]" : "bg-white/70"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, barFillPercent))}%` }}
          />
        </span>
        {/*
          The pill is dark in both themes, so the warning color has to be the
          one that reads on a dark surface: --danger-text is a near-black red in
          the light theme (it is meant for red text on light surfaces), while
          --danger is the same bright red in both themes.
        */}
        <span className={`min-w-0 truncate ${isHighUsage ? "text-[hsl(var(--danger))]" : ""}`}>
          {allMetricsText}
        </span>
        {resetsAt !== undefined && resetsAt > now ? (
          <span className="hidden flex-none sm:inline">
            {t("usageResetsIn", "Resets in $1", formatShortDuration(resetsAt - now))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
