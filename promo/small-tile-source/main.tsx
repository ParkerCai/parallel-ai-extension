import React, { createRef } from "react";
import { createRoot } from "react-dom/client";

import { FloatingComposer } from "/src/multi-panel/components/FloatingComposer";
import { I18nProvider } from "/src/shared/contexts/I18nContext";
import { ProviderProvider } from "/src/shared/contexts/ProviderContext";
import { SettingsProvider } from "/src/shared/contexts/SettingsContext";
import "/src/shared/styles/globals.css";

declare global {
  interface Window {
    chrome: unknown;
  }
}

// Mock just enough of the chrome.* API for the providers to initialize.
// Provide chrome.storage so getSettings() reads our overrides (force light
// theme — DEFAULT_SETTINGS.theme is "auto" and would otherwise track headless
// Chrome's system preference, which can render the bar in dark theme).
const STORAGE_OVERRIDES: Record<string, unknown> = { theme: "light" };
window.chrome = {
  i18n: {
    getUILanguage: () => "en",
    getMessage: () => "",
  },
  runtime: {
    getURL: (path: string) => path,
  },
  storage: {
    sync: {
      get: async (defaults: Record<string, unknown>) => ({ ...defaults, ...STORAGE_OVERRIDES }),
      set: async () => {},
      clear: async () => {},
    },
    local: {
      get: async (defaults: Record<string, unknown>) => ({ ...defaults, ...STORAGE_OVERRIDES }),
      set: async () => {},
      clear: async () => {},
    },
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  tabs: {
    getCurrent: async () => ({ id: 1 }),
    move: async () => ({}),
    update: async () => ({}),
  },
  windows: {
    create: async () => ({}),
    getAll: async () => [],
    getCurrent: async () => ({ type: "normal" }),
    update: async () => ({}),
  },
};

/*
 * Tile geometry (CSS pixels):
 *   - tile:         440 x 280   (Chrome Web Store small promo tile)
 *   - pill visible: 380 x 127   (sized so the toolbar-pill stage is 380px wide;
 *                                127 = 380 * 60/180, preserves the 3:1 source ratio)
 *   - pill offset:  (30, 76.5)  (exactly centered in 440 x 280)
 *
 * The pill is rendered by mounting the real FloatingComposer at its production
 * source size (956 x 476 incl. shadow padding), then clipping it via the same
 * reveal-window pattern used by promo/composer-reveal-source/main.tsx so only
 * the BrandMark + "PARALLEL AI" text region is visible. A CSS transform on the
 * composer-scene scales that 180x60 source region up to 380x127.
 *
 * The reveal-window's box-shadow is *replaced* with one tuned for the tile's
 * 440x280 bounds — production shadow values (84px blur) would clip here.
 */

const TILE_WIDTH = 440;
const TILE_HEIGHT = 280;

// Source-coord constants — must match promo/composer-reveal-source/main.tsx.
const SHADOW_PAD = 140;
const CORE_WIDTH = 676;
const CORE_HEIGHT = 196;
const SOURCE_WIDTH = CORE_WIDTH + SHADOW_PAD * 2;   // 956
const SOURCE_HEIGHT = CORE_HEIGHT + SHADOW_PAD * 2; // 476

// Name-pill region within the composer source (mirrors namePillRect in the
// reveal source: { left: 18+pad, top: 98+pad, width: 180, height: 60 }).
const PILL_SRC_LEFT = 18 + SHADOW_PAD;   // 158
const PILL_SRC_TOP = 98 + SHADOW_PAD;    // 238
const PILL_SRC_WIDTH = 180;
const PILL_SRC_HEIGHT = 60;

const PILL_VISIBLE_WIDTH = 380;
const PILL_SCALE = PILL_VISIBLE_WIDTH / PILL_SRC_WIDTH;          // 2.1111…
const PILL_VISIBLE_HEIGHT = PILL_SRC_HEIGHT * PILL_SCALE;        // 126.67
const PILL_RADIUS = PILL_VISIBLE_HEIGHT / 2;                     // 63.33

const PILL_OFFSET_X = (TILE_WIDTH - PILL_VISIBLE_WIDTH) / 2;     // 30
const PILL_OFFSET_Y = (TILE_HEIGHT - PILL_VISIBLE_HEIGHT) / 2;   // 76.67

// Tile-tuned shadow — fits inside the 440x280 canvas with ~30px breathing room.
const TILE_PILL_SHADOW = [
  "0 0  16px -6px  rgba(0,0,0,0.08)",
  "0 10px 24px -8px rgba(0,0,0,0.14)",
  "0 20px 40px -16px rgba(0,0,0,0.16)",
].join(", ");

// Chrome API stub so FloatingComposer's tab/window calls don't blow up.
window.chrome = {
  tabs: {
    getCurrent: async () => ({ id: 1 }),
    move: async () => ({}),
    update: async () => ({}),
  },
  windows: {
    create: async () => ({}),
    getAll: async () => [],
    getCurrent: async () => ({ type: "normal" }),
    update: async () => ({}),
  },
};

document.documentElement.setAttribute("data-theme", "light");

function noop() {}

function SmallTile() {
  return (
    <div className="tile-root">
      <div className="tile-bg" />
      <Stripes />
      <div
        className="pill-shadow"
        style={{
          left: PILL_OFFSET_X,
          top: PILL_OFFSET_Y,
          width: PILL_VISIBLE_WIDTH,
          height: PILL_VISIBLE_HEIGHT,
          borderRadius: PILL_RADIUS,
          boxShadow: TILE_PILL_SHADOW,
        }}
      >
        <div
          className="pill-clip"
          style={{
            width: PILL_VISIBLE_WIDTH,
            height: PILL_VISIBLE_HEIGHT,
            borderRadius: PILL_RADIUS,
          }}
        >
          <div
            className="composer-scene"
            style={{
              width: SOURCE_WIDTH,
              height: SOURCE_HEIGHT,
              left: -PILL_SRC_LEFT * PILL_SCALE,
              top: -PILL_SRC_TOP * PILL_SCALE,
              transform: `scale(${PILL_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <div className="render-shell">
              <FloatingComposer
                attachments={[]}
                composerDragging={false}
                /* Hardcode pixel sizes: FloatingComposer's normal calc(100vw…)
                   shrinks to the 440px tile viewport otherwise. */
                composerHeight="120px"
                composerInputRef={createRef<HTMLTextAreaElement>()}
                composerOffset={{ x: 0, y: 0 }}
                composerRef={createRef<HTMLDivElement>()}
                composerShellRef={createRef<HTMLDivElement>()}
                composerStatus={null}
                composerWidth="640px"
                hasDraftContent={false}
                onAddPanel={noop}
                onBeginComposerDragFromHeader={noop}
                onBeginComposerResize={noop}
                onClearPanels={noop}
                onClosePromptQuickPick={noop}
                onDispatchPrompt={noop}
                onDrop={noop}
                onFilesSelected={noop}
                onKeyDown={noop}
                onOpenLayoutModal={noop}
                onOpenNewChats={noop}
                onOpenPromptLibrary={noop}
                onOpenPromptQuickPick={noop}
                onOpenSettings={noop}
                onPaste={noop}
                onPromptChange={noop}
                onQuickInsertPrompt={noop}
                onRemoveAttachment={noop}
                onResetComposerHeight={noop}
                onResetComposerPosition={noop}
                onResetComposerWidth={noop}
                onStopGeneration={noop}
                onToggleScrollSync={noop}
                onToggleTemporaryChat={noop}
                prompt=" "
                promptLibraryOpen={false}
                promptQuickPickFavorites={[]}
                promptQuickPickOpen={false}
                promptQuickPickRecents={[]}
                scrollSyncEnabled={false}
                stopGenerationActive={false}
                temporaryChatEnabled={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stripes() {
  // Spec: dashed lines at -70deg, 34px perpendicular spacing, dash 14 / gap 10,
  // stroke #345a7e width 1.2px butt, layer opacity 0.30. Pattern is 800x34 with
  // one horizontal dashed line per tile so rotation produces parallel stripes;
  // patternTransform rotates -70deg then translates so origin stays centered.
  return (
    <svg
      className="tile-stripes"
      width={TILE_WIDTH}
      height={TILE_HEIGHT}
      viewBox={`0 0 ${TILE_WIDTH} ${TILE_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="stripes"
          x="0"
          y="0"
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
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#stripes)" opacity="0.30" />
    </svg>
  );
}

const style = document.createElement("style");
style.textContent = `
  /* Viewport must be >= 640px so the "PARALLEL AI" span (\`hidden sm:inline\`)
     is visible. We render into a 1024x720 viewport and the CDP capture clips
     the top-left 440x280 region — what's outside that crop never makes it into
     the screenshot. */
  html,
  body {
    width: 1024px;
    height: 720px;
    margin: 0;
    overflow: hidden;
    background: transparent;
  }
  #root {
    width: ${TILE_WIDTH}px;
    height: ${TILE_HEIGHT}px;
    margin: 0;
    overflow: hidden;
    background: transparent;
  }

  .tile-root {
    position: relative;
    width: ${TILE_WIDTH}px;
    height: ${TILE_HEIGHT}px;
    overflow: hidden;
  }

  /* Radial gradient: light #E3F2FD at upper-left → #A1CEF2 at lower-right. */
  .tile-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at top left,
      #E3F2FD 0%,
      #A1CEF2 100%
    );
  }

  .tile-stripes {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .pill-shadow {
    position: absolute;
    background: transparent;
  }

  .pill-clip {
    position: relative;
    overflow: hidden;
    background: transparent;
  }

  .composer-scene {
    position: absolute;
  }

  .render-shell {
    position: absolute;
    left: ${SHADOW_PAD + 18}px;
    top: ${SHADOW_PAD + 18}px;
    width: 640px;
    height: 160px;
  }

  /* Production FloatingComposer adds its own shadows to the composer-shell and
     composer-shell-bottom-bar — those are sized for the full reveal animation
     and create dark artifacts inside the cropped name-pill area here. Suppress
     them; the tile-tuned shadow on .pill-shadow handles depth. */
  .render-shell .composer-shell,
  .render-shell .composer-shell-bottom-bar {
    box-shadow: none !important;
  }
`;
document.head.append(style);

const root = createRoot(document.getElementById("root")!);
root.render(
  <SettingsProvider>
    <I18nProvider>
      <ProviderProvider>
        <SmallTile />
      </ProviderProvider>
    </I18nProvider>
  </SettingsProvider>,
);
