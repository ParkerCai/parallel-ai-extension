import React, { createRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { FloatingComposer } from "/src/multi-panel/components/FloatingComposer";
import "/src/shared/styles/globals.css";

declare global {
  interface Window {
    __renderFrame: (frame: number) => void;
    chrome: unknown;
    setPromoComposerFrame: (frame: number) => void;
  }
}

const FPS = 60;
const DPR = 4;
const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 540;
const CORE_WIDTH = 676;
const CORE_HEIGHT = 196;
const SHADOW_PAD = 140;
const SOURCE_WIDTH = CORE_WIDTH + SHADOW_PAD * 2;
const SOURCE_HEIGHT = CORE_HEIGHT + SHADOW_PAD * 2;
const TEXT = "Ask anything everywhere...";

type Rect = {
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
};

function withPad(rect: Rect): Rect {
  return {
    ...rect,
    left: rect.left + SHADOW_PAD,
    top: rect.top + SHADOW_PAD,
  };
}

const logoRect: Rect = withPad({
  left: 28,
  top: 108,
  width: 40,
  height: 40,
  radius: 20,
});

const namePillRect: Rect = withPad({
  left: 18,
  top: 98,
  width: 180,
  height: 60,
  radius: 30,
});

const toolbarPillRect: Rect = withPad({
  left: 18,
  top: 98,
  width: 640,
  height: 60,
  radius: 30,
});

const fullComposerRect: Rect = {
  left: 0,
  top: 0,
  width: SOURCE_WIDTH,
  height: SOURCE_HEIGHT,
  radius: 0,
};

const toolbarScene = centerSceneOn(toolbarPillRect);

function centerSceneOn(rect: Rect) {
  return {
    left: STAGE_WIDTH / 2 - (rect.left + rect.width / 2),
    top: STAGE_HEIGHT / 2 - (rect.top + rect.height / 2),
  };
}

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

function snap(value: number) {
  return Math.round(value * DPR) / DPR;
}

function mixRect(start: Rect, end: Rect, progress: number): Rect {
  const eased = easeOutCubic(progress);
  return {
    left: mix(start.left, end.left, eased),
    top: mix(start.top, end.top, eased),
    width: mix(start.width, end.width, eased),
    height: mix(start.height, end.height, eased),
    radius: mix(start.radius, end.radius, eased),
  };
}

function getRevealRect(frame: number): Rect {
  const logoHoldEnd = 0.38 * FPS;
  const namePillEnd = 1.25 * FPS;
  const namePillHoldEnd = 1.72 * FPS;
  const toolbarPillEnd = 2.55 * FPS;
  const toolbarPillHoldEnd = 2.82 * FPS;
  const fullComposerEnd = 3.52 * FPS;

  if (frame < logoHoldEnd) {
    return logoRect;
  }

  if (frame < namePillEnd) {
    return mixRect(logoRect, namePillRect, (frame - logoHoldEnd) / (namePillEnd - logoHoldEnd));
  }

  if (frame < namePillHoldEnd) {
    return namePillRect;
  }

  if (frame < toolbarPillEnd) {
    return mixRect(
      namePillRect,
      toolbarPillRect,
      (frame - namePillHoldEnd) / (toolbarPillEnd - namePillHoldEnd),
    );
  }

  if (frame < toolbarPillHoldEnd) {
    return toolbarPillRect;
  }

  if (frame < fullComposerEnd) {
    return mixRect(
      toolbarPillRect,
      fullComposerRect,
      (frame - toolbarPillHoldEnd) / (fullComposerEnd - toolbarPillHoldEnd),
    );
  }

  return fullComposerRect;
}

function getScenePosition(frame: number, reveal: Rect) {
  const lockToToolbarAt = 2.55 * FPS;

  if (frame >= lockToToolbarAt) {
    return toolbarScene;
  }

  return centerSceneOn(reveal);
}

function getTypedText(frame: number) {
  const typingStart = 3.62 * FPS;
  const typingEnd = 4.72 * FPS;
  const progress = clamp((frame - typingStart) / (typingEnd - typingStart));
  const characterCount = Math.floor(progress * TEXT.length);
  return TEXT.slice(0, characterCount);
}

function getRevealShadow(frame: number) {
  const fullComposerStart = 2.82 * FPS;

  if (frame >= fullComposerStart) {
    return "none";
  }

  return [
    "0 0 28px -8px hsl(var(--shadow-ambient) / 0.14)",
    "0 16px 44px -14px hsl(var(--shadow-ambient) / 0.2)",
    "0 28px 84px -30px hsl(var(--shadow-ambient) / 0.18)",
  ].join(", ");
}

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

function ComposerFrame({ frame }: { frame: number }) {
  const reveal = getRevealRect(frame);
  const scene = getScenePosition(frame, reveal);
  const typedText = getTypedText(frame);
  const prompt = typedText.length > 0 ? typedText : " ";
  const revealLeft = scene.left + reveal.left;
  const revealTop = scene.top + reveal.top;

  return (
    <div className="render-stage">
      <div
        className="reveal-window"
        style={{
          borderRadius: snap(reveal.radius),
          boxShadow: getRevealShadow(frame),
          height: snap(reveal.height),
          left: snap(revealLeft),
          top: snap(revealTop),
          width: snap(reveal.width),
        }}
      >
        <div
          className="composer-scene"
          style={{
            left: snap(scene.left - revealLeft),
            top: snap(scene.top - revealTop),
          }}
        >
          <div className="render-shell">
            <FloatingComposer
              attachments={[]}
              composerDragging={false}
              composerHeight="min(120px, calc(100vh - 72px))"
              composerInputRef={createRef<HTMLTextAreaElement>()}
              composerOffset={{ x: 0, y: 0 }}
              composerRef={createRef<HTMLDivElement>()}
              composerShellRef={createRef<HTMLDivElement>()}
              composerStatus={null}
              composerWidth="min(640px, calc(100vw - 32px))"
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
              prompt={prompt}
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
  );
}

const style = document.createElement("style");
style.textContent = `
  html,
  body,
  #root {
    width: ${STAGE_WIDTH}px;
    height: ${STAGE_HEIGHT}px;
    margin: 0;
    overflow: hidden;
    background: transparent !important;
  }

  .parallel-ai-app,
  .render-stage {
    background: transparent !important;
  }

  .render-stage {
    position: relative;
    width: ${STAGE_WIDTH}px;
    height: ${STAGE_HEIGHT}px;
    overflow: hidden;
  }

  .reveal-window {
    position: absolute;
    overflow: hidden;
  }

  .composer-scene {
    height: ${SOURCE_HEIGHT}px;
    position: absolute;
    width: ${SOURCE_WIDTH}px;
  }

  .render-shell {
    position: absolute;
    left: ${SHADOW_PAD + 18}px;
    top: ${SHADOW_PAD + 18}px;
    width: 640px;
    height: 160px;
  }

  .render-shell .composer-shell {
    box-shadow:
      0 0 54px -30px hsl(var(--shadow-ambient) / 0.16),
      0 26px 92px -34px hsl(var(--shadow-ambient) / 0.32),
      0 46px 132px -62px hsl(var(--shadow-ambient) / 0.24) !important;
  }

  .render-shell .composer-shell-bottom-bar {
    box-shadow: 0 -10px 34px -32px hsl(var(--shadow-ambient) / 0.22) !important;
  }
`;
document.head.append(style);

const initialFrame = Number(new URLSearchParams(window.location.search).get("frame") ?? 0);
const root = createRoot(document.getElementById("root")!);

function renderFrame(frame: number) {
  flushSync(() => {
    root.render(<ComposerFrame frame={frame} />);
  });
}

window.setPromoComposerFrame = renderFrame;
window.__renderFrame = renderFrame;
renderFrame(initialFrame);
