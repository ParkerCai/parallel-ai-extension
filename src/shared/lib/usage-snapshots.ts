import { isProviderId, type ProviderId } from "@/shared/lib/providers";

// A single usage row, exactly as the provider reports it. Labels and ids pass
// through from live provider data — never enumerate limit buckets or model
// names in code; providers change both without notice.
export type UsageMetric =
  | {
      kind: "percent";
      id: string;
      label: string;
      usedPercent: number;
      // How the provider phrases this figure. "remaining" mirrors providers
      // whose own page shows percent left (e.g. ChatGPT); the internal
      // usedPercent is still the consumed share, used for ranking and warnings.
      showAs?: "used" | "remaining";
      resetsAt?: number;
      group?: string;
    }
  | {
      kind: "count";
      id: string;
      label: string;
      remaining: number;
      total: number;
      resetsAt?: number;
      group?: string;
    }
  | {
      kind: "text";
      id: string;
      label: string;
      value: string;
      group?: string;
    };

export type UsageErrorKind = "unauthenticated" | "network" | "parse";

export interface ProviderUsageSnapshot {
  provider: ProviderId;
  status: "ok" | "error";
  errorKind?: UsageErrorKind;
  metrics: UsageMetric[];
  fetchedAt: number;
  source: "active" | "passive";
}

export type UsageSnapshotMap = Partial<Record<ProviderId, ProviderUsageSnapshot>>;

// Providers with a collector content script. Providers outside this set have
// no native usage surface to mirror (nothing is ever reported for them).
export const USAGE_CAPABLE_PROVIDERS: ReadonlySet<ProviderId> = new Set([
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "kimi",
]);

export const USAGE_SNAPSHOTS_KEY = "usageSnapshots";
export const USAGE_STALE_AFTER_MS = 15 * 60_000;

const USAGE_ERROR_KINDS: readonly string[] = ["unauthenticated", "network", "parse"];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeUsageMetric(input: unknown): UsageMetric | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id) {
    return null;
  }
  if (typeof candidate.label !== "string" || !candidate.label) {
    return null;
  }

  const shared = {
    id: candidate.id,
    label: candidate.label,
    ...(typeof candidate.group === "string" && candidate.group
      ? { group: candidate.group }
      : {}),
  };
  const resetsAt = isFiniteNumber(candidate.resetsAt) ? candidate.resetsAt : undefined;

  if (candidate.kind === "percent" && isFiniteNumber(candidate.usedPercent)) {
    return {
      kind: "percent",
      ...shared,
      usedPercent: Math.min(100, Math.max(0, candidate.usedPercent)),
      ...(candidate.showAs === "remaining" ? { showAs: "remaining" as const } : {}),
      ...(resetsAt !== undefined ? { resetsAt } : {}),
    };
  }

  if (
    candidate.kind === "count" &&
    isFiniteNumber(candidate.remaining) &&
    isFiniteNumber(candidate.total) &&
    candidate.remaining >= 0 &&
    candidate.total >= 0
  ) {
    return {
      kind: "count",
      ...shared,
      remaining: candidate.remaining,
      total: candidate.total,
      ...(resetsAt !== undefined ? { resetsAt } : {}),
    };
  }

  if (candidate.kind === "text" && typeof candidate.value === "string" && candidate.value) {
    return { kind: "text", ...shared, value: candidate.value };
  }

  return null;
}

export function normalizeUsageSnapshot(input: unknown): ProviderUsageSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.provider !== "string" || !isProviderId(candidate.provider)) {
    return null;
  }
  if (candidate.status !== "ok" && candidate.status !== "error") {
    return null;
  }
  if (!isFiniteNumber(candidate.fetchedAt) || candidate.fetchedAt <= 0) {
    return null;
  }

  const metrics = Array.isArray(candidate.metrics)
    ? candidate.metrics
        .map(normalizeUsageMetric)
        .filter((metric): metric is UsageMetric => metric !== null)
    : [];

  return {
    provider: candidate.provider,
    status: candidate.status,
    ...(candidate.status === "error" &&
    typeof candidate.errorKind === "string" &&
    USAGE_ERROR_KINDS.includes(candidate.errorKind)
      ? { errorKind: candidate.errorKind as UsageErrorKind }
      : {}),
    metrics: candidate.status === "ok" ? metrics : [],
    fetchedAt: candidate.fetchedAt,
    source: candidate.source === "active" ? "active" : "passive",
  };
}

// Fraction of the limit already consumed, or null when the metric has no
// meaningful ordering (text rows). Used to rank rows generically.
export function usedFraction(metric: UsageMetric): number | null {
  if (metric.kind === "percent") {
    return metric.usedPercent / 100;
  }
  if (metric.kind === "count") {
    return metric.total > 0 ? (metric.total - metric.remaining) / metric.total : 0;
  }
  return null;
}

export function selectMostConstrainedMetric(metrics: UsageMetric[]): UsageMetric | null {
  let best: UsageMetric | null = null;
  let bestFraction = -1;
  let bestResetsAt = Number.POSITIVE_INFINITY;

  for (const metric of metrics) {
    const fraction = usedFraction(metric);
    if (fraction === null) {
      continue;
    }
    const resetsAt = "resetsAt" in metric && metric.resetsAt !== undefined
      ? metric.resetsAt
      : Number.POSITIVE_INFINITY;
    if (
      fraction > bestFraction ||
      (fraction === bestFraction && resetsAt < bestResetsAt)
    ) {
      best = metric;
      bestFraction = fraction;
      bestResetsAt = resetsAt;
    }
  }

  return best;
}

export function sortMetricsByConstraint(metrics: UsageMetric[]): UsageMetric[] {
  return [...metrics].sort((left, right) => {
    const leftFraction = usedFraction(left);
    const rightFraction = usedFraction(right);
    if (leftFraction === null && rightFraction === null) {
      return 0;
    }
    if (leftFraction === null) {
      return 1;
    }
    if (rightFraction === null) {
      return -1;
    }
    return rightFraction - leftFraction;
  });
}

export function isUsageStale(snapshot: ProviderUsageSnapshot, now: number) {
  return now - snapshot.fetchedAt > USAGE_STALE_AFTER_MS;
}

export function formatShortDuration(deltaMs: number) {
  const totalMinutes = Math.max(0, Math.round(deltaMs / 60_000));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export async function readUsageSnapshots(): Promise<UsageSnapshotMap> {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return {};
  }

  try {
    const stored = await chrome.storage.local.get(USAGE_SNAPSHOTS_KEY);
    return normalizeUsageSnapshotMap(stored?.[USAGE_SNAPSHOTS_KEY]);
  } catch {
    return {};
  }
}

export function normalizeUsageSnapshotMap(input: unknown): UsageSnapshotMap {
  if (!input || typeof input !== "object") {
    return {};
  }

  const normalized: UsageSnapshotMap = {};
  for (const value of Object.values(input as Record<string, unknown>)) {
    const snapshot = normalizeUsageSnapshot(value);
    if (snapshot) {
      normalized[snapshot.provider] = snapshot;
    }
  }
  return normalized;
}

export async function writeUsageSnapshot(snapshot: ProviderUsageSnapshot) {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  try {
    const current = await readUsageSnapshots();
    await chrome.storage.local.set({
      [USAGE_SNAPSHOTS_KEY]: { ...current, [snapshot.provider]: snapshot },
    });
  } catch {
    // A transient storage failure just means the pane keeps its last value.
  }
}
