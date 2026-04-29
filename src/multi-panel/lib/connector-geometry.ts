import type { ConnectorPoint } from "@/multi-panel/types";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getRectEdgePoint(rect: DOMRect, target: ConnectorPoint): ConnectorPoint {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = target.x - centerX;
  const dy = target.y - centerY;

  if (dx === 0 && dy === 0) {
    return { x: centerX, y: centerY };
  }

  const halfWidth = Math.max(rect.width / 2, 1);
  const halfHeight = Math.max(rect.height / 2, 1);
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
  const boundedScale = Number.isFinite(scale) ? Math.min(scale, 1) : 1;

  return {
    x: centerX + dx * boundedScale,
    y: centerY + dy * boundedScale,
  };
}

export function getFallbackPanelAnchor(panelRect: DOMRect): ConnectorPoint {
  return {
    x: panelRect.left + panelRect.width / 2,
    y: panelRect.bottom - clamp(panelRect.height * 0.1, 52, 92),
  };
}

export function buildConnectorPath(source: ConnectorPoint, target: ConnectorPoint) {
  return `M ${source.x.toFixed(2)} ${source.y.toFixed(2)} L ${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
}

export function movePointToward(
  source: ConnectorPoint,
  target: ConnectorPoint,
  distance: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const totalDistance = Math.hypot(dx, dy);

  if (!totalDistance || distance === 0) {
    return source;
  }

  const ratio = Math.min(1, distance / totalDistance);
  return {
    x: source.x + dx * ratio,
    y: source.y + dy * ratio,
  };
}
