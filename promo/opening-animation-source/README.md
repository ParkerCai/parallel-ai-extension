# Opening animation generator

Renders the 5 s opening animation for the app demo: a stage-1 brand-mark
logo that morphs into the stage-2 small promo tile, on top of a gradient
background with dashed stripes whose dashes march along each line continuously.

Outputs (both 30 fps / 5 s / h264 / yuv420p, both at the existing 1.4704:1
promo aspect ratio):

- `promo/opening-animation-out/parallel-ai-opening-4k.mp4` — 3176 × 2160
- `promo/opening-animation-out/parallel-ai-opening-1080p.mp4` — 1588 × 1080

Frames are captured once at deviceScaleFactor 4 (the 4K native output) and
ffmpeg lanczos-downscales the same source for the 1080p version, so the two
versions are pixel-for-pixel equivalent at their respective resolutions.

## How to run

Two terminals.

1. Start vite:

   ```bash
   bun run dev -- --port 5184 --host 127.0.0.1
   ```

2. Render:

   ```bash
   node promo/opening-animation-source/render-cdp.mjs
   ```

The script captures 105 PNG frames to a temp directory, then runs `ffmpeg` to
mux them into the final MP4 in `promo/opening-animation-out/`. The temp frames
are deleted after — set `OPENING_RENDER_KEEP_FRAMES=1` to keep them for
inspection.

## Architecture

- `index.html` — boots `main.tsx` via Vite.
- `main.tsx` — `OpeningFrame` React component, frame-driven via `window.__renderFrame(n)`.
- `render-cdp.mjs` — launches headless Chrome over CDP, calls `__renderFrame`
  for each frame 0…104, captures a PNG per frame, then muxes via `ffmpeg`.

### Animation phases (150 frames @ 30 fps = 5 s)

| frames | duration | what happens |
| --- | --- | --- |
| 0–12 | 0.40 s | stage-1 logo hold (centered BrandMark on gradient) |
| 12–72 | 2.00 s | morph: pill grows from 120 × 120 to the small-tile pill (380 × 127), BG fills in, text fades in toward the end |
| 72–149 | 2.60 s | stage-2 hold — the pill is frozen and matches `promo/small-tile-out/parallel-ai-small-tile.png` exactly; the dashes inside the stripes keep marching |

Easing is `easeOutCubic` so the morph decelerates into the stage-2 pose.

### Dashes inside the stripes

The dashed lines themselves are completely static — only the dashes inside
each line march along the line direction (image up-and-right, i.e. mostly
upward) via animated `stroke-dashoffset`. Speed is
`(4 × 24) / 150 = 0.64 px/frame` — exactly **4 perfect cycles** over the
150-frame window (one dash-cycle is 14 dash + 10 gap = 24 px). Because the
dash pattern is periodic with period 24, the visual step from frame 149 back
to frame 0 is the same inter-frame step modulo 24, so **the animation loops
seamlessly** if you wrap it.

To reverse the march direction (down-and-left instead of up-and-right), flip
the sign of `dashOffset` in `OpeningFrame` (`-frame * STRIPE_DASH_PER_FRAME`
→ `+frame * STRIPE_DASH_PER_FRAME`).

### Why a 794 × 540 CSS viewport for 1588 × 1080 output

Rendering at deviceScaleFactor 2 keeps the SVG and gradient sharp at the final
resolution while letting the layout math stay in clean half-size CSS pixels.
The CDP `Page.captureScreenshot` clip is in CSS pixels; the output PNG is
clip-dimensions × deviceScaleFactor.

### Why `translate(0 drift)` is prepended to `patternTransform`

SVG applies the leftmost transform last (outermost in image coords). The
existing `rotate(-70) translate(-400 -17)` first centers and tilts the
pattern; prepending `translate(0 drift)` shifts the *final* result in image
+Y, which is true top → bottom drift. Without prepending, a `+Y` shift in
pattern coords ends up perpendicular to the stripes and reads as a sideways
"marching ants" motion.

## Tuning

Open `main.tsx` and edit:

- `LOGO_HOLD_END` / `MORPH_END` — phase boundaries
- `LOGO_SIZE`, `PILL_WIDTH`, `PILL_HEIGHT` — start and end pill geometry
- `STRIPE_CYCLES` — how many drift cycles fit in the 3.5 s window
- `getMorphProgress` — swap `easeOutCubic` for a different easing
- shadow / text opacity ramps in `OpeningFrame`

Vite HMR updates the page immediately. You can also open
`http://127.0.0.1:5184/promo/opening-animation-source/index.html` in a regular
browser and call `__renderFrame(N)` from devtools to scrub.

## Env overrides

- `OPENING_RENDER_PORT` — vite port (default `5184`)
- `OPENING_RENDER_CHROME_PORT` — remote debugging port (default `9336`)
- `OPENING_RENDER_OUT_DIR` — mp4 output dir (default `promo/opening-animation-out`)
- `OPENING_RENDER_FRAMES_DIR` — temp frame dir
- `OPENING_RENDER_KEEP_FRAMES` — set to `1` to keep frame PNGs after muxing
- `CHROME_PATH`, `FFMPEG_PATH` — binary paths
