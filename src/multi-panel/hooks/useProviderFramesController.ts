import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { TEMP_CHAT_SUPPORTED_PROVIDERS } from "@/shared/lib/constants";
import { getProviderById, type Provider, type ProviderId } from "@/shared/lib/providers";
import type { GoogleProviderMode, PanelProviderSlot } from "@/shared/lib/settings";
import type { ResolvedTheme } from "@/shared/lib/theme";
import { getActivePanelProviders, getPanelUrl } from "@/multi-panel/lib/panel-layout";

const EMPTY_RESTORED_URLS: Partial<Record<ProviderId, string>> = {};
const WORKSPACE_FRAMING_PROVIDERS = new Set<ProviderId>(["zai", "mimo"]);

interface UseProviderFramesControllerOptions {
  frameRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
  googleProviderMode: GoogleProviderMode;
  isHydrated: boolean;
  onProviderFrameLoad?: () => void;
  panelProviders: PanelProviderSlot[];
  queueConnectorLayoutRefresh: () => void;
  resolvedTheme: ResolvedTheme;
  temporaryChatEnabled: boolean;
  // Conversation URLs restored from this tab's launch state. Used to seed a
  // panel's first iframe src instead of the provider home page.
  restoredUrlByProvider?: Partial<Record<ProviderId, string>>;
  resumeEnabled?: boolean;
  workspaceFramingReady?: boolean;
}

export function useProviderFramesController({
  frameRefs,
  googleProviderMode,
  isHydrated,
  onProviderFrameLoad,
  panelProviders,
  queueConnectorLayoutRefresh,
  resolvedTheme,
  temporaryChatEnabled,
  restoredUrlByProvider = EMPTY_RESTORED_URLS,
  resumeEnabled = false,
  workspaceFramingReady = true,
}: UseProviderFramesControllerOptions) {
  const [loadingProviders, setLoadingProviders] = useState<Record<string, boolean>>({});
  const [refreshByProvider, setRefreshByProvider] = useState<Record<string, number>>({});
  const frameHostRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const frameDescriptorRefs = useRef<Record<string, string>>({});
  const previousPanelProvidersRef = useRef<PanelProviderSlot[]>(panelProviders);
  // Per-provider "intended" src so a panel never silently reloads to home once
  // it has been created. The restored URL only wins at first creation; genuine
  // reload triggers (temp/Google/refresh) move it to the normal URL.
  const intendedSrcRef = useRef<Partial<Record<ProviderId, string>>>({});
  const reloadKeyRef = useRef<Partial<Record<ProviderId, string>>>({});
  const restoreConsumedRef = useRef<Set<ProviderId>>(new Set());

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

  function applyProviderFrameTheme(providerId: ProviderId) {
    const frame = frameRefs.current[providerId];
    if (!frame) {
      return;
    }

    frame.style.colorScheme = resolvedTheme;
  }

  function requestProviderFrameTheme(providerId: ProviderId, delay = 0) {
    window.setTimeout(() => {
      applyProviderFrameTheme(providerId);
    }, delay);
  }

  function handleProviderFrameLoad(providerId: ProviderId) {
    setLoadingProviders((current) => ({
      ...current,
      [providerId]: false,
    }));
    requestProviderFrameTheme(providerId, 80);
    requestProviderFrameTheme(providerId, 900);
    requestProviderInputAnchor(providerId, 180);
    requestProviderInputAnchor(providerId, 1200);
    onProviderFrameLoad?.();

    if (temporaryChatEnabled && TEMP_CHAT_SUPPORTED_PROVIDERS.has(providerId)) {
      window.setTimeout(() => {
        postToProvider(providerId, { type: "ENABLE_TEMP_CHAT" });
      }, 450);
    }
  }

  function computeIntendedSrc(provider: Provider): string {
    const normalSrc = getPanelUrl(provider, googleProviderMode, temporaryChatEnabled);
    const reloadKey = `${normalSrc}|${refreshByProvider[provider.id] ?? 0}`;
    const existing = intendedSrcRef.current[provider.id];

    if (existing === undefined) {
      const tempActive =
        temporaryChatEnabled && TEMP_CHAT_SUPPORTED_PROVIDERS.has(provider.id);
      const canRestore =
        resumeEnabled && !tempActive && !restoreConsumedRef.current.has(provider.id);
      const restored = canRestore ? restoredUrlByProvider[provider.id] : undefined;
      restoreConsumedRef.current.add(provider.id);

      const chosen = restored ?? normalSrc;
      intendedSrcRef.current[provider.id] = chosen;
      reloadKeyRef.current[provider.id] = reloadKey;
      return chosen;
    }

    if (reloadKeyRef.current[provider.id] !== reloadKey) {
      // A genuine reload trigger fired (temp toggle, Google mode, manual
      // refresh): abandon any restored URL and load the normal/new-chat URL.
      intendedSrcRef.current[provider.id] = normalSrc;
      reloadKeyRef.current[provider.id] = reloadKey;
      return normalSrc;
    }

    return existing;
  }

  function ensureProviderFrame(providerId: ProviderId, src: string, title: string) {
    const descriptor = `${src}|${refreshByProvider[providerId] ?? 0}`;
    let frame = frameRefs.current[providerId];

    if (!frame) {
      frame = document.createElement("iframe");
      frame.className = "block h-full w-full bg-[hsl(var(--surface-provider-frame))]";
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.border = "0";
      frame.style.background = `hsl(var(--surface-provider-frame))`;
      frame.style.colorScheme = resolvedTheme;
      frame.title = title;
      frame.allow = "clipboard-read; clipboard-write";
      frame.addEventListener("load", () => handleProviderFrameLoad(providerId));
      frameRefs.current[providerId] = frame;
      frameDescriptorRefs.current[providerId] = "";
    }

    frame.title = title;
    frame.allow = "clipboard-read; clipboard-write";
    frame.style.colorScheme = resolvedTheme;

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
    _src: string,
    title: string,
    element: HTMLDivElement | null,
  ) {
    frameHostRefs.current[providerId] = element;

    if (
      !element ||
      !isHydrated ||
      (!workspaceFramingReady && WORKSPACE_FRAMING_PROVIDERS.has(providerId))
    ) {
      // Pre-hydration hosts are attached by the post-hydration effect below, so
      // the restore decision always runs once settings are loaded.
      return;
    }

    const provider = getProviderById(providerId);
    if (!provider) {
      return;
    }

    ensureProviderFrame(providerId, computeIntendedSrc(provider), title);
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

    getActivePanelProviders(panelProviders).forEach((providerId) => {
      applyProviderFrameTheme(providerId);
    });
  }, [isHydrated, panelProviders, resolvedTheme, googleProviderMode]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const activePanelProviders = getActivePanelProviders(panelProviders);
    const activeProviders = new Set(activePanelProviders);

    activePanelProviders.forEach((providerId) => {
      if (
        !workspaceFramingReady &&
        WORKSPACE_FRAMING_PROVIDERS.has(providerId)
      ) {
        return;
      }

      const provider = getProviderById(providerId);
      if (!provider) {
        return;
      }

      ensureProviderFrame(providerId, computeIntendedSrc(provider), provider.name);
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
    resolvedTheme,
    temporaryChatEnabled,
    workspaceFramingReady,
  ]);

  return {
    loadingProviders,
    postToProvider,
    refreshProvider,
    registerFrameHost,
    requestProviderInputAnchor,
  };
}
