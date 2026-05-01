import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { TEMP_CHAT_SUPPORTED_PROVIDERS } from "@/shared/lib/constants";
import { getProviderById, type ProviderId } from "@/shared/lib/providers";
import type { GoogleProviderMode, PanelProviderSlot } from "@/shared/lib/settings";
import { getActivePanelProviders, getPanelUrl } from "@/multi-panel/lib/panel-layout";

interface UseProviderFramesControllerOptions {
  frameRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
  googleProviderMode: GoogleProviderMode;
  isHydrated: boolean;
  panelProviders: PanelProviderSlot[];
  queueConnectorLayoutRefresh: () => void;
  temporaryChatEnabled: boolean;
}

export function useProviderFramesController({
  frameRefs,
  googleProviderMode,
  isHydrated,
  panelProviders,
  queueConnectorLayoutRefresh,
  temporaryChatEnabled,
}: UseProviderFramesControllerOptions) {
  const [loadingProviders, setLoadingProviders] = useState<Record<string, boolean>>({});
  const [refreshByProvider, setRefreshByProvider] = useState<Record<string, number>>({});
  const frameHostRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const frameDescriptorRefs = useRef<Record<string, string>>({});
  const previousPanelProvidersRef = useRef<PanelProviderSlot[]>(panelProviders);

  function postToProvider(
    providerId: ProviderId,
    payload: Record<string, unknown>,
  ) {
    frameRefs.current[providerId]?.contentWindow?.postMessage(
      {
        ...payload,
        context: "multi-panel",
        providerMode: googleProviderMode,
      },
      "*",
    );
  }

  function requestProviderInputAnchor(providerId: ProviderId, delay = 0) {
    window.setTimeout(() => {
      postToProvider(providerId, {
        type: "REQUEST_INPUT_ANCHOR",
      });
    }, delay);
  }

  function handleProviderFrameLoad(providerId: ProviderId) {
    setLoadingProviders((current) => ({
      ...current,
      [providerId]: false,
    }));
    requestProviderInputAnchor(providerId, 180);
    requestProviderInputAnchor(providerId, 1200);

    if (temporaryChatEnabled && TEMP_CHAT_SUPPORTED_PROVIDERS.has(providerId)) {
      window.setTimeout(() => {
        postToProvider(providerId, { type: "ENABLE_TEMP_CHAT" });
      }, 450);
    }
  }

  function ensureProviderFrame(providerId: ProviderId, src: string, title: string) {
    const descriptor = `${src}|${refreshByProvider[providerId] ?? 0}`;
    let frame = frameRefs.current[providerId];

    if (!frame) {
      frame = document.createElement("iframe");
      frame.className = "block h-full w-full bg-[#131313]";
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.border = "0";
      frame.style.background = "#131313";
      frame.title = title;
      frame.allow = "clipboard-read; clipboard-write";
      frame.addEventListener("load", () => handleProviderFrameLoad(providerId));
      frameRefs.current[providerId] = frame;
      frameDescriptorRefs.current[providerId] = "";
    }

    frame.title = title;
    frame.allow = "clipboard-read; clipboard-write";

    if (frameDescriptorRefs.current[providerId] !== descriptor) {
      frameDescriptorRefs.current[providerId] = descriptor;
      setLoadingProviders((current) => ({
        ...current,
        [providerId]: true,
      }));
      frame.src = src;
    }

    const host = frameHostRefs.current[providerId];
    if (host && frame.parentElement !== host) {
      host.replaceChildren(frame);
      queueConnectorLayoutRefresh();
    }
  }

  function registerFrameHost(
    providerId: ProviderId,
    src: string,
    title: string,
    element: HTMLDivElement | null,
  ) {
    frameHostRefs.current[providerId] = element;

    if (!element) {
      return;
    }

    ensureProviderFrame(providerId, src, title);
  }

  function refreshProvider(providerId: ProviderId) {
    setRefreshByProvider((current) => ({
      ...current,
      [providerId]: Date.now(),
    }));
    setLoadingProviders((current) => ({
      ...current,
      [providerId]: true,
    }));
  }

  useEffect(() => {
    if (!isHydrated) {
      previousPanelProvidersRef.current = panelProviders;
      return;
    }

    const previousPanels = previousPanelProvidersRef.current;
    const previousActivePanels = getActivePanelProviders(previousPanels);
    const nextActivePanels = getActivePanelProviders(panelProviders);
    const isPureReorder =
      previousActivePanels.length === nextActivePanels.length &&
      previousActivePanels.every((providerId) => nextActivePanels.includes(providerId));

    if (isPureReorder) {
      previousPanelProvidersRef.current = panelProviders;
      return;
    }

    const changedProviders = new Set<ProviderId>();
    const activeProviders = new Set(nextActivePanels);
    const maxLength = Math.max(previousPanels.length, panelProviders.length);

    for (let index = 0; index < maxLength; index += 1) {
      const previousProviderId = previousPanels[index];
      const nextProviderId = panelProviders[index];

      if (previousProviderId === nextProviderId) {
        continue;
      }

      if (previousProviderId && activeProviders.has(previousProviderId)) {
        changedProviders.add(previousProviderId);
      }

      if (nextProviderId) {
        changedProviders.add(nextProviderId);
      }
    }

    setLoadingProviders((current) => {
      const nextState = Object.fromEntries(
        Object.entries(current).filter(([providerId]) =>
          activeProviders.has(providerId as ProviderId),
        ),
      ) as Record<string, boolean>;

      changedProviders.forEach((providerId) => {
        nextState[providerId] = true;
      });

      return nextState;
    });

    previousPanelProvidersRef.current = panelProviders;
  }, [isHydrated, panelProviders]);

  useEffect(() => {
    const activePanelProviders = getActivePanelProviders(panelProviders);

    if (!isHydrated || !activePanelProviders.length) {
      return;
    }

    const timerId = window.setTimeout(() => {
      activePanelProviders.forEach((providerId) => requestProviderInputAnchor(providerId));
    }, 360);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isHydrated, panelProviders, refreshByProvider, googleProviderMode, temporaryChatEnabled]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const activePanelProviders = getActivePanelProviders(panelProviders);
    const activeProviders = new Set(activePanelProviders);

    activePanelProviders.forEach((providerId) => {
      const provider = getProviderById(providerId);
      if (!provider) {
        return;
      }

      ensureProviderFrame(
        providerId,
        getPanelUrl(provider, googleProviderMode, temporaryChatEnabled),
        provider.name,
      );
    });

    Object.keys(frameRefs.current).forEach((providerId) => {
      if (activeProviders.has(providerId as ProviderId)) {
        return;
      }

      frameRefs.current[providerId]?.remove();
      delete frameRefs.current[providerId];
      delete frameHostRefs.current[providerId];
      delete frameDescriptorRefs.current[providerId];
    });
  }, [
    frameRefs,
    googleProviderMode,
    isHydrated,
    panelProviders,
    refreshByProvider,
    temporaryChatEnabled,
  ]);

  return {
    loadingProviders,
    postToProvider,
    refreshProvider,
    registerFrameHost,
    requestProviderInputAnchor,
  };
}
