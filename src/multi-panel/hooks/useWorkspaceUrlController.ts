import { useEffect, useRef } from "react";

import type { LayoutId } from "@/shared/lib/layouts";
import type { ProviderId } from "@/shared/lib/providers";
import type { PanelProviderSlot } from "@/shared/lib/settings";
import { getActivePanelProviders } from "@/multi-panel/lib/panel-layout";
import {
  WORKSPACE_STATE_VERSION,
  buildWorkspaceUrl,
  isRestorableProviderUrl,
  isTemporaryChatUrl,
  type WorkspaceState,
} from "@/multi-panel/lib/workspace-state";

const PERSIST_DEBOUNCE_MS = 600;
const isDevelopmentInstall = chrome.management?.getSelf()
  .then((self) => self.installType === "development")
  .catch(() => false) ?? Promise.resolve(false);

interface UseWorkspaceUrlControllerOptions {
  isHydrated: boolean;
  layout: LayoutId;
  panelProviders: PanelProviderSlot[];
  // Live conversation URLs reported by each provider iframe.
  urlByProvider: Record<string, string>;
  // Restored URLs from this tab's launch, used as a floor so the encoded state
  // never regresses below what was restored before iframes report live URLs.
  baselineUrls: Partial<Record<ProviderId, string>>;
}

export function useWorkspaceUrlController({
  isHydrated,
  layout,
  panelProviders,
  urlByProvider,
  baselineUrls,
}: UseWorkspaceUrlControllerOptions) {
  const baselineRef = useRef(baselineUrls);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      const activeProviders = getActivePanelProviders(panelProviders);
      if (activeProviders.length === 0) {
        // No restorable panels — clear any stale ?s= rather than writing a state
        // that decodeWorkspaceState would reject anyway.
        replaceWorkspaceUrl(null);
        return;
      }

      const urls: Partial<Record<ProviderId, string>> = {};

      for (const providerId of activeProviders) {
        const candidate = urlByProvider[providerId] ?? baselineRef.current[providerId];
        // Skip ephemeral temporary chats. Detected per-panel from the URL (not
        // the global temp toggle), so a temp-capable provider that was switched
        // back to a regular chat is still saved.
        if (!candidate || isTemporaryChatUrl(providerId, candidate)) {
          continue;
        }
        if (isRestorableProviderUrl(providerId, candidate)) {
          urls[providerId] = candidate;
        }
      }

      const state: WorkspaceState = {
        v: WORKSPACE_STATE_VERSION,
        layout,
        panels: panelProviders,
        urls,
      };
      replaceWorkspaceUrl(state);
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isHydrated, layout, panelProviders, urlByProvider]);
}

function replaceWorkspaceUrl(state: WorkspaceState | null) {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  const nextUrl = buildWorkspaceUrl(
    { pathname: window.location.pathname, search: window.location.search },
    state,
  );
  // replaceState (not push) so the back button is untouched.
  window.history.replaceState(window.history.state, "", nextUrl);
  // The worker cannot read extension-tab URLs without the broad tabs permission.
  // Report this URL only from unpacked development installs.
  void isDevelopmentInstall.then((isDevelopment) => {
    if (!isDevelopment) return;
    return chrome.runtime.sendMessage({ type: "DEV_WORKSPACE_URL", url: window.location.href });
  }).catch(() => {});
}
