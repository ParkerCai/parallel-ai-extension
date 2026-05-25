import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useProviderTitleTracker } from "@/multi-panel/hooks/useProviderTitleTracker";

function makeFrame() {
  const contentWindow = {} as Window;
  return {
    iframe: { contentWindow } as unknown as HTMLIFrameElement,
    win: contentWindow,
  };
}

function postTitle(source: Window, title: string, initialTitle?: string) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "PARALLEL_AI_PROVIDER_TITLE",
        context: "multi-panel-provider-status",
        title,
        ...(initialTitle ? { initialTitle } : {}),
      },
      source,
    } as MessageEventInit),
  );
}

describe("useProviderTitleTracker", () => {
  it("captures title updates with optional initialTitle", () => {
    const { iframe, win } = makeFrame();
    const refs = { current: { claude: iframe } };
    const { result } = renderHookWithProviders(() =>
      useProviderTitleTracker({ frameRefs: refs as never }),
    );

    act(() => postTitle(win, "Conversation A", "Claude"));
    expect(result.current.titleByProvider).toEqual({
      claude: { title: "Conversation A", initialTitle: "Claude" },
    });
  });

  it("defaults initialTitle to empty string", () => {
    const { iframe, win } = makeFrame();
    const refs = { current: { claude: iframe } };
    const { result } = renderHookWithProviders(() =>
      useProviderTitleTracker({ frameRefs: refs as never }),
    );

    act(() => postTitle(win, "Conversation A"));
    expect(result.current.titleByProvider.claude.initialTitle).toBe("");
  });

  it("preserves referential equality when title is unchanged", () => {
    const { iframe, win } = makeFrame();
    const refs = { current: { claude: iframe } };
    const { result } = renderHookWithProviders(() =>
      useProviderTitleTracker({ frameRefs: refs as never }),
    );

    act(() => postTitle(win, "Same"));
    const first = result.current.titleByProvider;
    act(() => postTitle(win, "Same"));
    expect(result.current.titleByProvider).toBe(first);
  });

  it("ignores messages from unknown sources", () => {
    const refs = { current: {} as Record<string, HTMLIFrameElement | null> };
    const { result } = renderHookWithProviders(() =>
      useProviderTitleTracker({ frameRefs: refs as never }),
    );

    act(() => postTitle(window, "X"));
    expect(result.current.titleByProvider).toEqual({});
  });
});
