import {
  ArrowDown,
  ArrowUp,
  ArrowsUpFromLine,
  Eraser,
  LayoutGrid,
  MessageSquare,
  MessageSquareDashed,
  MessageSquarePlus,
  Notebook,
  Plus,
  Settings,
  X,
} from "lucide-react";
import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useEffect, useState } from "react";

import type { ComposerResizeEdge, QueuedFile } from "@/multi-panel/types";

const COMPOSER_BOTTOM_ICON_BASE_CLASS =
  "inline-flex h-8 w-8 flex-none items-center justify-center rounded-full p-0 leading-none transition-colors duration-200 focus-visible:outline-none";
const COMPOSER_BOTTOM_ICON_BUTTON_CLASS = `${COMPOSER_BOTTOM_ICON_BASE_CLASS} bg-transparent text-[hsl(var(--foreground-soft))] ring-1 ring-transparent hover:bg-[#424242] hover:text-white hover:ring-white/10`;
const COMPOSER_BOTTOM_ICON_ACTIVE_CLASS = `${COMPOSER_BOTTOM_ICON_BASE_CLASS} bg-[#424242] text-[hsl(var(--foreground))] ring-1 ring-white/10 hover:bg-[#4a4a4a] hover:ring-white/14`;
const COMPOSER_PLACEHOLDER_TEXT = "Ask anything everywhere...";
const COMPOSER_PLACEHOLDER_TYPE_DELAY_MS = 100;
const COMPOSER_PLACEHOLDER_START_DELAY_MS = 240;

function runtimeAsset(path: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }

  return `/${path}`;
}

interface FloatingComposerProps {
  attachments: QueuedFile[];
  composerDragging: boolean;
  composerHeight: string;
  composerInputRef: RefObject<HTMLTextAreaElement>;
  composerOffset: { x: number; y: number };
  composerRef: RefObject<HTMLDivElement>;
  composerShellRef: RefObject<HTMLDivElement>;
  composerStatus: string | null;
  composerWidth: string;
  hasDraftContent: boolean;
  prompt: string;
  promptLibraryOpen: boolean;
  scrollSyncEnabled: boolean;
  stopGenerationActive: boolean;
  temporaryChatEnabled: boolean;
  onAddPanel: () => void;
  onBeginComposerDragFromHeader: (event: ReactPointerEvent<HTMLElement>) => void;
  onBeginComposerResize: (
    edge: ComposerResizeEdge,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onClearPanels: () => void;
  onDispatchPrompt: (promptOverride?: string, autoSubmit?: boolean) => void | Promise<void>;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFilesSelected: (fileList: FileList | null) => void | Promise<void>;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenLayoutModal: () => void;
  onOpenNewChats: () => void;
  onOpenPromptLibrary: () => void;
  onOpenSettings: () => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onPromptChange: (value: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onResetComposerPosition: () => void;
  onResetComposerSize: () => void;
  onStopGeneration: () => void;
  onToggleScrollSync: () => void;
  onToggleTemporaryChat: () => void;
}

export function FloatingComposer({
  attachments,
  composerDragging,
  composerHeight,
  composerInputRef,
  composerOffset,
  composerRef,
  composerShellRef,
  composerStatus,
  composerWidth,
  hasDraftContent,
  prompt,
  promptLibraryOpen,
  scrollSyncEnabled,
  stopGenerationActive,
  temporaryChatEnabled,
  onAddPanel,
  onBeginComposerDragFromHeader,
  onBeginComposerResize,
  onClearPanels,
  onDispatchPrompt,
  onDrop,
  onFilesSelected,
  onKeyDown,
  onOpenLayoutModal,
  onOpenNewChats,
  onOpenPromptLibrary,
  onOpenSettings,
  onPaste,
  onPromptChange,
  onRemoveAttachment,
  onResetComposerPosition,
  onResetComposerSize,
  onStopGeneration,
  onToggleScrollSync,
  onToggleTemporaryChat,
}: FloatingComposerProps) {
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");

  function isComposerBarControlTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(target.closest("button, input, textarea, select, label, a, [role='button']"))
    );
  }

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setAnimatedPlaceholder(COMPOSER_PLACEHOLDER_TEXT);
      return;
    }

    let nextCharacterIndex = 0;
    let timeoutId: number | undefined;

    const typeNextCharacter = () => {
      nextCharacterIndex += 1;
      setAnimatedPlaceholder(COMPOSER_PLACEHOLDER_TEXT.slice(0, nextCharacterIndex));

      if (nextCharacterIndex < COMPOSER_PLACEHOLDER_TEXT.length) {
        timeoutId = window.setTimeout(typeNextCharacter, COMPOSER_PLACEHOLDER_TYPE_DELAY_MS);
      }
    };

    timeoutId = window.setTimeout(typeNextCharacter, COMPOSER_PLACEHOLDER_START_DELAY_MS);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div
      className="absolute bottom-5 left-1/2 flex flex-col items-center gap-2"
      ref={composerShellRef}
      style={{
        transform: `translate(calc(-50% + ${composerOffset.x}px), ${composerOffset.y}px)`,
        width: composerWidth,
      }}
    >
      {composerStatus ? (
        <div className="rounded-full bg-black/35 px-3 py-1 text-xs text-[hsl(var(--foreground-soft))] backdrop-blur-md">
          {composerStatus}
        </div>
      ) : null}

      <div className="relative w-full">
        <div
          className="pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-[30px] shadow-[0_24px_80px_-42px_rgba(0,0,0,0.9)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          ref={composerRef}
          style={{
            backdropFilter: "blur(2px)",
            background:
              "linear-gradient(180deg, rgba(45,45,45,0.15) 0%, rgba(45,45,45,0.50) 50%, #2d2d2d 100%)",
            height: composerHeight,
          }}
        >
          {/* <div
            className={`relative flex items-center justify-between gap-3 px-3 pb-0.5 pt-1.5 select-none ${composerDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            onPointerDown={onBeginComposerDragFromHeader}
          >
            <div aria-hidden="true" />
            <div aria-hidden="true" />
          </div> */}

          {attachments.length ? (
            <div className="flex flex-wrap gap-2 px-3 pb-0.5 pt-2" data-composer-attachments>
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-[hsl(var(--foreground-soft))]"
                >
                  <span className="max-w-[220px] truncate">{attachment.name}</span>
                  <button
                    aria-label={`Remove ${attachment.name}`}
                    className="rounded-full p-0.5 text-[hsl(var(--foreground-muted))] transition hover:bg-white/8 hover:text-white"
                    data-tooltip={`Remove ${attachment.name}`}
                    onClick={() => onRemoveAttachment(attachment.id)}
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <textarea
            autoFocus
            className="composer-textarea-scrollbar mr-3 mt-2.5 min-h-0 flex-1 resize-none overflow-hidden bg-transparent px-6 pt-2.5 pb-4 text-base text-white outline-none placeholder:text-[hsl(var(--foreground-muted))]"
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={prompt ? COMPOSER_PLACEHOLDER_TEXT : animatedPlaceholder}
            ref={composerInputRef}
            value={prompt}
          />

          <div
            className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-t-[30px] bg-[#2d2d2d] px-3.5 py-3.5 shadow-[0_-18px_42px_-34px_rgba(0,0,0,0.9)] select-none ${composerDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            data-tooltip="Drag to reposition. Double-click to reset position."
            data-tooltip-placement="bottom"
            onDoubleClick={(event) => {
              if (isComposerBarControlTarget(event.target)) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              onResetComposerPosition();
            }}
            onPointerDown={onBeginComposerDragFromHeader}
          >
            <div className="flex min-w-0 items-center gap-3 pr-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <img
                  alt="PARALLEL AI"
                  className="h-8 w-8"
                  src={runtimeAsset("graphics/app-icon.png")}
                />
              </div>
              <span className="hidden truncate text-xs font-medium uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))] sm:inline">
                PARALLEL AI
              </span>
            </div>

            <div className="flex items-center justify-center gap-1">
              <button
                aria-label="Open settings"
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip="Settings"
                data-tooltip-placement="bottom"
                onClick={onOpenSettings}
                type="button"
              >
                <Settings size={15} />
              </button>
              <button
                aria-label="Open layout picker"
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip="Layout"
                data-tooltip-placement="bottom"
                onClick={onOpenLayoutModal}
                type="button"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                aria-label="Open prompt library"
                className={
                  promptLibraryOpen
                    ? COMPOSER_BOTTOM_ICON_ACTIVE_CLASS
                    : COMPOSER_BOTTOM_ICON_BUTTON_CLASS
                }
                data-tooltip="Prompt library"
                data-tooltip-placement="bottom"
                onClick={onOpenPromptLibrary}
                type="button"
              >
                <Notebook size={15} />
              </button>
              <button
                aria-label="New chats"
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip="New chats"
                data-tooltip-placement="bottom"
                onClick={onOpenNewChats}
                type="button"
              >
                <MessageSquare size={15} />
              </button>
              <button
                aria-label={temporaryChatEnabled ? "Disable temporary chats" : "Enable temporary chats"}
                className={
                  temporaryChatEnabled
                    ? COMPOSER_BOTTOM_ICON_ACTIVE_CLASS
                    : COMPOSER_BOTTOM_ICON_BUTTON_CLASS
                }
                data-tooltip={temporaryChatEnabled ? "Disable temporary chats" : "Temporary chats"}
                data-tooltip-placement="bottom"
                onClick={onToggleTemporaryChat}
                type="button"
              >
                <MessageSquareDashed size={15} />
              </button>
              <button
                aria-label="Add pane"
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip="Add pane"
                data-tooltip-placement="bottom"
                onClick={onAddPanel}
                type="button"
              >
                <MessageSquarePlus size={15} />
              </button>
              <button
                aria-label={scrollSyncEnabled ? "Disable scroll sync" : "Enable scroll sync"}
                className={
                  scrollSyncEnabled
                    ? COMPOSER_BOTTOM_ICON_ACTIVE_CLASS
                    : COMPOSER_BOTTOM_ICON_BUTTON_CLASS
                }
                data-tooltip={scrollSyncEnabled ? "Disable scroll sync" : "Enable scroll sync"}
                data-tooltip-placement="bottom"
                onClick={onToggleScrollSync}
                type="button"
              >
                <ArrowsUpFromLine className="rotate-180" size={15} />
              </button>
            </div>

            <div className="flex justify-end gap-2">
              {hasDraftContent ? (
                <button
                  aria-label="Clear all"
                  className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                  data-tooltip="Clear all"
                  data-tooltip-placement="bottom"
                  onClick={onClearPanels}
                  type="button"
                >
                  <Eraser size={14} />
                </button>
              ) : null}

              <label
                className={`${COMPOSER_BOTTOM_ICON_BUTTON_CLASS} cursor-pointer`}
                data-tooltip="Attach files"
                data-tooltip-placement="bottom"
              >
                <input
                  accept="image/*,application/pdf,text/plain,.txt,.md,.csv,.json"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    void onFilesSelected(event.target.files);
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
                <span className="pointer-events-none inline-flex h-full w-full items-center justify-center">
                  <Plus size={16} />
                </span>
              </label>

              <button
                aria-label="Fill all"
                className={COMPOSER_BOTTOM_ICON_ACTIVE_CLASS}
                data-tooltip="Fill all"
                data-tooltip-placement="bottom"
                onClick={() => void onDispatchPrompt(undefined, false)}
                type="button"
              >
                <ArrowDown size={16} strokeWidth={2.2} />
              </button>

              <button
                aria-label={stopGenerationActive ? "Stop all" : "Send all"}
                className={`${COMPOSER_BOTTOM_ICON_BASE_CLASS} bg-white text-[hsl(var(--background))] shadow-[0_10px_24px_-18px_rgba(255,255,255,0.88)] transition-transform hover:scale-[1.02]`}
                data-tooltip={stopGenerationActive ? "Stop all (Esc)" : "Send all"}
                data-tooltip-placement="bottom"
                onClick={() =>
                  stopGenerationActive ? onStopGeneration() : void onDispatchPrompt(undefined, true)
                }
                type="button"
              >
                {stopGenerationActive ? (
                  <span className="h-3 w-3 rounded-[3px] bg-current" />
                ) : (
                  <ArrowUp size={16} strokeWidth={2.2} />
                )}
              </button>
            </div>
          </div>

        </div>

        <button
          aria-label="Resize composer from top edge"
          className="pointer-events-auto absolute left-4 right-4 top-0 z-10 h-5 -translate-y-1/2 cursor-ns-resize bg-transparent"
          data-tooltip="Drag to resize composer. Double-click to reset size."
          onDoubleClick={onResetComposerSize}
          onPointerDown={(event) => onBeginComposerResize("top", event)}
          style={{ cursor: "ns-resize" }}
          type="button"
        />
        <button
          aria-label="Resize composer from right edge"
          className="pointer-events-auto absolute bottom-4 right-0 top-4 z-10 w-5 translate-x-1/2 cursor-ew-resize bg-transparent"
          data-tooltip="Drag to resize composer. Double-click to reset size."
          onDoubleClick={onResetComposerSize}
          onPointerDown={(event) => onBeginComposerResize("right", event)}
          style={{ cursor: "ew-resize" }}
          type="button"
        />
        <button
          aria-label="Resize composer from bottom edge"
          className="pointer-events-auto absolute bottom-0 left-4 right-4 z-10 h-5 translate-y-1/2 cursor-ns-resize bg-transparent"
          data-tooltip="Drag to resize composer. Double-click to reset size."
          onDoubleClick={onResetComposerSize}
          onPointerDown={(event) => onBeginComposerResize("bottom", event)}
          style={{ cursor: "ns-resize" }}
          type="button"
        />
        <button
          aria-label="Resize composer from left edge"
          className="pointer-events-auto absolute bottom-4 left-0 top-4 z-10 w-5 -translate-x-1/2 cursor-ew-resize bg-transparent"
          data-tooltip="Drag to resize composer. Double-click to reset size."
          onDoubleClick={onResetComposerSize}
          onPointerDown={(event) => onBeginComposerResize("left", event)}
          style={{ cursor: "ew-resize" }}
          type="button"
        />
      </div>
    </div>
  );
}
