import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { flushMicrotasks } from "../helpers/flush";
import { useProviderUsageController } from "@/multi-panel/hooks/useProviderUsageController";
import { usageSnapshotKey, USAGE_SNAPSHOTS_KEY } from "@/shared/lib/usage-snapshots";
import type { PanelProviderSlot } from "@/shared/lib/settings";

function makeFrame() {
  const postMessage = vi.fn();
  const contentWindow = { postMessage } as unknown as Window;
  return {
    iframe: { contentWindow } as unknown as HTMLIFrameElement,
    postMessage,
    win: contentWindow,
  };
}

function makeSnapshotPayload(provider: string) {
  return {
    provider,
    status: "ok",
    metrics: [{ kind: "percent", id: "five_hour", label: "five hour", usedPercent: 34 }],
    fetchedAt: Date.now(),
    source: "active",
  };
}

function postUsageMessage(source: Window, snapshot: unknown) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "PARALLEL_AI_PROVIDER_USAGE",
        context: "multi-panel-provider-status",
        snapshot,
      },
      source,
    } as MessageEventInit),
  );
}

function postIdleMessage(source: Window) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "PARALLEL_AI_PROVIDER_IDLE",
        context: "multi-panel-provider-status",
        provider: "claude",
        requestId: "r1",
        phase: "idle",
      },
      source,
    } as MessageEventInit),
  );
}

function renderController(
  refs: { current: Record<string, HTMLIFrameElement | null> },
  panelProviders: PanelProviderSlot[] = ["claude"],
) {
  return renderHookWithProviders(() =>
    useProviderUsageController({
      frameRefs: refs as never,
      panelProviders,
    }),
  );
}

describe("useProviderUsageController", () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a snapshot only from the frame that owns the provider", async () => {
    const claude = makeFrame();
    const refs = { current: { claude: claude.iframe } };
    const { result } = renderController(refs);

    const payload = makeSnapshotPayload("claude");
    await act(async () => {
      postUsageMessage(claude.win, payload);
      await flushMicrotasks();
    });

    expect(result.current.usageByProvider.claude).toMatchObject({
      provider: "claude",
      status: "ok",
    });
  });

  it("rejects snapshots whose claimed provider does not match the source frame", async () => {
    const claude = makeFrame();
    const refs = { current: { claude: claude.iframe } };
    const { result } = renderController(refs);

    await act(async () => {
      postUsageMessage(claude.win, makeSnapshotPayload("grok"));
      await flushMicrotasks();
    });

    expect(result.current.usageByProvider).toEqual({});
  });

  it("ignores messages from unknown frames or with the wrong context", async () => {
    const claude = makeFrame();
    const refs = { current: { claude: claude.iframe } };
    const { result } = renderController(refs);

    await act(async () => {
      postUsageMessage(window, makeSnapshotPayload("claude"));
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "PARALLEL_AI_PROVIDER_USAGE",
            context: "wrong",
            snapshot: makeSnapshotPayload("claude"),
          },
          source: claude.win,
        } as MessageEventInit),
      );
      await flushMicrotasks();
    });

    expect(result.current.usageByProvider).toEqual({});
  });

  it("persists accepted snapshots to chrome.storage.local", async () => {
    const claude = makeFrame();
    const refs = { current: { claude: claude.iframe } };
    renderController(refs);

    await act(async () => {
      postUsageMessage(claude.win, makeSnapshotPayload("claude"));
      await flushMicrotasks();
      await flushMicrotasks();
    });

    // Written under its own key, so concurrent writers cannot clobber it.
    const stored = (await chrome.storage.local.get(usageSnapshotKey("claude"))) as Record<
      string,
      Record<string, unknown>
    >;
    expect(stored[usageSnapshotKey("claude")]).toMatchObject({ provider: "claude" });
  });

  it("hydrates from previously stored snapshots", async () => {
    const payload = makeSnapshotPayload("claude");
    await chrome.storage.local.set({ [usageSnapshotKey("claude")]: payload });

    const refs = { current: {} as Record<string, HTMLIFrameElement | null> };
    const { result } = renderController(refs);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.usageByProvider.claude).toMatchObject({ provider: "claude" });
  });

  it("posts a refresh request into capable provider frames and throttles repeats", async () => {
    const claude = makeFrame();
    const refs = { current: { claude: claude.iframe } };
    const { result } = renderController(refs, ["claude", "chatgpt"]);

    act(() => {
      result.current.requestUsageRefresh();
    });
    expect(claude.postMessage).toHaveBeenCalledTimes(1);
    expect(claude.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PARALLEL_AI_USAGE_REFRESH",
        context: "multi-panel",
        force: false,
      }),
      "*",
    );

    act(() => {
      result.current.requestUsageRefresh();
    });
    expect(claude.postMessage).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.requestUsageRefresh(undefined, { force: true });
    });
    expect(claude.postMessage).toHaveBeenCalledTimes(2);
    expect(result.current.refreshing).toBe(true);
  });

  it("never targets providers without a usage collector", () => {
    const deepseek = makeFrame();
    const refs = { current: { deepseek: deepseek.iframe } };
    const { result } = renderController(refs, ["deepseek"]);

    act(() => {
      result.current.requestUsageRefresh(undefined, { force: true });
    });
    expect(deepseek.postMessage).not.toHaveBeenCalled();
  });

  it("schedules a refresh after a provider reports a finished reply", async () => {
    vi.useFakeTimers();
    const claude = makeFrame();
    const refs = { current: { claude: claude.iframe } };
    renderController(refs);

    act(() => {
      postIdleMessage(claude.win);
    });
    expect(claude.postMessage).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(claude.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PARALLEL_AI_USAGE_REFRESH" }),
      "*",
    );
  });
});
