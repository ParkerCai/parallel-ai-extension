import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_ORIGIN, loadContentScript, stubAncestorOrigins } from "./helpers/load-script";

function deleteReporterGlobal() {
  delete (window as unknown as Record<string, unknown>).ParallelAIUsageReporter;
}

function dispatchTapMessage(payload: Record<string, unknown>, source: Window | null = window) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { source: "PARALLEL_AI_USAGE_TAP", provider: "chatgpt", ...payload },
      source,
    } as MessageEventInit),
  );
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

// Real shape captured from a logged-in /backend-api/wham/usage response: the
// weekly figure is rate_limit.primary_window.used_percent (34) with reset_at as
// epoch seconds, and the per-model lanes live under additional_rate_limits and
// must NOT surface as their own rows. ChatGPT's own page phrases the figure as
// "N% remaining", so the emitted metric carries showAs "remaining".
const RESET_AT_SECONDS = 1784957189;
const USAGE_BODY = {
  plan_type: "prolite",
  rate_limit: {
    allowed: true,
    limit_reached: false,
    primary_window: {
      used_percent: 34,
      limit_window_seconds: 604800,
      reset_after_seconds: 363575,
      reset_at: RESET_AT_SECONDS,
    },
    secondary_window: null,
  },
  additional_rate_limits: [
    {
      limit_name: "GPT-5.3-Codex-Spark",
      metered_feature: "codex_bengalfox",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: { used_percent: 0, reset_at: RESET_AT_SECONDS },
      },
    },
  ],
};

describe("usage-chatgpt", () => {
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
    stubAncestorOrigins();
    loadContentScript("usage-reporter-utils.js");
    loadContentScript("usage-chatgpt.js");
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

  async function flushRefresh() {
    dispatchUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
  }

  it("reports a single weekly-limit row (shown as remaining), skipping model lanes", () => {
    dispatchTapMessage({ kind: "usage-response", responseText: JSON.stringify(USAGE_BODY) });

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    const message = parentPostMessage.mock.calls[0][0];
    expect(message).toMatchObject({
      provider: "chatgpt",
      snapshot: { status: "ok", source: "passive" },
    });
    // Exactly one row — the additional_rate_limits lane is not surfaced.
    expect(message.snapshot.metrics).toEqual([
      expect.objectContaining({
        kind: "percent",
        label: "Weekly usage limit",
        usedPercent: 34,
        showAs: "remaining",
        resetsAt: RESET_AT_SECONDS * 1000,
      }),
    ]);
    expect(message.snapshot.metrics).toHaveLength(1);
  });

  it("uses a sniffed bearer token to fetch usage actively on refresh", async () => {
    dispatchTapMessage({
      kind: "credentials",
      authorization: "Bearer sniffed-token",
      accountId: "acc-1",
    });
    fetchMock.mockResolvedValue(jsonResponse(USAGE_BODY));

    await flushRefresh();

    expect(fetchMock).toHaveBeenCalledWith(
      "/backend-api/wham/usage",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer sniffed-token",
          "chatgpt-account-id": "acc-1",
        }),
      }),
    );
    const lastMessage = parentPostMessage.mock.calls.at(-1)?.[0];
    expect(lastMessage.snapshot).toMatchObject({ status: "ok", source: "active" });
  });

  it("falls back to the session endpoint to mint a token", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/session") {
        return Promise.resolve(jsonResponse({ accessToken: "session-token" }));
      }
      return Promise.resolve(jsonResponse(USAGE_BODY));
    });

    await flushRefresh();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(
      "/backend-api/wham/usage",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer session-token" }),
      }),
    );
  });

  it("reports unauthenticated when the session has no token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await flushRefresh();

    const lastMessage = parentPostMessage.mock.calls.at(-1)?.[0];
    expect(lastMessage.snapshot).toMatchObject({
      status: "error",
      errorKind: "unauthenticated",
    });
  });

  it("drops a stale token and reports unauthenticated on a 401", async () => {
    dispatchTapMessage({ kind: "credentials", authorization: "Bearer stale" });
    fetchMock.mockResolvedValue(jsonResponse({}, 401));

    await flushRefresh();

    const lastMessage = parentPostMessage.mock.calls.at(-1)?.[0];
    expect(lastMessage.snapshot).toMatchObject({
      status: "error",
      errorKind: "unauthenticated",
    });
  });

  it("ignores tap relays that are not same-window", () => {
    dispatchTapMessage(
      { kind: "usage-response", responseText: JSON.stringify(USAGE_BODY) },
      null,
    );
    expect(parentPostMessage).not.toHaveBeenCalled();
  });
});
