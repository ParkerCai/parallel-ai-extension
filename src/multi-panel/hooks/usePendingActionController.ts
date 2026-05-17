import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { PENDING_MULTI_PANEL_ACTION_KEY } from "@/shared/lib/constants";
import { tx } from "@/shared/lib/i18n";
import type { PendingAction, QueuedFile } from "@/multi-panel/types";

const MAX_ATTACHMENTS = 10;

interface UsePendingActionControllerOptions {
  isHydrated: boolean;
  setAttachments: Dispatch<SetStateAction<QueuedFile[]>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  showStatus: (message: string) => void;
}

function deriveFilenameFromUrl(rawUrl: string, mimeType: string): string {
  const ext = mimeType.split("/")[1] || "bin";
  try {
    const segment = new URL(rawUrl).pathname.split("/").filter(Boolean).pop();
    if (segment) {
      const decoded = decodeURIComponent(segment);
      return /\.[a-z0-9]+$/i.test(decoded) ? decoded : `${decoded}.${ext}`;
    }
  } catch {
    // fall through
  }
  return `image.${ext}`;
}

async function fetchImageAsQueuedFile(imageUrl: string): Promise<QueuedFile> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || "image/octet-stream";
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const name = deriveFilenameFromUrl(imageUrl, mimeType);
  return {
    id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    size: blob.size,
    type: mimeType,
    dataUrl,
  };
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
  isHydrated,
  setAttachments,
  setPrompt,
  showStatus,
}: UsePendingActionControllerOptions) {
  // Each tab consumes a pending action exactly once. The ref guards against
  // effect re-runs (showStatus is recreated every render, so the effect's
  // deps churn) — without it, an already-open workspace would steal actions
  // meant for a newly-created tab.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || consumedRef.current) {
      return;
    }
    consumedRef.current = true;

    void (async () => {
      const pendingAction = await readPendingAction();
      if (!pendingAction) {
        return;
      }

      await clearPendingAction();

      if (pendingAction.action === "attachImage" && pendingAction.payload?.imageUrl) {
        try {
          const queuedFile = await fetchImageAsQueuedFile(pendingAction.payload.imageUrl);
          setAttachments((current) => [...current, queuedFile].slice(0, MAX_ATTACHMENTS));
          showStatus(tx("statusImageAttached", "Image attached to composer."));
        } catch {
          showStatus(tx("statusImageFetchFailed", "Couldn't fetch that image."));
        }
        return;
      }

      if (pendingAction.action === "sendToPanel" && pendingAction.payload?.selectedText) {
        setPrompt(pendingAction.payload.selectedText);
        showStatus(tx("statusSelectedTextLoaded", "Selected text loaded into composer."));
      }
    })();
  }, [isHydrated, setAttachments, setPrompt, showStatus]);
}
