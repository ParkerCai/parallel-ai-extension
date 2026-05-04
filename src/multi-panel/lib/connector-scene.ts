import {
  buildConnectorPath,
  getFallbackPanelAnchor,
  getRectEdgePoint,
  movePointToward,
} from "@/multi-panel/lib/connector-geometry";
import type {
  ConnectorLineState,
  ConnectorOccluderModel,
  ConnectorPathModel,
  PanelInputAnchor,
} from "@/multi-panel/types";
import type { PanelProviderSlot } from "@/shared/lib/settings";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

interface BuildConnectorSceneOptions {
  connectorLayoutVersion: number;
  connectorStates: Record<string, ConnectorLineState>;
  frameRefs: Record<string, HTMLIFrameElement | null>;
  panelInputAnchors: Record<string, PanelInputAnchor>;
  panelSlotRefs: Record<number, HTMLDivElement | null>;
  slotProviders: PanelProviderSlot[];
  composerElement: HTMLDivElement | null;
  enabled: boolean;
  occluderPaddingPx: number;
  sourceOverdrawPx: number;
  targetOverdrawPx: number;
}

interface ConnectorScene {
  occluders: ConnectorOccluderModel[];
  paths: ConnectorPathModel[];
}

const EMPTY_CONNECTOR_SCENE: ConnectorScene = {
  occluders: [],
  paths: [],
};

export function buildConnectorScene({
  connectorLayoutVersion,
  connectorStates,
  composerElement,
  enabled,
  frameRefs,
  occluderPaddingPx,
  panelInputAnchors,
  panelSlotRefs,
  slotProviders,
  sourceOverdrawPx,
  targetOverdrawPx,
}: BuildConnectorSceneOptions): ConnectorScene {
  void connectorLayoutVersion;

  if (!enabled || !composerElement) {
    return EMPTY_CONNECTOR_SCENE;
  }

  const composerRect = composerElement.getBoundingClientRect();
  if (!composerRect.width || !composerRect.height) {
    return EMPTY_CONNECTOR_SCENE;
  }

  const occluders: ConnectorOccluderModel[] = [];
  const paths = slotProviders.flatMap((providerId, slotIndex) => {
    if (!providerId) {
      return [];
    }

    const panelElement = panelSlotRefs[slotIndex];
    if (!panelElement) {
      return [];
    }

    const panelRect = panelElement.getBoundingClientRect();
    if (!panelRect.width || !panelRect.height) {
      return [];
    }

    const reportedAnchor = panelInputAnchors[providerId];
    const frameRect = frameRefs[providerId]?.getBoundingClientRect() ?? null;

    if (reportedAnchor && frameRect) {
      const occluderX = frameRect.left + clamp(reportedAnchor.left, 0, frameRect.width);
      const occluderY = frameRect.top + clamp(reportedAnchor.top, 0, frameRect.height);
      const occluderWidth = Math.min(reportedAnchor.width, frameRect.width);
      const occluderHeight = Math.min(reportedAnchor.height, frameRect.height);

      if (occluderWidth > 0 && occluderHeight > 0) {
        occluders.push({
          height: occluderHeight + occluderPaddingPx * 2,
          radius: Math.max(0, reportedAnchor.radius + occluderPaddingPx),
          width: occluderWidth + occluderPaddingPx * 2,
          x: occluderX - occluderPaddingPx,
          y: occluderY - occluderPaddingPx,
        });
      }
    }

    const rawTargetPoint =
      reportedAnchor && frameRect
        ? {
          x: frameRect.left + clamp(reportedAnchor.x, 0, frameRect.width),
          y: frameRect.top + clamp(reportedAnchor.y, 0, frameRect.height),
        }
        : getFallbackPanelAnchor(panelRect);
    const composerCenter = {
      x: composerRect.left + composerRect.width / 2,
      y: composerRect.top + composerRect.height / 2,
    };
    const sourcePoint = movePointToward(
      getRectEdgePoint(composerRect, rawTargetPoint),
      composerCenter,
      sourceOverdrawPx,
    );
    const targetPoint =
      reportedAnchor && frameRect
        ? movePointToward(
          getRectEdgePoint(
            new DOMRect(
              frameRect.left + clamp(reportedAnchor.left, 0, frameRect.width),
              frameRect.top + clamp(reportedAnchor.top, 0, frameRect.height),
              Math.min(reportedAnchor.width, frameRect.width),
              Math.min(reportedAnchor.height, frameRect.height),
            ),
            sourcePoint,
          ),
          rawTargetPoint,
          targetOverdrawPx,
        )
        : rawTargetPoint;
    const connectorState = connectorStates[providerId];

    return [
      {
        path: buildConnectorPath(sourcePoint, targetPoint),
        phase: connectorState?.phase ?? "idle",
        providerId,
        pulseKey: connectorState?.pulseKey ?? 0,
        source: sourcePoint,
        target: targetPoint,
      },
    ];
  });

  return {
    occluders,
    paths,
  };
}
