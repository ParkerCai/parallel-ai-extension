# Small promo tile generator

Renders the Parallel AI Chrome Web Store small promo tile (440 × 280) by
mounting the real `FloatingComposer` React component in headless Chrome and
screenshotting it on top of a gradient + dashed-stripe background.

Outputs:

- `promo/small-tile-out/parallel-ai-small-tile.png` — 440 × 280, 1× pixel density
- `promo/small-tile-out/parallel-ai-small-tile@2x.png` — 880 × 560, deviceScaleFactor 2

## How to run

Two terminals, since the render script connects to a separate vite dev server.

1. Start vite:

   ```bash
   bun run dev -- --port 5184 --host 127.0.0.1
   ```

   (Default port is 5184. Override with `TILE_RENDER_PORT` if needed.)

2. Render:

   ```bash
   node promo/small-tile-source/render-cdp.mjs
   ```

   Both PNGs land in `promo/small-tile-out/`.

## Architecture

- `index.html` — minimal entry that loads `main.tsx` via Vite. The `data-theme="light"`
  attribute is set on `<html>` so the bar renders in light theme from first paint.
- `main.tsx` — mounts a `SmallTile` React component inside the same provider
  stack the multi-panel app uses (`SettingsProvider` → `I18nProvider` →
  `ProviderProvider`), with a `chrome.*` mock that returns `{ theme: "light" }`
  from `chrome.storage.sync.get` so the auto theme doesn't track headless
  Chrome's `prefers-color-scheme: dark`.
- `render-cdp.mjs` — launches headless Chrome, opens the page over CDP, polls
  until the bar + text are present and `data-theme === "light"`, defensively
  re-asserts the light theme right before each screenshot, then captures the
  top-left 440 × 280 region of a 1024 × 720 viewport.

### Why a 1024 × 720 viewport for a 440 × 280 tile

The `FloatingComposer` bar uses Tailwind's `sm:inline` to reveal the
`"PARALLEL AI"` text only when the viewport is ≥ 640 px wide. Rendering inside
a 440 × 280 viewport hides the text; rendering at 1024 × 720 (then clipping to
440 × 280 in `Page.captureScreenshot`) keeps the text visible while still
producing exact-size output.

### Pill geometry (CSS pixels)

- Tile: 440 × 280
- Pill visible size: 380 × 127 (3:1, matches the spec's 380 px wide toolbar pill)
- Pill offset: centered at `(30, 76.67)`

The pill is a clipped/scaled portion of the real `FloatingComposer`:

- Mount `FloatingComposer` inside a `956 × 476` composer-scene (matches the
  reveal video's source coordinates).
- The name-pill region within the composer is at `(158, 238, 180, 60)` in
  source coordinates.
- A `transform: scale(2.111)` on the composer-scene scales that 180 × 60
  region up to 380 × 127 visible pixels.
- `overflow: hidden` + `border-radius: 63.33px` on the outer `.pill-clip`
  produces the rounded pill shape.

### Shadow

The reveal video's production shadow (28 px y-offset, 84 px blur) is far too
large for a 440 × 280 canvas — it would clip on the bottom. The tile uses a
tuned 3-layer shadow that fully fades inside the canvas:

```css
box-shadow:
  0  0   16px -6px  rgba(0,0,0,0.08),
  0 10px 24px -8px  rgba(0,0,0,0.14),
  0 20px 40px -16px rgba(0,0,0,0.16);
```

### Background

- Radial gradient: `radial-gradient(circle at top left, #E3F2FD 0%, #A1CEF2 100%)`.
- Dashed stripes (SVG `<pattern>`): 800 × 34 tile with a single horizontal
  dashed line per tile, `patternTransform="rotate(-70) translate(-400 -17)"`,
  stroke `#345a7e` width 1.2 px, dash `14 / 10`, layer opacity `0.30`.

## Iterating

The `SmallTile` component, pill geometry constants, shadow values, gradient,
and stripes spec are all in `main.tsx`. Edit, save — vite HMR updates the page,
then re-run `render-cdp.mjs` to refresh the output PNGs.

If you want a one-off visual check without re-running the script, just visit
`http://127.0.0.1:5184/promo/small-tile-source/index.html` in a browser at a
≥ 640 px window size.

## Env overrides

- `TILE_RENDER_PORT` — vite port (default `5184`)
- `TILE_RENDER_CHROME_PORT` — remote debugging port (default `9335`)
- `TILE_RENDER_OUT_DIR` — output directory (default `promo/small-tile-out`)
- `TILE_RENDER_URL` — fully-qualified URL of the tile page
- `CHROME_PATH` — absolute path to `chrome.exe` (Windows default points to
  `C:/Program Files/Google/Chrome/Application/chrome.exe`)
- `TILE_RENDER_CHROME_PROFILE` — user data dir for the headless Chrome
