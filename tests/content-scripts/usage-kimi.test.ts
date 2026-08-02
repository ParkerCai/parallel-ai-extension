import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadContentScript } from "./helpers/load-script";

const STATS_PATH =
  "/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats";

function deleteReporterGlobal() {
  delete (window as unknown as Record<string, unknown>).ParallelAIUsageReporter;
}

function dispatchUsageRefresh() {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "PARALLEL_AI_USAGE_REFRESH", context: "multi-panel", force: true },
    }),
  );
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("usage-kimi", () => {
  let originalParent: Window;
  let parentPostMessage: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    deleteReporterGlobal();
    localStorage.setItem("access_token", "kimi-token");

    originalParent = window.parent;
    parentPostMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => ({ postMessage: parentPostMessage }) as unknown as Window,
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => originalParent,
    });
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
    deleteReporterGlobal();
  });

  function loadScripts() {
    loadContentScript("usage-reporter-utils.js");
    loadContentScript("usage-kimi.js");
  }

  async function collectViaRefresh() {
    dispatchUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
  }

  it("emits a percent metric from a balance's used ratio, labeled from its feature", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        subscriptionBalance: {
          id: "19f714ad",
          feature: "FEATURE_OMNI",
          type: "SUBSCRIPTION",
          unit: "UNIT_CREDIT",
          amountUsedRatio: 0.42,
          expireTime: "2026-08-01T08:04:29.579889Z",
        },
      }),
    );
    loadScripts();

    await collectViaRefresh();

    expect(fetchMock).toHaveBeenCalledWith(
      STATS_PATH,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer kimi-token" }),
      }),
    );
    const message = parentPostMessage.mock.calls[0][0];
    expect(message).toMatchObject({
      type: "PARALLEL_AI_PROVIDER_USAGE",
      context: "multi-panel-provider-status",
      provider: "kimi",
      snapshot: { provider: "kimi", status: "ok", source: "active" },
    });
    expect(message.snapshot.metrics).toEqual([
      expect.objectContaining({
        kind: "percent",
        id: "FEATURE_OMNI",
        label: "Omni",
        usedPercent: 42,
        resetsAt: Date.parse("2026-08-01T08:04:29.579889Z"),
      }),
    ]);
  });

  it("surfaces every balance without enumerating features", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        balances: [
          { feature: "FEATURE_OMNI", amountUsedRatio: 0.1 },
          { feature: "FEATURE_K2_THINKING", amountUsedRatio: 0.5 },
        ],
      }),
    );
    loadScripts();

    await collectViaRefresh();

    const metrics = parentPostMessage.mock.calls[0][0].snapshot.metrics;
    expect(metrics.map((metric: { label: string }) => metric.label)).toEqual([
      "Omni",
      "K2 Thinking",
    ]);
    expect(metrics[1]).toMatchObject({ usedPercent: 50 });
  });

  it("reports unauthenticated when no access token is stored", async () => {
    localStorage.removeItem("access_token");
    loadScripts();

    await collectViaRefresh();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(parentPostMessage.mock.calls[0][0].snapshot).toMatchObject({
      status: "error",
      errorKind: "unauthenticated",
    });
  });

  it("reports unauthenticated on a 401 response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    loadScripts();

    await collectViaRefresh();

    expect(parentPostMessage.mock.calls[0][0].snapshot).toMatchObject({
      status: "error",
      errorKind: "unauthenticated",
    });
  });

  it("reports a network error when the fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    loadScripts();

    await collectViaRefresh();

    expect(parentPostMessage.mock.calls[0][0].snapshot).toMatchObject({
      status: "error",
      errorKind: "network",
    });
  });

  it("does nothing outside the pane iframe", async () => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => originalParent,
    });
    loadScripts();

    const reporter = (window as unknown as Record<string, { framed: boolean }>)
      .ParallelAIUsageReporter;
    expect(reporter.framed).toBe(false);

    await collectViaRefresh();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parentPostMessage).not.toHaveBeenCalled();
  });
});
