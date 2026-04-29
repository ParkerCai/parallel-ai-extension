import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";

import { buildConnectorScene } from "@/multi-panel/lib/connector-scene";
import { getActivePanelProviders } from "@/multi-panel/lib/panel-layout";
import type {
  ConnectorLineState,
  ConnectorPhase,
  PanelInputAnchor,
  QueuedFile,
} from "@/multi-panel/types";
import type { ProviderId } from "@/shared/lib/providers";
import type { GoogleProviderMode, PanelProviderSlot } from "@/shared/lib/settings";

const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = "multi-panel-provider-status";
const PARALLEL_AI_PROVIDER_BUSY = "PARALLEL_AI_PROVIDER_BUSY";
const PARALLEL_AI_PROVIDER_IDLE = "PARALLEL_AI_PROVIDER_IDLE";
const PARALLEL_AI_PROVIDER_INPUT_ANCHOR = "PARALLEL_AI_PROVIDER_INPUT_ANCHOR";
const PARALLEL_AI_PROVIDER_USER_INTERACTION = "PARALLEL_AI_PROVIDER_USER_INTERACTION";
const CONNECTOR_DRAFT_SEPARATOR = "\u0001";
const CONNECTOR_FILL_DURATION_MS = 1150;
const CONNECTOR_SEND_FALLBACK_SETTLE_MS = 2200;
const CONNECTOR_SOURCE_OVERDRAW_PX = 10;
const CONNECTOR_TARGET_OVERDRAW_PX = 4;
const CONNECTOR_OCCLUDER_PADDING_PX = 0;

function buildDraftFingerprint(promptText: string, files: QueuedFile[]) {
  return [promptText.trim(), ...files.map((file) => `${file.id}:${file.name}:${file.size}`)].join(
    CONNECTOR_DRAFT_SEPARATOR,
  );
}

interface UseConnectorControllerOptions {
  composerRef: RefObject<HTMLDivElement>;
  composerShellRef: RefObject<HTMLDivElement>;
  connectorOverlayEnabled: boolean;
  frameRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
  googleProviderMode: GoogleProviderMode;
  layout: string;
  panelProviders: PanelProviderSlot[];
  panelSlotRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  prompt: string;
  attachments: QueuedFile[];
  scrollSyncEnabled: boolean;
  slotProviders: PanelProviderSlot[];
  temporaryChatEnabled: boolean;
}

export function useConnectorController({
  composerRef,
  composerShellRef,
  connectorOverlayEnabled,
  frameRefs,
  googleProviderMode,
  layout,
  panelProviders,
  panelSlotRefs,
  prompt,
  attachments,
  scrollSyncEnabled,
  slotProviders,
  temporaryChatEnabled,
}: UseConnectorControllerOptions) {
  const [panelInputAnchors, setPanelInputAnchors] = useState<Record<string, PanelInputAnchor>>({});
  const [connectorStates, setConnectorStates] = useState<Record<string, ConnectorLineState>>({});
  const [connectorLayoutVersion, setConnectorLayoutVersion] = useState(0);
  const connectorDraftWhitelistRef = useRef<Set<string>>(new Set([buildDraftFingerprint("", [])]));
  const connectorPulseKeyRef = useRef(0);
  const connectorLayoutRafRef = useRef<number | null>(null);
  const connectorSettleTimeoutsRef = useRef<Record<string, number>>({});

  function clearConnectorSettleTimeout(providerId: ProviderId) {
    const timeoutId = connectorSettleTimeoutsRef.current[providerId];
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      delete connectorSettleTimeoutsRef.current[providerId];
    }
  }

  function scheduleConnectorSettle(
    providerIds: ProviderId[],
    requestId: string | null,
    delay: number,
  ) {
    for (const providerId of providerIds) {
      clearConnectorSettleTimeout(providerId);
      connectorSettleTimeoutsRef.current[providerId] = window.setTimeout(() => {
        setConnectorStates((current) => {
          const nextState = current[providerId];
          if (!nextState || nextState.requestId !== requestId) {
            return current;
          }

          if (nextState.phase === "settled") {
            return current;
          }

          return {
            ...current,
            [providerId]: {
              ...nextState,
              phase: "settled",
              lastUpdatedAt: Date.now(),
            },
          };
        });
      }, delay);
    }
  }

  function resetConnectorVisuals(promptText = "", files: QueuedFile[] = []) {
    connectorDraftWhitelistRef.current = new Set([buildDraftFingerprint(promptText, files)]);
    Object.keys(connectorSettleTimeoutsRef.current).forEach((providerId) =>
      clearConnectorSettleTimeout(providerId as ProviderId),
    );
    setConnectorStates({});
  }

  function queueConnectorLayoutRefresh() {
    if (connectorLayoutRafRef.current !== null) {
      return;
    }

    connectorLayoutRafRef.current = window.requestAnimationFrame(() => {
      connectorLayoutRafRef.current = null;
      setConnectorLayoutVersion((current) => current + 1);
    });
  }

  function updateConnectorPhase(
    providerId: ProviderId,
    requestId: string | null,
    phase: ConnectorPhase,
  ) {
    if (phase === "settled" || phase === "submitting") {
      clearConnectorSettleTimeout(providerId);
    }

    setConnectorStates((current) => {
      const nextState = current[providerId];
      if (!nextState) {
        return current;
      }

      if (requestId && nextState.requestId && nextState.requestId !== requestId) {
        return current;
      }

      if (nextState.phase === phase) {
        return current;
      }

      return {
        ...current,
        [providerId]: {
          ...nextState,
          phase,
          lastUpdatedAt: Date.now(),
        },
      };
    });
  }

  function armConnectorDispatch(
    providerIds: ProviderId[],
    requestId: string | null,
    autoSubmit: boolean,
    promptText: string,
    files: QueuedFile[],
  ) {
    if (!providerIds.length) {
      return;
    }

    connectorDraftWhitelistRef.current = new Set(
      autoSubmit
        ? [buildDraftFingerprint(promptText, files), buildDraftFingerprint("", [])]
        : [buildDraftFingerprint(promptText, files)],
    );

    connectorPulseKeyRef.current += 1;
    const pulseKey = connectorPulseKeyRef.current;
    const nextPhase: ConnectorPhase = autoSubmit ? "submitting" : "filling";
    const timestamp = Date.now();

    setConnectorStates((current) => {
      const nextState = { ...current };
      for (const providerId of providerIds) {
        clearConnectorSettleTimeout(providerId);
        nextState[providerId] = {
          autoSubmit,
          lastUpdatedAt: timestamp,
          phase: nextPhase,
          pulseKey,
          requestId,
        };
      }
      return nextState;
    });

    scheduleConnectorSettle(
      providerIds,
      requestId,
      autoSubmit ? CONNECTOR_SEND_FALLBACK_SETTLE_MS : CONNECTOR_FILL_DURATION_MS,
    );
  }

  useEffect(() => {
    const activePanelProviders = getActivePanelProviders(panelProviders);

    Object.keys(connectorSettleTimeoutsRef.current).forEach((providerId) => {
      if (!activePanelProviders.includes(providerId as ProviderId)) {
        clearConnectorSettleTimeout(providerId as ProviderId);
      }
    });

    setPanelInputAnchors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([providerId]) =>
          activePanelProviders.includes(providerId as ProviderId),
        ),
      ) as Record<string, PanelInputAnchor>,
    );
    setConnectorStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([providerId]) =>
          activePanelProviders.includes(providerId as ProviderId),
        ),
      ) as Record<string, ConnectorLineState>,
    );
  }, [panelProviders]);

  useEffect(() => {
    const draftFingerprint = buildDraftFingerprint(prompt, attachments);
    if (connectorDraftWhitelistRef.current.has(draftFingerprint)) {
      return;
    }

    if (!Object.keys(connectorStates).length) {
      return;
    }

    resetConnectorVisuals();
  }, [attachments, connectorStates, prompt]);

  useEffect(() => {
    queueConnectorLayoutRefresh();
  }, [layout, panelProviders, temporaryChatEnabled, googleProviderMode]);

  useEffect(() => {
    function handlePanelMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") {
        return;
      }

      if (event.data.context === MULTI_PANEL_PROVIDER_STATUS_CONTEXT) {
        const providerId = event.data.provider as ProviderId | undefined;
        if (!providerId || !getActivePanelProviders(panelProviders).includes(providerId)) {
          return;
        }

        const providerFrame = frameRefs.current[providerId];
        if (providerFrame?.contentWindow && event.source && providerFrame.contentWindow !== event.source) {
          return;
        }

        if (event.data.type === PARALLEL_AI_PROVIDER_INPUT_ANCHOR) {
          const anchor =
            event.data.anchor &&
              typeof event.data.anchor.x === "number" &&
              typeof event.data.anchor.y === "number" &&
              typeof event.data.anchor.left === "number" &&
              typeof event.data.anchor.top === "number" &&
              typeof event.data.anchor.width === "number" &&
              typeof event.data.anchor.height === "number" &&
              typeof event.data.anchor.radius === "number"
              ? {
                height: event.data.anchor.height,
                left: event.data.anchor.left,
                radius: event.data.anchor.radius,
                top: event.data.anchor.top,
                width: event.data.anchor.width,
                x: event.data.anchor.x,
                y: event.data.anchor.y,
              }
              : null;

          if (!anchor) {
            return;
          }

          setPanelInputAnchors((current) => ({
            ...current,
            [providerId]: {
              source: "reported",
              updatedAt: Date.now(),
              height: anchor.height,
              left: anchor.left,
              radius: anchor.radius,
              top: anchor.top,
              width: anchor.width,
              x: anchor.x,
              y: anchor.y,
            },
          }));
          queueConnectorLayoutRefresh();
          return;
        }

        if (event.data.type === PARALLEL_AI_PROVIDER_BUSY) {
          updateConnectorPhase(providerId, event.data.requestId ?? null, "submitting");
          return;
        }

        if (
          event.data.type === PARALLEL_AI_PROVIDER_IDLE ||
          event.data.type === PARALLEL_AI_PROVIDER_USER_INTERACTION
        ) {
          updateConnectorPhase(providerId, event.data.requestId ?? null, "settled");
        }

        return;
      }

      if (!scrollSyncEnabled || event.data.context !== "multi-panel") {
        return;
      }

      if (event.data.type !== "PANEL_SCROLL_PROGRESS") {
        return;
      }

      const activePanelProviders = getActivePanelProviders(panelProviders);
      const sourceProviderId = activePanelProviders.find(
        (providerId) => frameRefs.current[providerId]?.contentWindow === event.source,
      );

      if (!sourceProviderId) {
        return;
      }

      for (const providerId of activePanelProviders) {
        if (providerId === sourceProviderId) {
          continue;
        }

        frameRefs.current[providerId]?.contentWindow?.postMessage(
          {
            type: "SYNC_SCROLL",
            context: "multi-panel",
            progress: event.data.progress,
          },
          "*",
        );
      }
    }

    window.addEventListener("message", handlePanelMessage);

    return () => {
      window.removeEventListener("message", handlePanelMessage);
    };
  }, [frameRefs, panelProviders, scrollSyncEnabled]);

  useEffect(() => {
    if (!composerRef.current && !composerShellRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      queueConnectorLayoutRefresh();
    });

    if (composerShellRef.current) {
      resizeObserver.observe(composerShellRef.current);
    }

    if (composerRef.current) {
      resizeObserver.observe(composerRef.current);
    }

    Object.values(panelSlotRefs.current).forEach((element) => {
      if (element) {
        resizeObserver.observe(element);
      }
    });

    window.addEventListener("resize", queueConnectorLayoutRefresh);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", queueConnectorLayoutRefresh);
    };
  }, [layout, panelProviders]);

  useEffect(() => {
    return () => {
      if (connectorLayoutRafRef.current !== null) {
        window.cancelAnimationFrame(connectorLayoutRafRef.current);
      }
      Object.keys(connectorSettleTimeoutsRef.current).forEach((providerId) =>
        clearConnectorSettleTimeout(providerId as ProviderId),
      );
    };
  }, []);

  const connectorScene = buildConnectorScene({
    composerElement: composerRef.current,
    connectorLayoutVersion,
    connectorStates,
    enabled: connectorOverlayEnabled,
    frameRefs: frameRefs.current,
    occluderPaddingPx: CONNECTOR_OCCLUDER_PADDING_PX,
    panelInputAnchors,
    panelSlotRefs: panelSlotRefs.current,
    slotProviders,
    sourceOverdrawPx: CONNECTOR_SOURCE_OVERDRAW_PX,
    targetOverdrawPx: CONNECTOR_TARGET_OVERDRAW_PX,
  });

  return {
    armConnectorDispatch,
    connectorOccluderModels: connectorScene.occluders,
    connectorPathModels: connectorScene.paths,
    queueConnectorLayoutRefresh,
    resetConnectorVisuals,
  };
}
