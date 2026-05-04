import type { ProviderId } from "@/shared/lib/providers";

export interface QueuedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export interface PendingAction {
  action: string;
  payload?: {
    selectedText?: string;
  };
}

export type ComposerResizeEdge = "top" | "right" | "bottom" | "left";
export type ConnectorPhase = "idle" | "filling" | "submitting" | "settled";
export type PanelDragState = "idle" | "source" | "target";
export type SettingsTab = "appearance" | "providers" | "keyboard" | "library" | "data" | "about";

export interface ConnectorPoint {
  x: number;
  y: number;
}

export interface PanelInputAnchor {
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
  x: number;
  y: number;
  source: "reported" | "fallback";
  updatedAt: number;
}

export interface ConnectorLineState {
  autoSubmit: boolean;
  lastUpdatedAt: number;
  phase: ConnectorPhase;
  pulseKey: number;
  requestId: string | null;
}

export interface ConnectorPathModel {
  path: string;
  phase: ConnectorPhase;
  providerId: ProviderId;
  pulseKey: number;
  source: ConnectorPoint;
  target: ConnectorPoint;
}

export interface ConnectorOccluderModel {
  height: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}
