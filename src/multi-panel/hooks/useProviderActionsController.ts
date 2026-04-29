import type { Dispatch, SetStateAction } from "react";

import { TEMP_CHAT_SUPPORTED_PROVIDERS } from "@/shared/lib/constants";
import type { ProviderId } from "@/shared/lib/providers";
import type { PanelProviderSlot } from "@/shared/lib/settings";
import { getActivePanelProviders } from "@/multi-panel/lib/panel-layout";
import type { QueuedFile } from "@/multi-panel/types";

interface UseProviderActionsControllerOptions {
  armConnectorDispatch: (
    providerIds: ProviderId[],
    requestId: string | null,
    autoSubmit: boolean,
    promptText: string,
    files: QueuedFile[],
  ) => void;
  attachments: QueuedFile[];
  panelProviders: PanelProviderSlot[];
  postToProvider: (providerId: ProviderId, payload: Record<string, unknown>) => void;
  prompt: string;
  requestProviderInputAnchor: (providerId: ProviderId, delay?: number) => void;
  resetConnectorVisuals: (promptText?: string, files?: QueuedFile[]) => void;
  scrollSyncEnabled: boolean;
  setAttachments: Dispatch<SetStateAction<QueuedFile[]>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setTemporaryChatEnabled: Dispatch<SetStateAction<boolean>>;
  showStatus: (message: string) => void;
  temporaryChatEnabled: boolean;
  updateSetting: (key: "scrollSyncEnabled", value: boolean) => Promise<void>;
}

export function useProviderActionsController({
  armConnectorDispatch,
  attachments,
  panelProviders,
  postToProvider,
  prompt,
  requestProviderInputAnchor,
  resetConnectorVisuals,
  scrollSyncEnabled,
  setAttachments,
  setPrompt,
  setTemporaryChatEnabled,
  showStatus,
  temporaryChatEnabled,
  updateSetting,
}: UseProviderActionsControllerOptions) {
  async function dispatchPrompt(promptOverride?: string, autoSubmit = true) {
    const nextPrompt = (promptOverride ?? prompt).trim();
    const hasPrompt = nextPrompt.length > 0;
    const hasFiles = attachments.length > 0;
    const activePanelProviders = getActivePanelProviders(panelProviders);

    if (!hasPrompt && !hasFiles) {
      showStatus("Add a prompt or attachments before sending.");
      return;
    }

    const requestId = `parallel-ai-${Date.now()}`;
    armConnectorDispatch(activePanelProviders, requestId, autoSubmit, nextPrompt, attachments);

    if (hasFiles) {
      const filesPayload = attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl,
      }));

      for (const providerId of activePanelProviders) {
        postToProvider(providerId, {
          type: "INJECT_TEXT_WITH_IMAGES",
          text: nextPrompt,
          images: filesPayload,
          autoSubmit,
          requestId,
        });
      }
    } else if (hasPrompt) {
      for (const providerId of activePanelProviders) {
        postToProvider(providerId, {
          type: "INJECT_TEXT",
          text: nextPrompt,
          autoSubmit,
          requestId,
        });
      }
    }

    activePanelProviders.forEach((providerId) =>
      requestProviderInputAnchor(providerId, autoSubmit ? 900 : 300),
    );

    showStatus(autoSubmit ? "Sent to active panels." : "Filled active panels.");

    if (autoSubmit) {
      setPrompt("");
      setAttachments([]);
    }
  }

  function clearPanels() {
    setPrompt("");
    setAttachments([]);
    resetConnectorVisuals();

    for (const providerId of getActivePanelProviders(panelProviders)) {
      postToProvider(providerId, {
        type: "CLEAR_INPUT",
        clearImages: true,
      });
      requestProviderInputAnchor(providerId, 220);
    }

    showStatus("Cleared the unified input and provider drafts.");
  }

  function openNewChatEverywhere() {
    resetConnectorVisuals();
    for (const providerId of getActivePanelProviders(panelProviders)) {
      postToProvider(providerId, {
        type: "NEW_CHAT",
      });
      requestProviderInputAnchor(providerId, 900);
    }

    showStatus("Requested a new chat in each panel.");
  }

  function toggleTemporaryChat() {
    const nextState = !temporaryChatEnabled;
    setTemporaryChatEnabled(nextState);

    if (nextState) {
      for (const providerId of getActivePanelProviders(panelProviders)) {
        if (TEMP_CHAT_SUPPORTED_PROVIDERS.has(providerId)) {
          postToProvider(providerId, {
            type: "ENABLE_TEMP_CHAT",
          });
        }
      }
    }

    showStatus(
      nextState
        ? "Temporary chat mode enabled where supported."
        : "Returned supported panels to normal chat URLs.",
    );
  }

  function toggleScrollSync() {
    const nextState = !scrollSyncEnabled;
    void updateSetting("scrollSyncEnabled", nextState);
    showStatus(nextState ? "Scroll sync enabled." : "Scroll sync disabled.");
  }

  return {
    clearPanels,
    dispatchPrompt,
    openNewChatEverywhere,
    toggleScrollSync,
    toggleTemporaryChat,
  };
}
