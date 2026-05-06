import { Fragment, type CSSProperties } from "react";

import type { ConnectorOccluderModel, ConnectorPathModel } from "@/multi-panel/types";

const FLOW_PULSE_LENGTH_PX = 160;
const FLOW_STROKE_WIDTH_PX = 5;

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
        <linearGradient
          id="composer-connector-flow-gradient"
          x1="0"
          x2={FLOW_PULSE_LENGTH_PX}
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="30%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <filter
          id="composer-connector-flow-glow"
          x="-100%"
          y="-2000%"
          width="300%"
          height="4100%"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b1" />
          <feFlood floodColor="white" floodOpacity="0.95" result="c1" />
          <feComposite in="c1" in2="b1" operator="in" result="s1" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="b2" />
          <feFlood floodColor="white" floodOpacity="0.45" result="c2" />
          <feComposite in="c2" in2="b2" operator="in" result="s2" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="24" result="b3" />
          <feFlood floodColor="white" floodOpacity="0.18" result="c3" />
          <feComposite in="c3" in2="b3" operator="in" result="s3" />
          <feMerge>
            <feMergeNode in="s3" />
            <feMergeNode in="s2" />
            <feMergeNode in="s1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map(({ path, phase, providerId, pulseKey, source, target }) => {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.hypot(dx, dy);
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const flowStyle: CSSProperties & Record<string, string> = {
          ["--flow-distance"]: `${distance}px`,
          ["--flow-pulse-length"]: `${FLOW_PULSE_LENGTH_PX}px`,
        };

        return (
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
              <g
                key={`connector-flow-${providerId}-${pulseKey}`}
                mask={`url(#${maskId})`}
                transform={`translate(${source.x} ${source.y}) rotate(${angleDeg})`}
              >
                <rect
                  className="composer-connector--flow composer-connector--flow-active"
                  x="0"
                  y={-FLOW_STROKE_WIDTH_PX / 2}
                  width={FLOW_PULSE_LENGTH_PX}
                  height={FLOW_STROKE_WIDTH_PX}
                  fill="url(#composer-connector-flow-gradient)"
                  filter="url(#composer-connector-flow-glow)"
                  style={flowStyle}
                />
              </g>
            ) : null}
          </Fragment>
        );
      })}
    </svg>
  );
}
