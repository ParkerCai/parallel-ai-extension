import { Fragment } from "react";

import type { ConnectorOccluderModel, ConnectorPathModel } from "@/multi-panel/types";

interface ConnectorOverlayProps {
  maskId: string;
  occluders: ConnectorOccluderModel[];
  paths: ConnectorPathModel[];
}

export function ConnectorOverlay({ maskId, occluders, paths }: ConnectorOverlayProps) {
  if (!paths.length) {
    return null;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <mask height={height} id={maskId} maskUnits="userSpaceOnUse" width={width} x={0} y={0}>
          <rect fill="white" height={height} width={width} x={0} y={0} />
          {occluders.map((occluder, index) => (
            <rect
              key={`connector-occluder-${index}`}
              fill="black"
              height={occluder.height}
              rx={occluder.radius}
              ry={occluder.radius}
              width={occluder.width}
              x={occluder.x}
              y={occluder.y}
            />
          ))}
        </mask>
      </defs>

      {paths.map(({ path, phase, providerId, pulseKey }) => (
        <Fragment key={`connector-${providerId}`}>
          <path
            className={`composer-connector composer-connector--rail ${phase === "idle" ? "composer-connector--idle" : "composer-connector--active-rail"
              }`}
            d={path}
            mask={`url(#${maskId})`}
          />
          {phase !== "idle" ? (
            <path
              key={`connector-solid-${providerId}`}
              className={`composer-connector composer-connector--solid composer-connector--${phase}`}
              d={path}
              mask={`url(#${maskId})`}
              pathLength={100}
            />
          ) : null}
          {phase === "submitting" ? (
            <path
              key={`connector-flow-${providerId}-${pulseKey}`}
              className="composer-connector composer-connector--flow composer-connector--flow-active"
              d={path}
              mask={`url(#${maskId})`}
              opacity={0}
              pathLength={100}
              strokeDasharray="30 70"
              strokeDashoffset={100}
            />
          ) : null}
        </Fragment>
      ))}
    </svg>
  );
}
