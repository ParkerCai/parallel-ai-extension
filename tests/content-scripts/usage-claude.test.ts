import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedStorage } from "../setup/chrome-mock";
import { EXTENSION_ORIGIN, loadContentScript, stubAncestorOrigins } from "./helpers/load-script";

const ORG_ID = "12345678-90ab-cdef-1234-567890abcdef";

function deleteReporterGlobal() {
  delete (window as unknown as Record<string, unknown>).ParallelAIUsageReporter;
}

function dispatchUsageRefresh() {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "PARALLEL_AI_USAGE_REFRESH", context: "multi-panel", force: true },
      source: window.parent,
      origin: EXTENSION_ORIGIN,
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

describe("usage-claude", () => {
  let originalParent: Window;
  let parentPostMessage: ReturnType<typeof vi.fn>;
  // Stable object: the reporter identity-checks event.source against
  // window.parent before accepting a refresh request.
  let parentStub: Window;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    deleteReporterGlobal();
    originalParent = window.parent;
    parentPostMessage = vi.fn();
    parentStub = { postMessage: parentPostMessage } as unknown as Window;
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => parentStub,
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
    deleteReporterGlobal();
  });

  function loadScripts() {
    stubAncestorOrigins();
    loadContentScript("usage-reporter-utils.js");
    loadContentScript("usage-claude.js");
  }

  async function collectViaRefresh() {
    dispatchUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
  }

  it("parses the limits[] array the usage page renders (session, weekly all, per-model Fable)", async () => {
    seedStorage("local", { claudeActiveWorkspace: ORG_ID });
    // Real shape captured from a logged-in /usage response: the page renders
    // from limits[], each entry carrying a percent, kind/group, resets_at, and
    // an optional scope.model whose display_name labels a per-model row.
    fetchMock.mockResolvedValue(
      jsonResponse({
        five_hour: { utilization: 10, resets_at: "2026-07-21T03:30:00Z" },
        seven_day: { utilization: 9, resets_at: "2026-07-27T12:00:00Z" },
        seven_day_opus: null,
        limits: [
          {
            kind: "session",
            group: "session",
            percent: 10,
            resets_at: "2026-07-21T03:30:00Z",
            scope: null,
          },
          {
            kind: "weekly_all",
            group: "weekly",
            percent: 9,
            resets_at: "2026-07-27T12:00:00Z",
            scope: null,
          },
          {
            kind: "weekly_scoped",
            group: "weekly",
            percent: 12,
            resets_at: "2026-07-27T12:00:00Z",
            scope: { model: { id: null, display_name: "Fable" }, surface: null },
          },
        ],
      }),
    );
    loadScripts();

    await collectViaRefresh();

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/organizations/${ORG_ID}/usage`,
      expect.objectContaining({ credentials: "include" }),
    );
    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    const message = parentPostMessage.mock.calls[0][0];
    expect(message).toMatchObject({
      type: "PARALLEL_AI_PROVIDER_USAGE",
      context: "multi-panel-provider-status",
      provider: "claude",
      snapshot: { provider: "claude", status: "ok", source: "active" },
    });
    // limits[] wins over the legacy top-level fields, and the per-model Fable
    // row (which the legacy fields omit entirely) is present.
    expect(message.snapshot.metrics).toEqual([
      // Wording mirrors Claude's own usage page: "Current session" under Plan
      // usage limits, "All models" under Weekly limits, and the scoped row named
      // by the model itself.
      expect.objectContaining({
        kind: "percent",
        id: "session.session",
        label: "Current session",
        usedPercent: 10,
        resetsAt: Date.parse("2026-07-21T03:30:00Z"),
      }),
      expect.objectContaining({ id: "weekly_all.weekly", label: "All models", usedPercent: 9 }),
      expect.objectContaining({
        id: "weekly_scoped.weekly.Fable",
        label: "Fable",
        usedPercent: 12,
      }),
    ]);
  });

  it("falls back to utilization-bearing keys when the response has no limits[]", async () => {
    seedStorage("local", { claudeActiveWorkspace: ORG_ID });
    fetchMock.mockResolvedValue(
      jsonResponse({
        five_hour: { utilization: 34, resets_at: "2026-07-20T10:00:00Z" },
        seven_day: { utilization: 72, resets_at: "2026-07-24T00:00:00Z" },
        some_future_bucket: { utilization: 5 },
        not_a_bucket: "ignore-me",
        also_ignored: { other: 1 },
      }),
    );
    loadScripts();

    await collectViaRefresh();

    const message = parentPostMessage.mock.calls[0][0];
    expect(message.snapshot.metrics).toEqual([
      expect.objectContaining({
        kind: "percent",
        id: "five_hour",
        label: "five hour",
        usedPercent: 34,
        resetsAt: Date.parse("2026-07-20T10:00:00Z"),
      }),
      expect.objectContaining({ id: "seven_day", usedPercent: 72 }),
      expect.objectContaining({ id: "some_future_bucket", label: "some future bucket" }),
    ]);
  });

  it("reports unauthenticated on a 401 response", async () => {
    seedStorage("local", { claudeActiveWorkspace: ORG_ID });
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    loadScripts();

    await collectViaRefresh();

    expect(parentPostMessage.mock.calls[0][0].snapshot).toMatchObject({
      status: "error",
      errorKind: "unauthenticated",
    });
  });

  it("reports unauthenticated when no org id can be resolved", async () => {
    chrome.runtime.sendMessage = vi.fn(
      (_message: unknown, callback?: (response: unknown) => void) => {
        callback?.({ uuid: null });
        return Promise.resolve({ uuid: null });
      },
    ) as never;
    loadScripts();

    await collectViaRefresh();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(parentPostMessage.mock.calls[0][0].snapshot).toMatchObject({
      status: "error",
      errorKind: "unauthenticated",
    });
  });

  it("falls back to the workspace pinned in localStorage", async () => {
    chrome.runtime.sendMessage = vi.fn(
      (_message: unknown, callback?: (response: unknown) => void) => {
        callback?.({ uuid: null });
        return Promise.resolve({ uuid: null });
      },
    ) as never;
    localStorage.setItem("parallel-ai:claude:workspace", ORG_ID);
    fetchMock.mockResolvedValue(jsonResponse({ five_hour: { utilization: 1 } }));
    loadScripts();

    await collectViaRefresh();

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/organizations/${ORG_ID}/usage`,
      expect.anything(),
    );
    localStorage.removeItem("parallel-ai:claude:workspace");
  });

  it("reports a network error when the fetch rejects", async () => {
    seedStorage("local", { claudeActiveWorkspace: ORG_ID });
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
