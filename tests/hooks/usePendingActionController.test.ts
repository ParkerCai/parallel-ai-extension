import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { seedStorage } from "../setup/chrome-mock";
import { usePendingActionController } from "@/multi-panel/hooks/usePendingActionController";
import { PENDING_MULTI_PANEL_ACTION_KEY } from "@/shared/lib/constants";

function mockImageFetch(blobType = "image/png", size = 16) {
  globalThis.fetch = vi.fn(async () => {
    const blob = new Blob([new Uint8Array(size)], { type: blobType });
    return {
      ok: true,
      status: 200,
      blob: async () => blob,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("usePendingActionController", () => {
  let setAttachments: ReturnType<typeof vi.fn>;
  let setPrompt: ReturnType<typeof vi.fn>;
  let showStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAttachments = vi.fn();
    setPrompt = vi.fn();
    showStatus = vi.fn();
  });

  it("does nothing while not hydrated", async () => {
    seedStorage("session", {
      [PENDING_MULTI_PANEL_ACTION_KEY]: {
        action: "sendToPanel",
        payload: { selectedText: "hi" },
      },
    });

    renderHookWithProviders(() =>
      usePendingActionController({
        isHydrated: false,
        setAttachments,
        setPrompt,
        showStatus,
      }),
    );

    // Microtask flush: nothing should fire because isHydrated=false.
    await Promise.resolve();
    expect(setPrompt).not.toHaveBeenCalled();
    expect(showStatus).not.toHaveBeenCalled();
  });

  it("consumes a sendToPanel action exactly once", async () => {
    seedStorage("session", {
      [PENDING_MULTI_PANEL_ACTION_KEY]: {
        action: "sendToPanel",
        payload: { selectedText: "selected" },
      },
    });

    const { rerender } = renderHookWithProviders(() =>
      usePendingActionController({
        isHydrated: true,
        setAttachments,
        setPrompt,
        showStatus,
      }),
    );

    await waitFor(() => expect(setPrompt).toHaveBeenCalledWith("selected"));
    expect(showStatus).toHaveBeenCalledWith(expect.stringMatching(/loaded/i));

    // Re-run the effect — consumedRef should block a second processing.
    setPrompt.mockClear();
    showStatus.mockClear();
    rerender();
    await Promise.resolve();
    expect(setPrompt).not.toHaveBeenCalled();
  });

  it("consumes an attachImage action and fetches the image", async () => {
    mockImageFetch("image/png");

    seedStorage("session", {
      [PENDING_MULTI_PANEL_ACTION_KEY]: {
        action: "attachImage",
        payload: { imageUrl: "https://example.com/foo.png" },
      },
    });

    renderHookWithProviders(() =>
      usePendingActionController({
        isHydrated: true,
        setAttachments,
        setPrompt,
        showStatus,
      }),
    );

    await waitFor(() => expect(setAttachments).toHaveBeenCalled());
    expect(showStatus).toHaveBeenCalledWith(expect.stringMatching(/attached/i));
  });

  it("reports failure when image fetch errors", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;

    seedStorage("session", {
      [PENDING_MULTI_PANEL_ACTION_KEY]: {
        action: "attachImage",
        payload: { imageUrl: "https://example.com/foo.png" },
      },
    });

    renderHookWithProviders(() =>
      usePendingActionController({
        isHydrated: true,
        setAttachments,
        setPrompt,
        showStatus,
      }),
    );

    await waitFor(() =>
      expect(showStatus).toHaveBeenCalledWith(expect.stringMatching(/couldn't|failed/i)),
    );
    expect(setAttachments).not.toHaveBeenCalled();
  });

  it("falls back to local storage when session storage is empty", async () => {
    seedStorage("local", {
      [PENDING_MULTI_PANEL_ACTION_KEY]: {
        action: "sendToPanel",
        payload: { selectedText: "fromLocal" },
      },
    });

    renderHookWithProviders(() =>
      usePendingActionController({
        isHydrated: true,
        setAttachments,
        setPrompt,
        showStatus,
      }),
    );

    await waitFor(() => expect(setPrompt).toHaveBeenCalledWith("fromLocal"));
  });

  it("no-ops when there is no pending action", async () => {
    renderHookWithProviders(() =>
      usePendingActionController({
        isHydrated: true,
        setAttachments,
        setPrompt,
        showStatus,
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(setPrompt).not.toHaveBeenCalled();
    expect(setAttachments).not.toHaveBeenCalled();
  });
});
