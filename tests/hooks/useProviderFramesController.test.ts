import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useProviderFramesController } from "@/multi-panel/hooks/useProviderFramesController";
import type { ProviderId } from "@/shared/lib/providers";

interface HarnessOverrides {
  panelProviders?: (ProviderId | null)[];
  googleProviderMode?: "ai" | "search";
  isHydrated?: boolean;
  temporaryChatEnabled?: boolean;
  resolvedTheme?: "light" | "dark";
  restoredUrlByProvider?: Partial<Record<ProviderId, string>>;
  resumeEnabled?: boolean;
}

function makeHarness(overrides: HarnessOverrides = {}) {
  const frameRefs = { current: {} as Record<string, HTMLIFrameElement | null> };
  const queueConnectorLayoutRefresh = vi.fn();
  const onProviderFrameLoad = vi.fn();

  const utils = renderHookWithProviders(
    ({ providers, mode, hydrated, tempChat, theme }: {
      providers: (ProviderId | null)[];
      mode: "ai" | "search";
      hydrated: boolean;
      tempChat: boolean;
      theme: "light" | "dark";
    }) =>
      useProviderFramesController({
        frameRefs: frameRefs as never,
        googleProviderMode: mode,
        isHydrated: hydrated,
        onProviderFrameLoad,
        panelProviders: providers as never,
        queueConnectorLayoutRefresh,
        resolvedTheme: theme,
        temporaryChatEnabled: tempChat,
        restoredUrlByProvider: overrides.restoredUrlByProvider,
        resumeEnabled: overrides.resumeEnabled,
      }),
    {
      initialProps: {
        providers: overrides.panelProviders ?? (["chatgpt"] as ProviderId[]),
        mode: overrides.googleProviderMode ?? "ai",
        hydrated: overrides.isHydrated ?? true,
        tempChat: overrides.temporaryChatEnabled ?? false,
        theme: overrides.resolvedTheme ?? "light",
      },
    },
  );

  return { ...utils, frameRefs, queueConnectorLayoutRefresh, onProviderFrameLoad };
}

describe("useProviderFramesController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates iframes for active providers when a host is registered", async () => {
    const h = makeHarness({ panelProviders: ["chatgpt"] as ProviderId[] });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    expect(h.frameRefs.current.chatgpt).toBeInstanceOf(HTMLIFrameElement);
    expect(host.firstChild).toBe(h.frameRefs.current.chatgpt);
    expect(h.queueConnectorLayoutRefresh).toHaveBeenCalled();
  });

  it("marks the provider as loading on first src assignment", () => {
    const h = makeHarness({ panelProviders: ["chatgpt"] as ProviderId[] });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    expect(h.result.current.loadingProviders.chatgpt).toBe(true);
  });

  it("clears the loading flag when the iframe load event fires", async () => {
    const h = makeHarness({ panelProviders: ["chatgpt"] as ProviderId[] });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    act(() => {
      h.frameRefs.current.chatgpt!.dispatchEvent(new Event("load"));
    });
    expect(h.result.current.loadingProviders.chatgpt).toBe(false);
    expect(h.onProviderFrameLoad).toHaveBeenCalled();
  });

  it("refreshProvider bumps the descriptor and re-marks loading", async () => {
    const h = makeHarness({ panelProviders: ["chatgpt"] as ProviderId[] });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
      h.frameRefs.current.chatgpt!.dispatchEvent(new Event("load"));
    });
    expect(h.result.current.loadingProviders.chatgpt).toBe(false);

    act(() => {
      h.result.current.refreshProvider("chatgpt" as ProviderId);
    });
    expect(h.result.current.loadingProviders.chatgpt).toBe(true);
  });

  it("postToProvider sends messages with the multi-panel context", () => {
    const h = makeHarness();
    const postMessage = vi.fn();
    h.frameRefs.current.chatgpt = {
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement;

    act(() => {
      h.result.current.postToProvider("chatgpt" as ProviderId, {
        type: "PING",
        payload: 1,
      });
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PING",
        payload: 1,
        context: "multi-panel",
      }),
      "*",
    );
  });

  it("requestProviderInputAnchor schedules a REQUEST_INPUT_ANCHOR message", () => {
    const h = makeHarness();
    const postMessage = vi.fn();
    h.frameRefs.current.chatgpt = {
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement;

    act(() => {
      h.result.current.requestProviderInputAnchor("chatgpt" as ProviderId, 100);
    });
    expect(postMessage).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "REQUEST_INPUT_ANCHOR" }),
      "*",
    );
  });

  it("removes iframe refs for providers no longer in the panel list", () => {
    const h = makeHarness({ panelProviders: ["chatgpt", "claude"] as ProviderId[] });
    const hostA = document.createElement("div");
    const hostB = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        hostA,
      );
      h.result.current.registerFrameHost(
        "claude" as ProviderId,
        "https://claude.ai/",
        "Claude",
        hostB,
      );
    });
    expect(Object.keys(h.frameRefs.current)).toContain("chatgpt");
    expect(Object.keys(h.frameRefs.current)).toContain("claude");

    act(() => {
      h.rerender({
        providers: ["chatgpt"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: false,
        theme: "light",
      });
    });
    expect(Object.keys(h.frameRefs.current)).not.toContain("claude");
  });

  it("seeds the restored conversation URL on first creation", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt"] as ProviderId[],
      resumeEnabled: true,
      restoredUrlByProvider: { chatgpt: "https://chatgpt.com/c/restored" },
    });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/c/restored");
  });

  it("ignores the restored URL when resume is disabled", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt"] as ProviderId[],
      resumeEnabled: false,
      restoredUrlByProvider: { chatgpt: "https://chatgpt.com/c/restored" },
    });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/");
  });

  it("does not reload a restored panel to home on re-render", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt"] as ProviderId[],
      resumeEnabled: true,
      restoredUrlByProvider: { chatgpt: "https://chatgpt.com/c/restored" },
    });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    const frame = h.frameRefs.current.chatgpt;
    act(() => {
      h.rerender({
        providers: ["chatgpt"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: false,
        theme: "light",
      });
    });
    expect(h.frameRefs.current.chatgpt).toBe(frame);
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/c/restored");
  });

  it("reloads a restored panel to the temp-chat URL when temp chat turns on", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt"] as ProviderId[],
      resumeEnabled: true,
      restoredUrlByProvider: { chatgpt: "https://chatgpt.com/c/restored" },
    });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/c/restored");
    act(() => {
      h.rerender({
        providers: ["chatgpt"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: true,
        theme: "light",
      });
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/?temporary-chat=true");
  });

  it("defers frame creation until hydrated", () => {
    const h = makeHarness({ panelProviders: ["chatgpt"] as ProviderId[], isHydrated: false });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    expect(h.frameRefs.current.chatgpt).toBeUndefined();

    act(() => {
      h.rerender({
        providers: ["chatgpt"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: false,
        theme: "light",
      });
    });
    expect(h.frameRefs.current.chatgpt).toBeInstanceOf(HTMLIFrameElement);
  });

  it("reopens the panel's last conversation when removed and re-added", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt", "claude"] as ProviderId[],
      resumeEnabled: true,
      restoredUrlByProvider: { claude: "https://claude.ai/chat/restored" },
    });
    const hostA = document.createElement("div");
    const hostB = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost("chatgpt" as ProviderId, "https://chatgpt.com/", "ChatGPT", hostA);
      h.result.current.registerFrameHost("claude" as ProviderId, "https://claude.ai/new", "Claude", hostB);
    });
    expect(h.frameRefs.current.claude?.src).toBe("https://claude.ai/chat/restored");

    act(() => {
      h.rerender({
        providers: ["chatgpt"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: false,
        theme: "light",
      });
    });
    expect(h.frameRefs.current.claude).toBeUndefined();

    act(() => {
      h.rerender({
        providers: ["chatgpt", "claude"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: false,
        theme: "light",
      });
    });
    const hostC = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost("claude" as ProviderId, "https://claude.ai/new", "Claude", hostC);
    });
    expect(h.frameRefs.current.claude?.src).toBe("https://claude.ai/chat/restored");
  });

  it("reloads a restored panel to a new chat on manual refresh", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt"] as ProviderId[],
      resumeEnabled: true,
      restoredUrlByProvider: { chatgpt: "https://chatgpt.com/c/restored" },
    });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/c/restored");

    act(() => {
      // Advance the clock so refreshProvider's timestamp differs from the
      // initial reload key regardless of whether Date is faked.
      vi.advanceTimersByTime(10);
      h.result.current.refreshProvider("chatgpt" as ProviderId);
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/");
  });

  it("reloads only the Google panel on a Google-mode change, leaving a restored sibling", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt", "google"] as ProviderId[],
      resumeEnabled: true,
      restoredUrlByProvider: { chatgpt: "https://chatgpt.com/c/restored" },
    });
    const hostA = document.createElement("div");
    const hostB = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost("chatgpt" as ProviderId, "https://chatgpt.com/", "ChatGPT", hostA);
      h.result.current.registerFrameHost(
        "google" as ProviderId,
        "https://www.google.com/search?udm=50",
        "Google",
        hostB,
      );
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/c/restored");
    expect(h.frameRefs.current.google?.src).toBe("https://www.google.com/search?udm=50");

    act(() => {
      h.rerender({
        providers: ["chatgpt", "google"] as ProviderId[],
        mode: "search",
        hydrated: true,
        tempChat: false,
        theme: "light",
      });
    });
    expect(h.frameRefs.current.google?.src).toBe("https://www.google.com/search");
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/c/restored");
  });

  it("does not re-restore when temp chat turns back off", () => {
    const h = makeHarness({
      panelProviders: ["chatgpt"] as ProviderId[],
      resumeEnabled: true,
      restoredUrlByProvider: { chatgpt: "https://chatgpt.com/c/restored" },
    });
    const host = document.createElement("div");
    act(() => {
      h.result.current.registerFrameHost(
        "chatgpt" as ProviderId,
        "https://chatgpt.com/",
        "ChatGPT",
        host,
      );
    });
    act(() => {
      h.rerender({
        providers: ["chatgpt"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: true,
        theme: "light",
      });
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/?temporary-chat=true");

    act(() => {
      h.rerender({
        providers: ["chatgpt"] as ProviderId[],
        mode: "ai",
        hydrated: true,
        tempChat: false,
        theme: "light",
      });
    });
    expect(h.frameRefs.current.chatgpt?.src).toBe("https://chatgpt.com/");
  });

});
