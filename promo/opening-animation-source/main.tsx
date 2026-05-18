import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

declare global {
  interface Window {
    __renderFrame: (frame: number) => void;
  }
}

/*
 * Opening animation for the app demo. 5 s at 30 fps (150 frames), rendered
 * into a 794 × 540 CSS viewport at deviceScaleFactor 2 → 1588 × 1080 PNGs,
 * matching the existing promo-1080p.mp4 dimensions.
 *
 * Layers (back → front):
 *   1. Radial gradient bg (matches small-tile design)
 *   2. Dashed-stripe SVG pattern — lines are static, only the dashes inside
 *      each line march along the line direction (toward image up-and-right)
 *      via stroke-dashoffset, in a perfect-loop cadence
 *   3. Pill that morphs from a stage-1 brand-mark logo (a centered 120 × 120
 *      circle) into the stage-2 small-tile pill (matches the committed
 *      promo/small-tile-out/parallel-ai-small-tile.png exactly)
 *
 * Phases:
 *   frame   0– 12  (0.40 s)  logo hold
 *   frame  12– 72  (2.00 s)  morph: pill grows, bg fills in, text fades in
 *   frame  72–149  (2.60 s)  stage-2 hold (full pill frozen, dashes keep marching)
 */

const CANVAS_WIDTH = 794;   // * DPR 2 = 1588
const CANVAS_HEIGHT = 540;  // * DPR 2 = 1080

const FPS = 30;
const TOTAL_FRAMES = 150;

const LOGO_HOLD_END = 12;
const MORPH_END = 72;

// Stage 1 ─ standalone brand-mark logo, sized for visibility on a 794 × 540
// canvas. The "pill" at stage 1 is a transparent circle of the same size, so
// the brand mark appears to float on the gradient with no pill body yet.
const STAGE1_LOGO_SIZE = 120;

// Stage 2 ─ pill geometry MATCHES the committed small-tile, rounded to
// integer pixels so the SVG brand mark renders on a whole-pixel grid (otherwise
// anti-aliasing at fractional widths can clip a half pixel off the right edge
// of the dark circle). The small tile's reference values (FloatingComposer bar
// scaled by 380/180 = 2.111) and the rounded values used here:
//   pill height 60 → 126.67 → 127
//   wrapper h-8 w-8 (32 px) → 67.6 → 68
//   text-xs (12 px) → 25.3 → 25
//   bar px-3.5 (14 px) → 29.6 → 30
//   gap-3 + pr-1 (16 px) → 33.8 → 34
const STAGE2_PILL_WIDTH = 380;
const STAGE2_PILL_HEIGHT = 127;
const STAGE2_BRAND_SIZE = 68;
const STAGE2_BRAND_LEFT = 30;
const STAGE2_BRAND_TOP = (STAGE2_PILL_HEIGHT - STAGE2_BRAND_SIZE) / 2;
const STAGE2_TEXT_GAP = 34;
const STAGE2_TEXT_FONT_SIZE = 25;

// Stripes are static. Each line's dash pattern (14 dash + 10 gap = 24 cycle)
// marches along the line via stroke-dashoffset, so the dashes appear to slide
// diagonally inside each stripe without the stripes themselves moving. The
// dashoffset is applied NEGATIVELY in OpeningFrame — negative offset advances
// the pattern in the line's forward direction, which after the -70° rotation
// reads in image coords as "up-and-right" (mostly upward). Flip the sign in
// OpeningFrame to reverse the visual march direction. 4 perfect cycles over
// 150 frames → seamless loop (the step from frame 149 to frame 0 is the same
// inter-frame step, modulo the 24-px dash cycle).
const STRIPE_DASH_CYCLE = 14 + 10;
const STRIPE_DASH_CYCLES_PER_VIDEO = 4;
const STRIPE_DASH_PER_FRAME =
  (STRIPE_DASH_CYCLES_PER_VIDEO * STRIPE_DASH_CYCLE) / TOTAL_FRAMES;

// BrandMark SVG paths (lifted verbatim from src/multi-panel/components/BrandMark.tsx).
const CIRCLE_PATH =
  "M239.91,119.96C239.91,53.71,186.2,0,119.95,0S0,53.71,0,119.96s53.71,119.96,119.95,119.96,119.96-53.71,119.96-119.96";
const PARALLELOGRAM_PATH =
  "M190.36,57.32c4.35,0,8.43,2.12,10.92,5.69,2.5,3.56,3.1,8.12,1.61,12.21h.02s-32.7,89.83-32.7,89.83l-.02-.02c-3.83,10.53-13.84,17.54-25.05,17.54v.03s-95.59,0-95.59,0h-.02c-4.35,0-8.43-2.12-10.92-5.69-2.5-3.56-3.1-8.12-1.61-12.21l.04.02,32.7-89.82h-.01c3.83-10.54,13.84-17.55,25.05-17.55h95.6";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number) {
  const progress = clamp(value);
  return 1 - Math.pow(1 - progress, 3);
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function getMorphProgress(frame: number) {
  if (frame < LOGO_HOLD_END) return 0;
  if (frame >= MORPH_END) return 1;
  return easeOutCubic((frame - LOGO_HOLD_END) / (MORPH_END - LOGO_HOLD_END));
}

function BrandMark({ size }: { size: number }) {
  // overflow="visible" prevents the circle path's anti-aliased right/bottom
  // edges from being clipped by the SVG viewport (the path's extreme point sits
  // exactly on the viewBox boundary).
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 239.91 239.91"
      width={size}
      height={size}
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path fill="#1a1a1a" d={CIRCLE_PATH} />
      <path fill="#ffffff" stroke="#1a1a1a" strokeMiterlimit={10} d={PARALLELOGRAM_PATH} />
    </svg>
  );
}

function Stripes({ dashOffset }: { dashOffset: number }) {
  // Lines are static (no patternTransform drift). The dash pattern itself
  // marches along each line via stroke-dashoffset, so the dashes appear to
  // slide diagonally inside each stripe.
  return (
    <svg
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="opening-stripes"
          width="800"
          height="34"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-70) translate(-400 -17)"
        >
          <line
            x1="0"
            y1="17"
            x2="800"
            y2="17"
            stroke="#345a7e"
            strokeWidth="1.2"
            strokeDasharray="14 10"
            strokeLinecap="butt"
            strokeDashoffset={dashOffset}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#opening-stripes)" opacity="0.30" />
    </svg>
  );
}

function OpeningFrame({ frame }: { frame: number }) {
  const progress = getMorphProgress(frame);

  // Pill grows from a STAGE1_LOGO_SIZE square (with the brand mark filling it)
  // to the stage-2 small-tile pill (380 × 126.67), centered both axes throughout.
  const pillW = mix(STAGE1_LOGO_SIZE, STAGE2_PILL_WIDTH, progress);
  const pillH = mix(STAGE1_LOGO_SIZE, STAGE2_PILL_HEIGHT, progress);
  const pillL = (CANVAS_WIDTH - pillW) / 2;
  const pillT = (CANVAS_HEIGHT - pillH) / 2;
  const pillRadius = pillH / 2;

  // Brand mark shrinks from STAGE1_LOGO_SIZE (filling the stage-1 circle) to
  // STAGE2_BRAND_SIZE (the small-tile pill brand) and slides to its left-of-pill
  // position. At progress=0 it sits at (0,0) inside the pill, centered because
  // pill and brand are the same size; at progress=1 it sits at the small-tile
  // brand offset inside the wider pill.
  const brandSize = mix(STAGE1_LOGO_SIZE, STAGE2_BRAND_SIZE, progress);
  const brandLeftInsidePill = mix(0, STAGE2_BRAND_LEFT, progress);
  const brandTopInsidePill = mix(0, STAGE2_BRAND_TOP, progress);

  // The pill background only appears as the morph starts — at progress 0 the
  // brand mark sits on the bare gradient (no pill), which is the stage-1 look.
  const pillBgOpacity = clamp((progress - 0.05) / 0.35);
  const shadowAlpha = clamp(progress * 2);
  const textOpacity = clamp((progress - 0.6) / 0.4);

  // Negative offset → dashes march in the line's forward direction (image
  // up-and-right). Flip the sign here to reverse to down-and-left.
  const dashOffset = -frame * STRIPE_DASH_PER_FRAME;

  return (
    <div className="stage" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <div
        className="stage-bg"
        style={{
          background: "radial-gradient(circle at top left, #E3F2FD 0%, #A1CEF2 100%)",
        }}
      />
      <Stripes dashOffset={dashOffset} />

      <div
        className="pill"
        style={{
          left: pillL,
          top: pillT,
          width: pillW,
          height: pillH,
          borderRadius: pillRadius,
          background: `rgba(250, 250, 250, ${pillBgOpacity})`,
          boxShadow: [
            `0 0   16px -6px rgba(0,0,0,${0.08 * shadowAlpha})`,
            `0 10px 24px -8px rgba(0,0,0,${0.14 * shadowAlpha})`,
            `0 20px 40px -16px rgba(0,0,0,${0.16 * shadowAlpha})`,
          ].join(", "),
        }}
      >
        <div
          className="brand"
          style={{
            left: brandLeftInsidePill,
            top: brandTopInsidePill,
            width: brandSize,
            height: brandSize,
          }}
        >
          <BrandMark size={brandSize} />
        </div>
        <div
          className="label"
          style={{
            left: STAGE2_BRAND_LEFT + STAGE2_BRAND_SIZE + STAGE2_TEXT_GAP,
            fontSize: STAGE2_TEXT_FONT_SIZE,
            opacity: textOpacity,
          }}
        >
          PARALLEL AI
        </div>
      </div>
    </div>
  );
}

const style = document.createElement("style");
style.textContent = `
  html, body, #root {
    width: ${CANVAS_WIDTH}px;
    height: ${CANVAS_HEIGHT}px;
    margin: 0;
    overflow: hidden;
    background: transparent;
  }
  .stage {
    position: relative;
    overflow: hidden;
  }
  .stage-bg {
    position: absolute;
    inset: 0;
  }
  .pill {
    position: absolute;
    /* No overflow: hidden — the brand mark and text are sized to fit fully
       inside the rounded pill bounds at every morph step, and clipping at the
       rounded boundary would shave AA pixels off the brand circle at stage 1
       (where the brand circle and the pill clip are exactly coincident). */
  }
  .brand {
    position: absolute;
  }
  .label {
    position: absolute;
    top: 0;
    height: 100%;
    display: flex;
    align-items: center;
    font-family: "Aptos", "Segoe UI Variable Display", "Segoe UI", sans-serif;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #474747;
    white-space: nowrap;
  }
`;
document.head.append(style);

const root = createRoot(document.getElementById("root")!);

function renderFrame(frame: number) {
  flushSync(() => {
    root.render(<OpeningFrame frame={frame} />);
  });
}

window.__renderFrame = renderFrame;
renderFrame(0);

export { TOTAL_FRAMES, FPS, CANVAS_WIDTH, CANVAS_HEIGHT };
