import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useProviderActionsController } from "@/multi-panel/hooks/useProviderActionsController";
import type { QueuedFile } from "@/multi-panel/types";
import type { ProviderId } from "@/shared/lib/providers";

interface ControllerOverrides {
  attachments?: QueuedFile[];
  prompt?: string;
  filledProviderIds?: ProviderId[];
  reusableDraftProviderIds?: ProviderId[];
  panelProviders?: (ProviderId | null)[];
  scrollSyncEnabled?: boolean;
  temporaryChatEnabled?: boolean;
}

function makeHarness(overrides: ControllerOverrides = {}) {
  const armConnectorDispatch = vi.fn();
  const postToProvider = vi.fn();
  const requestProviderInputAnchor = vi.fn();
  const resetConnectorVisuals = vi.fn();
  const settleConnectorSubmissions = vi.fn();
  const setAttachments = vi.fn();
  const setPrompt = vi.fn();
  const setTemporaryChatEnabled = vi.fn();
  const showStatus = vi.fn();
  const updateSetting = vi.fn(async () => undefined);

  const options = {
    armConnectorDispatch,
    attachments: overrides.attachments ?? [],
    getFilledConnectorProviderIds: vi.fn(() => overrides.filledProviderIds ?? []),
    getReusableDraftConnectorProviderIds: vi.fn(
      () => overrides.reusableDraftProviderIds ?? [],
    ),
    panelProviders: (overrides.panelProviders ?? (["chatgpt", "claude"] as ProviderId[])) as never,
    postToProvider,
    prompt: overrides.prompt ?? "",
    requestProviderInputAnchor,
    resetConnectorVisuals,
    scrollSyncEnabled: overrides.scrollSyncEnabled ?? true,
    settleConnectorSubmissions,
    setAttachments,
    setPrompt,
    setTemporaryChatEnabled,
    showStatus,
    temporaryChatEnabled: overrides.temporaryChatEnabled ?? false,
    updateSetting,
  };

  const { result } = renderHookWithProviders(() => useProviderActionsController(options));

  return {
    result,
    armConnectorDispatch,
    postToProvider,
    requestProviderInputAnchor,
    resetConnectorVisuals,
    settleConnectorSubmissions,
    setAttachments,
    setPrompt,
    setTemporaryChatEnabled,
    showStatus,
    updateSetting,
  };
}

describe("useProviderActionsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dispatchPrompt", () => {
    it("warns when there's no prompt and no attachments", async () => {
      const h = makeHarness({ prompt: "" });
      await h.result.current.dispatchPrompt();
      expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/add a prompt/i));
      expect(h.postToProvider).not.toHaveBeenCalled();
    });

    it("ignores whitespace-only prompt with no attachments", async () => {
      const h = makeHarness({ prompt: "   " });
      await h.result.current.dispatchPrompt();
      expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/add a prompt/i));
    });

    it("posts INJECT_TEXT to every active provider when prompt-only", async () => {
      const h = makeHarness({ prompt: "hello" });
      await h.result.current.dispatchPrompt();

      const injectCalls = h.postToProvider.mock.calls.filter(
        ([, msg]) => (msg as { type?: string }).type === "INJECT_TEXT",
      );
      expect(injectCalls).toHaveLength(2);
      expect((injectCalls[0]![1] as { text: string }).text).toBe("hello");
      expect((injectCalls[0]![1] as { autoSubmit: boolean }).autoSubmit).toBe(true);
    });

    it("posts INJECT_TEXT_WITH_IMAGES when there are attachments", async () => {
      const file: QueuedFile = {
        id: "x",
        name: "a.png",
        size: 1,
        type: "image/png",
        dataUrl: "data:image/png;base64,abc",
      };
      const h = makeHarness({ prompt: "hi", attachments: [file] });
      await h.result.current.dispatchPrompt();

      const calls = h.postToProvider.mock.calls.filter(
        ([, msg]) => (msg as { type?: string }).type === "INJECT_TEXT_WITH_IMAGES",
      );
      expect(calls).toHaveLength(2);
      expect((calls[0]![1] as { images: unknown[] }).images).toHaveLength(1);
    });

    it("clears prompt + attachments after autoSubmit dispatch", async () => {
      const h = makeHarness({ prompt: "hi" });
      await h.result.current.dispatchPrompt();
      expect(h.setPrompt).toHaveBeenCalledWith("");
      expect(h.setAttachments).toHaveBeenCalledWith([]);
    });

    it("does NOT clear prompt + attachments when autoSubmit=false", async () => {
      const h = makeHarness({ prompt: "hi" });
      await h.result.current.dispatchPrompt(undefined, false);
      expect(h.setPrompt).not.toHaveBeenCalledWith("");
      expect(h.setAttachments).not.toHaveBeenCalledWith([]);
    });

    it("triggers TRIGGER_SEND on already-filled providers (autoSubmit)", async () => {
      const h = makeHarness({
        prompt: "hi",
        filledProviderIds: ["chatgpt" as ProviderId],
      });
      await h.result.current.dispatchPrompt();
      const trigger = h.postToProvider.mock.calls.find(
        ([, msg]) => (msg as { type?: string }).type === "TRIGGER_SEND",
      );
      expect(trigger).toBeDefined();
      expect(trigger![0]).toBe("chatgpt");
    });

    it("uses the prompt override when provided", async () => {
      const h = makeHarness({ prompt: "original" });
      await h.result.current.dispatchPrompt("override-prompt");
      const inject = h.postToProvider.mock.calls.find(
        ([, msg]) => (msg as { type?: string }).type === "INJECT_TEXT",
      );
      expect((inject![1] as { text: string }).text).toBe("override-prompt");
    });

    it("emits a different status message when autoSubmit=false", async () => {
      const h = makeHarness({ prompt: "hi" });
      await h.result.current.dispatchPrompt(undefined, false);
      expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/filled/i));
    });
  });

  describe("clearPanels", () => {
    it("resets state, posts CLEAR_INPUT to each provider, reports status", () => {
      const h = makeHarness();
      h.result.current.clearPanels();
      expect(h.setPrompt).toHaveBeenCalledWith("");
      expect(h.setAttachments).toHaveBeenCalledWith([]);
      expect(h.resetConnectorVisuals).toHaveBeenCalled();
      const clears = h.postToProvider.mock.calls.filter(
        ([, msg]) => (msg as { type?: string }).type === "CLEAR_INPUT",
      );
      expect(clears).toHaveLength(2);
      expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/cleared/i));
    });
  });

  describe("openNewChatEverywhere", () => {
    it("posts NEW_CHAT to each active provider and reports status", () => {
      const h = makeHarness();
      h.result.current.openNewChatEverywhere();
      const news = h.postToProvider.mock.calls.filter(
        ([, msg]) => (msg as { type?: string }).type === "NEW_CHAT",
      );
      expect(news).toHaveLength(2);
      expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/new chat/i));
    });
  });

  describe("stopGeneratingEverywhere", () => {
    it("posts STOP_GENERATION and settles the connectors", () => {
      const h = makeHarness();
      h.result.current.stopGeneratingEverywhere();
      const stops = h.postToProvider.mock.calls.filter(
        ([, msg]) => (msg as { type?: string }).type === "STOP_GENERATION",
      );
      expect(stops).toHaveLength(2);
      expect(h.settleConnectorSubmissions).toHaveBeenCalled();
    });
  });

  describe("toggleTemporaryChat", () => {
    it("turns on and broadcasts ENABLE_TEMP_CHAT to supported providers", () => {
      const h = makeHarness({ panelProviders: ["chatgpt", "claude"] });
      h.result.current.toggleTemporaryChat();
      expect(h.setTemporaryChatEnabled).toHaveBeenCalledWith(true);
      const enables = h.postToProvider.mock.calls.filter(
        ([, msg]) => (msg as { type?: string }).type === "ENABLE_TEMP_CHAT",
      );
      expect(enables.length).toBeGreaterThan(0);
    });

    it("turns off without broadcasting an enable message", () => {
      const h = makeHarness({ temporaryChatEnabled: true });
      h.result.current.toggleTemporaryChat();
      expect(h.setTemporaryChatEnabled).toHaveBeenCalledWith(false);
      const enables = h.postToProvider.mock.calls.filter(
        ([, msg]) => (msg as { type?: string }).type === "ENABLE_TEMP_CHAT",
      );
      expect(enables).toHaveLength(0);
    });
  });

  describe("toggleScrollSync", () => {
    it("flips and persists the setting", () => {
      const h = makeHarness({ scrollSyncEnabled: true });
      h.result.current.toggleScrollSync();
      expect(h.updateSetting).toHaveBeenCalledWith("scrollSyncEnabled", false);
    });
  });
});
