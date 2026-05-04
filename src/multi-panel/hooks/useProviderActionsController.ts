import type { Dispatch, SetStateAction } from "react";

import { TEMP_CHAT_SUPPORTED_PROVIDERS } from "@/shared/lib/constants";
import type { ProviderId } from "@/shared/lib/providers";
import type { PanelProviderSlot } from "@/shared/lib/settings";
import { getActivePanelProviders } from "@/multi-panel/lib/panel-layout";
import type { QueuedFile } from "@/multi-panel/types";

const FILL_CONNECTOR_ANCHOR_REFRESH_MS = 1350;

interface UseProviderActionsControllerOptions {
  armConnectorDispatch: (
    providerIds: ProviderId[],
    requestId: string | null,
    autoSubmit: boolean,
    promptText: string,
    files: QueuedFile[],
  ) => void;
  attachments: QueuedFile[];
  getFilledConnectorProviderIds: (providerIds: ProviderId[]) => ProviderId[];
  getReusableDraftConnectorProviderIds: (providerIds: ProviderId[]) => ProviderId[];
  panelProviders: PanelProviderSlot[];
  postToProvider: (providerId: ProviderId, payload: Record<string, unknown>) => void;
  prompt: string;
  requestProviderInputAnchor: (providerId: ProviderId, delay?: number) => void;
  resetConnectorVisuals: (promptText?: string, files?: QueuedFile[]) => void;
  scrollSyncEnabled: boolean;
  settleConnectorSubmissions: () => void;
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
  getFilledConnectorProviderIds,
  getReusableDraftConnectorProviderIds,
  panelProviders,
  postToProvider,
  prompt,
  requestProviderInputAnchor,
  resetConnectorVisuals,
  scrollSyncEnabled,
  settleConnectorSubmissions,
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
    const filledProviderIds = autoSubmit
      ? getFilledConnectorProviderIds(activePanelProviders)
      : [];
    const reusableDraftProviderIds = autoSubmit
      ? getReusableDraftConnectorProviderIds(activePanelProviders)
      : [];
    const filledProviderSet = new Set(filledProviderIds);
    const reusableDraftProviderSet = new Set(reusableDraftProviderIds);
    const consumedDraftProviderSet = new Set(
      reusableDraftProviderIds.filter((providerId) => !filledProviderSet.has(providerId)),
    );
    const providersToDispatch = autoSubmit
      ? activePanelProviders.filter((providerId) => !consumedDraftProviderSet.has(providerId))
      : activePanelProviders;
    const providersNeedingInjection = autoSubmit
      ? activePanelProviders.filter((providerId) => !reusableDraftProviderSet.has(providerId))
      : activePanelProviders;

    if (!providersToDispatch.length) {
      showStatus("Filled drafts already sent.");
      return;
    }

    armConnectorDispatch(providersToDispatch, requestId, autoSubmit, nextPrompt, attachments);

    for (const providerId of filledProviderIds) {
      postToProvider(providerId, {
        type: "TRIGGER_SEND",
        requestId,
      });
    }

    if (hasFiles) {
      const filesPayload = attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl,
      }));

      for (const providerId of providersNeedingInjection) {
        postToProvider(providerId, {
          type: "INJECT_TEXT_WITH_IMAGES",
          text: nextPrompt,
          images: filesPayload,
          autoSubmit,
          requestId,
        });
      }
    } else if (hasPrompt) {
      for (const providerId of providersNeedingInjection) {
        postToProvider(providerId, {
          type: "INJECT_TEXT",
          text: nextPrompt,
          autoSubmit,
          requestId,
        });
      }
    }

    activePanelProviders.forEach((providerId) =>
      requestProviderInputAnchor(providerId, autoSubmit ? 900 : FILL_CONNECTOR_ANCHOR_REFRESH_MS),
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

  function stopGeneratingEverywhere() {
    const activePanelProviders = getActivePanelProviders(panelProviders);

    for (const providerId of activePanelProviders) {
      postToProvider(providerId, {
        type: "STOP_GENERATION",
      });
      requestProviderInputAnchor(providerId, 260);
    }

    settleConnectorSubmissions();
    showStatus("Requested stop in active panels.");
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
    stopGeneratingEverywhere,
    toggleScrollSync,
    toggleTemporaryChat,
  };
}
