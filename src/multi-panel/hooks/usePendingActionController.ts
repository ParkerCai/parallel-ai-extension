import { useEffect, type Dispatch, type SetStateAction } from "react";

import { PENDING_MULTI_PANEL_ACTION_KEY } from "@/shared/lib/constants";
import type { PanelProviderSlot } from "@/shared/lib/settings";
import type { PendingAction } from "@/multi-panel/types";

interface UsePendingActionControllerOptions {
  dispatchPrompt: (promptOverride?: string, autoSubmit?: boolean) => void | Promise<void>;
  isHydrated: boolean;
  panelProviders: PanelProviderSlot[];
  setPrompt: Dispatch<SetStateAction<string>>;
  setPromptLibraryOpen: Dispatch<SetStateAction<boolean>>;
  showStatus: (message: string) => void;
}

async function readPendingAction(): Promise<PendingAction | null> {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return null;
  }

  try {
    const result = await chrome.storage.session.get(PENDING_MULTI_PANEL_ACTION_KEY);
    if (result[PENDING_MULTI_PANEL_ACTION_KEY]) {
      return result[PENDING_MULTI_PANEL_ACTION_KEY] as PendingAction;
    }
  } catch {
    // fall back to local storage
  }

  try {
    const result = await chrome.storage.local.get(PENDING_MULTI_PANEL_ACTION_KEY);
    return (result[PENDING_MULTI_PANEL_ACTION_KEY] as PendingAction | undefined) ?? null;
  } catch {
    return null;
  }
}

async function clearPendingAction() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  try {
    await chrome.storage.session.remove(PENDING_MULTI_PANEL_ACTION_KEY);
  } catch {
    // ignore
  }

  try {
    await chrome.storage.local.remove(PENDING_MULTI_PANEL_ACTION_KEY);
  } catch {
    // ignore
  }
}

export function usePendingActionController({
  dispatchPrompt,
  isHydrated,
  panelProviders,
  setPrompt,
  setPromptLibraryOpen,
  showStatus,
}: UsePendingActionControllerOptions) {
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let cancelled = false;

    async function consumePendingAction() {
      const pendingAction = await readPendingAction();
      if (cancelled || !pendingAction) {
        return;
      }

      await clearPendingAction();

      if (pendingAction.action === "openPromptLibrary") {
        setPromptLibraryOpen(true);
        showStatus("Prompt library opened.");
        return;
      }

      if (pendingAction.action === "sendToPanel" && pendingAction.payload?.selectedText) {
        const nextPrompt = pendingAction.payload.selectedText;
        setPrompt(nextPrompt);
        showStatus("Selected text imported. Sending to panels...");
        window.setTimeout(() => {
          void dispatchPrompt(nextPrompt, true);
        }, 1200);
      }
    }

    void consumePendingAction();

    return () => {
      cancelled = true;
    };
  }, [dispatchPrompt, isHydrated, panelProviders, setPrompt, setPromptLibraryOpen, showStatus]);
}
