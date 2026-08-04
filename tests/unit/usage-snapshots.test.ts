import { beforeEach, describe, expect, it } from "vitest";

import {
  formatShortDuration,
  isUsageStale,
  normalizeUsageSnapshot,
  normalizeUsageSnapshotMap,
  readUsageSnapshots,
  selectMostConstrainedMetric,
  sortMetricsByConstraint,
  usedFraction,
  writeUsageSnapshot,
  USAGE_SNAPSHOTS_KEY,
  USAGE_STALE_AFTER_MS,
  type ProviderUsageSnapshot,
  type UsageMetric,
} from "@/shared/lib/usage-snapshots";

function makeSnapshot(overrides: Partial<ProviderUsageSnapshot> = {}): ProviderUsageSnapshot {
  return {
    provider: "claude",
    status: "ok",
    metrics: [
      {
        kind: "percent",
        id: "five_hour",
        label: "five hour",
        usedPercent: 34,
        resetsAt: 1_800_000_100_000,
      },
    ],
    fetchedAt: 1_800_000_000_000,
    source: "active",
    ...overrides,
  };
}

describe("normalizeUsageSnapshot", () => {
  it("accepts a valid snapshot and passes arbitrary metric labels through", () => {
    const snapshot = makeSnapshot({
      metrics: [
        { kind: "percent", id: "some_future_bucket", label: "some future bucket", usedPercent: 12 },
        { kind: "count", id: "DEFAULT:grok-3", label: "default · grok-3", remaining: 24, total: 25 },
        { kind: "text", id: "tier", label: "tier", value: "Moderato" },
      ],
    });

    expect(normalizeUsageSnapshot(snapshot)).toEqual(snapshot);
  });

  it("clamps out-of-range percent values", () => {
    const normalized = normalizeUsageSnapshot(
      makeSnapshot({
        metrics: [{ kind: "percent", id: "a", label: "a", usedPercent: 250 }],
      }),
    );
    expect(normalized?.metrics[0]).toMatchObject({ usedPercent: 100 });
  });

  it("drops malformed metric rows but keeps valid ones", () => {
    const normalized = normalizeUsageSnapshot(
      makeSnapshot({
        metrics: [
          { kind: "percent", id: "ok", label: "ok", usedPercent: 5 },
          { kind: "percent", id: "", label: "missing id", usedPercent: 5 },
          { kind: "count", id: "bad", label: "bad", remaining: Number.NaN, total: 10 },
          { kind: "text", id: "no-value", label: "no value" },
        ] as unknown as UsageMetric[],
      }),
    );
    expect(normalized?.metrics).toHaveLength(1);
    expect(normalized?.metrics[0]?.id).toBe("ok");
  });

  it("rejects snapshots with an unknown provider, bad status, or bad fetchedAt", () => {
    expect(normalizeUsageSnapshot(makeSnapshot({ provider: "nope" as never }))).toBeNull();
    expect(normalizeUsageSnapshot(makeSnapshot({ status: "loading" as never }))).toBeNull();
    expect(normalizeUsageSnapshot(makeSnapshot({ fetchedAt: Number.NaN }))).toBeNull();
    expect(normalizeUsageSnapshot(null)).toBeNull();
  });

  it("keeps a known errorKind only on error snapshots and clears metrics", () => {
    const normalized = normalizeUsageSnapshot(
      makeSnapshot({
        status: "error",
        errorKind: "unauthenticated",
        metrics: [{ kind: "percent", id: "a", label: "a", usedPercent: 5 }],
      }),
    );
    expect(normalized).toMatchObject({ status: "error", errorKind: "unauthenticated" });
    expect(normalized?.metrics).toEqual([]);
  });
});

describe("metric ranking", () => {
  const percentLow: UsageMetric = { kind: "percent", id: "low", label: "low", usedPercent: 10 };
  const percentHigh: UsageMetric = { kind: "percent", id: "high", label: "high", usedPercent: 80 };
  const countMid: UsageMetric = {
    kind: "count",
    id: "mid",
    label: "mid",
    remaining: 10,
    total: 20,
  };
  const textRow: UsageMetric = { kind: "text", id: "t", label: "t", value: "v" };

  it("computes comparable fractions across percent and count metrics", () => {
    expect(usedFraction(percentHigh)).toBeCloseTo(0.8);
    expect(usedFraction(countMid)).toBeCloseTo(0.5);
    expect(usedFraction(textRow)).toBeNull();
    expect(usedFraction({ kind: "count", id: "z", label: "z", remaining: 0, total: 0 })).toBe(0);
  });

  it("selects the most constrained metric and ignores text rows", () => {
    expect(selectMostConstrainedMetric([percentLow, textRow, countMid, percentHigh])).toBe(
      percentHigh,
    );
    expect(selectMostConstrainedMetric([textRow])).toBeNull();
  });

  it("breaks fraction ties by the soonest reset", () => {
    const later: UsageMetric = {
      kind: "percent",
      id: "later",
      label: "later",
      usedPercent: 50,
      resetsAt: 2000,
    };
    const sooner: UsageMetric = {
      kind: "percent",
      id: "sooner",
      label: "sooner",
      usedPercent: 50,
      resetsAt: 1000,
    };
    expect(selectMostConstrainedMetric([later, sooner])).toBe(sooner);
  });

  it("sorts metrics most-constrained first with text rows last", () => {
    const sorted = sortMetricsByConstraint([textRow, percentLow, percentHigh, countMid]);
    expect(sorted.map((metric) => metric.id)).toEqual(["high", "mid", "low", "t"]);
  });
});

describe("staleness and durations", () => {
  it("flags snapshots older than the stale threshold", () => {
    const snapshot = makeSnapshot();
    expect(isUsageStale(snapshot, snapshot.fetchedAt + USAGE_STALE_AFTER_MS)).toBe(false);
    expect(isUsageStale(snapshot, snapshot.fetchedAt + USAGE_STALE_AFTER_MS + 1)).toBe(true);
  });

  it("formats short durations", () => {
    expect(formatShortDuration(45 * 60_000)).toBe("45m");
    expect(formatShortDuration(2 * 3_600_000 + 15 * 60_000)).toBe("2h 15m");
    expect(formatShortDuration(3 * 3_600_000)).toBe("3h");
    expect(formatShortDuration(50 * 3_600_000)).toBe("2d 2h");
    expect(formatShortDuration(-5000)).toBe("0m");
  });
});

describe("snapshot storage", () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  it("round-trips snapshots through chrome.storage.local", async () => {
    const snapshot = makeSnapshot();
    await writeUsageSnapshot(snapshot);
    await expect(readUsageSnapshots()).resolves.toEqual({ claude: snapshot });
  });

  it("merges snapshots per provider", async () => {
    const claude = makeSnapshot();
    const grok = makeSnapshot({
      provider: "grok",
      metrics: [
        { kind: "count", id: "DEFAULT:grok-3", label: "default · grok-3", remaining: 5, total: 25 },
      ],
    });
    await writeUsageSnapshot(claude);
    await writeUsageSnapshot(grok);
    await expect(readUsageSnapshots()).resolves.toEqual({ claude, grok });
  });

  // Every pane's initial collect fires on the same delay, so writes routinely
  // overlap. All snapshots share one storage key, so an unserialized write would
  // read the map before the other write landed and then overwrite it, dropping
  // that provider until its next refresh.
  it("keeps every provider when writes overlap", async () => {
    const providers = ["claude", "grok", "chatgpt", "gemini", "kimi"] as const;
    const snapshots = providers.map((provider) => makeSnapshot({ provider }));

    await Promise.all(snapshots.map((snapshot) => writeUsageSnapshot(snapshot)));

    const stored = await readUsageSnapshots();
    expect(Object.keys(stored).sort()).toEqual([...providers].sort());
  });

  it("drops malformed stored entries on read", async () => {
    const snapshot = makeSnapshot();
    await chrome.storage.local.set({
      [USAGE_SNAPSHOTS_KEY]: { claude: snapshot, grok: { garbage: true } },
    });
    await expect(readUsageSnapshots()).resolves.toEqual({ claude: snapshot });
  });

  it("normalizes arbitrary stored maps defensively", () => {
    expect(normalizeUsageSnapshotMap(null)).toEqual({});
    expect(normalizeUsageSnapshotMap("junk")).toEqual({});
    expect(normalizeUsageSnapshotMap({ anything: makeSnapshot() })).toEqual({
      claude: makeSnapshot(),
    });
  });
});
