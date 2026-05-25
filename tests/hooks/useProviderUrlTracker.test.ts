import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useProviderUrlTracker } from "@/multi-panel/hooks/useProviderUrlTracker";

function makeFrame() {
  const contentWindow = {} as Window;
  return {
    iframe: { contentWindow } as unknown as HTMLIFrameElement,
    win: contentWindow,
  };
}

function postProviderUrlMessage(source: Window, url: string) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "PARALLEL_AI_PROVIDER_URL",
        context: "multi-panel-provider-status",
        url,
      },
      source,
    } as MessageEventInit),
  );
}

describe("useProviderUrlTracker", () => {
  it("records URL updates from a known frame", () => {
    const { iframe, win } = makeFrame();
    const refs = { current: { chatgpt: iframe } };
    const { result } = renderHookWithProviders(() =>
      useProviderUrlTracker({ frameRefs: refs as never }),
    );

    expect(result.current.urlByProvider).toEqual({});

    act(() => postProviderUrlMessage(win, "https://chatgpt.com/c/123"));
    expect(result.current.urlByProvider).toEqual({
      chatgpt: "https://chatgpt.com/c/123",
    });
  });

  it("ignores messages from unknown frames", () => {
    const refs = { current: {} as Record<string, HTMLIFrameElement | null> };
    const { result } = renderHookWithProviders(() =>
      useProviderUrlTracker({ frameRefs: refs as never }),
    );

    act(() => postProviderUrlMessage(window, "https://example.com"));
    expect(result.current.urlByProvider).toEqual({});
  });

  it("ignores messages with the wrong type or context", () => {
    const { iframe, win } = makeFrame();
    const refs = { current: { chatgpt: iframe } };
    const { result } = renderHookWithProviders(() =>
      useProviderUrlTracker({ frameRefs: refs as never }),
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "OTHER", context: "multi-panel-provider-status", url: "x" },
          source: win,
        } as MessageEventInit),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "PARALLEL_AI_PROVIDER_URL", context: "wrong", url: "x" },
          source: win,
        } as MessageEventInit),
      );
    });
    expect(result.current.urlByProvider).toEqual({});
  });

  it("does not re-render when the URL is unchanged", () => {
    const { iframe, win } = makeFrame();
    const refs = { current: { chatgpt: iframe } };
    const { result } = renderHookWithProviders(() =>
      useProviderUrlTracker({ frameRefs: refs as never }),
    );

    act(() => postProviderUrlMessage(win, "https://chatgpt.com/c/1"));
    const first = result.current.urlByProvider;
    act(() => postProviderUrlMessage(win, "https://chatgpt.com/c/1"));
    expect(result.current.urlByProvider).toBe(first); // referential equality preserved
  });
});
