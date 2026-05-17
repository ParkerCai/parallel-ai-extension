import {
  ArrowDown,
  ArrowUp,
  ArrowsUpFromLine,
  Eraser,
  LayoutGrid,
  Maximize,
  MessageSquare,
  MessageSquareDashed,
  MessageSquarePlus,
  Minimize,
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
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/multi-panel/components/BrandMark";
import { HighlightedComposerInput } from "@/multi-panel/components/HighlightedComposerInput";
import { PromptQuickPickPopover } from "@/multi-panel/components/PromptQuickPickPopover";
import { usePopupMode } from "@/multi-panel/hooks/usePopupMode";
import { useTranslation } from "@/shared/contexts/I18nContext";
import type { ComposerResizeEdge, QueuedFile } from "@/multi-panel/types";
import type { PromptRecord } from "@/shared/lib/prompt-manager";

const COMPOSER_BOTTOM_ICON_BASE_CLASS =
  "inline-flex h-8 w-8 flex-none items-center justify-center rounded-full p-0 leading-none transition-colors duration-200 focus-visible:outline-none";
const COMPOSER_BOTTOM_ICON_BUTTON_CLASS = `${COMPOSER_BOTTOM_ICON_BASE_CLASS} bg-transparent text-[hsl(var(--foreground-soft))] ring-1 ring-transparent hover:bg-[hsl(var(--surface-popover))] hover:text-[hsl(var(--foreground))] hover:ring-[hsl(var(--tint-ring)/0.10)]`;
const COMPOSER_BOTTOM_ICON_ACTIVE_CLASS = `${COMPOSER_BOTTOM_ICON_BASE_CLASS} bg-[hsl(var(--surface-popover))] text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--tint-ring)/0.10)] hover:bg-[hsl(var(--surface-popover-hover))] hover:ring-[hsl(var(--tint-ring)/0.14)]`;
const COMPOSER_PLACEHOLDER_TYPE_DELAY_MS = 100;
const COMPOSER_PLACEHOLDER_START_DELAY_MS = 240;

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
  promptQuickPickFavorites: PromptRecord[];
  promptQuickPickOpen: boolean;
  promptQuickPickRecents: PromptRecord[];
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
  onClosePromptQuickPick: () => void;
  onOpenLayoutModal: () => void;
  onOpenNewChats: () => void;
  onOpenPromptLibrary: () => void;
  onOpenPromptQuickPick: () => void;
  onOpenSettings: () => void;
  onQuickInsertPrompt: (prompt: PromptRecord) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onPromptChange: (value: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onResetComposerHeight: () => void;
  onResetComposerPosition: () => void;
  onResetComposerWidth: () => void;
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
  promptQuickPickFavorites,
  promptQuickPickOpen,
  promptQuickPickRecents,
  scrollSyncEnabled,
  stopGenerationActive,
  temporaryChatEnabled,
  onAddPanel,
  onBeginComposerDragFromHeader,
  onBeginComposerResize,
  onClearPanels,
  onClosePromptQuickPick,
  onDispatchPrompt,
  onDrop,
  onFilesSelected,
  onKeyDown,
  onOpenLayoutModal,
  onOpenNewChats,
  onOpenPromptLibrary,
  onOpenPromptQuickPick,
  onOpenSettings,
  onPaste,
  onPromptChange,
  onQuickInsertPrompt,
  onRemoveAttachment,
  onResetComposerHeight,
  onResetComposerPosition,
  onResetComposerWidth,
  onStopGeneration,
  onToggleScrollSync,
  onToggleTemporaryChat,
}: FloatingComposerProps) {
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const promptLibraryButtonRef = useRef<HTMLButtonElement | null>(null);
  const { isPopupMode, togglePopupMode } = usePopupMode();
  const { t } = useTranslation();
  const placeholderText = t("composerPlaceholder", "Ask anything everywhere...");

  function isComposerBarControlTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(target.closest("button, input, textarea, select, label, a, [role='button']"))
    );
  }

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setAnimatedPlaceholder(placeholderText);
      return;
    }

    let nextCharacterIndex = 0;
    let timeoutId: number | undefined;

    const typeNextCharacter = () => {
      nextCharacterIndex += 1;
      setAnimatedPlaceholder(placeholderText.slice(0, nextCharacterIndex));

      if (nextCharacterIndex < placeholderText.length) {
        timeoutId = window.setTimeout(typeNextCharacter, COMPOSER_PLACEHOLDER_TYPE_DELAY_MS);
      }
    };

    timeoutId = window.setTimeout(typeNextCharacter, COMPOSER_PLACEHOLDER_START_DELAY_MS);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [placeholderText]);

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
        <div className="rounded-full bg-[hsl(var(--shadow-ambient)/0.35)] px-3 py-1 text-xs text-[hsl(var(--foreground-soft))] backdrop-blur-md">
          {composerStatus}
        </div>
      ) : null}

      <div className="relative w-full">
        <div
          className="composer-shell pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-[30px] shadow-[0_24px_80px_-42px_hsl(var(--shadow-ambient)/0.9)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          ref={composerRef}
          style={{
            backdropFilter: "blur(8px)",
            height: composerHeight,
          }}
        >

          {attachments.length ? (
            <div className="flex flex-wrap gap-2 px-3 pb-0.5 pt-2" data-composer-attachments>
              {attachments.map((attachment) => {
                const isImage = attachment.type.startsWith("image/");
                const removeLabel = t("composerAttachmentRemove", "Remove $1", attachment.name);
                if (isImage) {
                  return (
                    <div
                      key={attachment.id}
                      className="group/attachment relative h-16 w-16 overflow-hidden rounded-xl border border-[hsl(var(--tint-base)/0.10)] bg-[hsl(var(--tint-base)/0.06)]"
                    >
                      <img
                        alt={attachment.name}
                        className="h-full w-full object-cover"
                        src={attachment.dataUrl}
                      />
                      <button
                        aria-label={removeLabel}
                        className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--shadow-ambient)/0.65)] text-white opacity-0 transition group-hover/attachment:opacity-100 hover:bg-[hsl(var(--shadow-ambient)/0.85)] focus-visible:opacity-100"
                        data-tooltip={removeLabel}
                        onClick={() => onRemoveAttachment(attachment.id)}
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-full border border-[hsl(var(--tint-base)/0.10)] bg-[hsl(var(--tint-base)/0.06)] px-3 py-1.5 text-sm text-[hsl(var(--foreground-soft))]"
                  >
                    <span className="max-w-55 truncate">{attachment.name}</span>
                    <button
                      aria-label={removeLabel}
                      className="rounded-full p-0.5 text-[hsl(var(--foreground-muted))] transition hover:bg-[hsl(var(--tint-base)/0.08)] hover:text-[hsl(var(--foreground))]"
                      data-tooltip={removeLabel}
                      onClick={() => onRemoveAttachment(attachment.id)}
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <HighlightedComposerInput
            onChange={onPromptChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={prompt ? placeholderText : animatedPlaceholder}
            textareaRef={composerInputRef}
            value={prompt}
          />

          <div
            className={`composer-shell-bottom-bar grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-t-[30px] px-3.5 py-3.5 shadow-[0_-18px_42px_-34px_hsl(var(--shadow-ambient)/0.9)] select-none ${composerDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            data-tooltip={t("composerBarDragHint", "Drag to reposition. Double-click to reset position.")}
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
                <BrandMark size={32} />
              </div>
              <span className="hidden truncate text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--foreground-soft))] sm:inline">
                PARALLEL AI
              </span>
            </div>

            <div className="flex items-center justify-center gap-1">
              {isPopupMode !== null ? (
                <button
                  aria-label={
                    isPopupMode
                      ? t("composerAriaSwitchToTabMode", "Switch to tab mode")
                      : t("composerAriaSwitchToPopupMode", "Switch to popup mode")
                  }
                  className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                  data-tooltip={
                    isPopupMode
                      ? t("composerTooltipTabMode", "Tab mode")
                      : t("composerTooltipPopupMode", "Popup mode")
                  }
                  data-tooltip-placement="bottom"
                  onClick={() => void togglePopupMode()}
                  type="button"
                >
                  {isPopupMode ? <Minimize size={15} /> : <Maximize size={15} />}
                </button>
              ) : null}
              <button
                aria-label={t("composerAriaOpenSettings", "Open settings")}
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip={t("composerTooltipSettings", "Settings")}
                data-tooltip-placement="bottom"
                onClick={onOpenSettings}
                type="button"
              >
                <Settings size={15} />
              </button>
              <button
                aria-label={t("composerAriaOpenLayout", "Open layout picker")}
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip={t("composerTooltipLayout", "Layout")}
                data-tooltip-placement="bottom"
                onClick={onOpenLayoutModal}
                type="button"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                aria-label={t("composerAriaOpenPromptLibrary", "Open prompt library")}
                className={
                  promptLibraryOpen || promptQuickPickOpen
                    ? COMPOSER_BOTTOM_ICON_ACTIVE_CLASS
                    : COMPOSER_BOTTOM_ICON_BUTTON_CLASS
                }
                data-tooltip={t("composerTooltipPromptLibrary", "Prompt library")}
                data-tooltip-placement="bottom"
                onClick={() => {
                  if (promptQuickPickOpen) {
                    onClosePromptQuickPick();
                  } else {
                    onOpenPromptQuickPick();
                  }
                }}
                ref={promptLibraryButtonRef}
                type="button"
              >
                <Notebook size={15} />
              </button>
              <button
                aria-label={t("composerAriaNewChats", "New chats")}
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip={t("composerTooltipNewChats", "New chats")}
                data-tooltip-placement="bottom"
                onClick={onOpenNewChats}
                type="button"
              >
                <MessageSquare size={15} />
              </button>
              <button
                aria-label={
                  temporaryChatEnabled
                    ? t("composerAriaDisableTemporaryChats", "Disable temporary chats")
                    : t("composerAriaEnableTemporaryChats", "Enable temporary chats")
                }
                className={
                  temporaryChatEnabled
                    ? COMPOSER_BOTTOM_ICON_ACTIVE_CLASS
                    : COMPOSER_BOTTOM_ICON_BUTTON_CLASS
                }
                data-tooltip={
                  temporaryChatEnabled
                    ? t("composerAriaDisableTemporaryChats", "Disable temporary chats")
                    : t("composerTooltipTemporaryChats", "Temporary chats")
                }
                data-tooltip-placement="bottom"
                onClick={onToggleTemporaryChat}
                type="button"
              >
                <MessageSquareDashed size={15} />
              </button>
              <button
                aria-label={t("composerAriaAddPane", "Add pane")}
                className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                data-tooltip={t("composerTooltipAddPane", "Add pane")}
                data-tooltip-placement="bottom"
                onClick={onAddPanel}
                type="button"
              >
                <MessageSquarePlus size={15} />
              </button>
              <button
                aria-label={
                  scrollSyncEnabled
                    ? t("composerAriaDisableScrollSync", "Disable scroll sync")
                    : t("composerAriaEnableScrollSync", "Enable scroll sync")
                }
                className={
                  scrollSyncEnabled
                    ? COMPOSER_BOTTOM_ICON_ACTIVE_CLASS
                    : COMPOSER_BOTTOM_ICON_BUTTON_CLASS
                }
                data-tooltip={
                  scrollSyncEnabled
                    ? t("composerAriaDisableScrollSync", "Disable scroll sync")
                    : t("composerAriaEnableScrollSync", "Enable scroll sync")
                }
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
                  aria-label={t("composerAriaClearAll", "Clear all")}
                  className={COMPOSER_BOTTOM_ICON_BUTTON_CLASS}
                  data-tooltip={t("composerTooltipClearAll", "Clear all")}
                  data-tooltip-placement="bottom"
                  onClick={onClearPanels}
                  type="button"
                >
                  <Eraser size={14} />
                </button>
              ) : null}

              <label
                className={`${COMPOSER_BOTTOM_ICON_BUTTON_CLASS} cursor-pointer`}
                data-tooltip={t("composerTooltipAttachFiles", "Attach files")}
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
                aria-label={t("composerAriaFillAll", "Fill all")}
                className={COMPOSER_BOTTOM_ICON_ACTIVE_CLASS}
                data-tooltip={t("composerTooltipFillAll", "Fill all")}
                data-tooltip-placement="bottom"
                onClick={() => void onDispatchPrompt(undefined, false)}
                type="button"
              >
                <ArrowDown size={16} strokeWidth={2.2} />
              </button>

              <button
                aria-label={
                  stopGenerationActive
                    ? t("composerAriaStopAll", "Stop all")
                    : t("composerAriaSendAll", "Send all")
                }
                className={`${COMPOSER_BOTTOM_ICON_BASE_CLASS} bg-[hsl(var(--accent-strong))] text-[hsl(var(--foreground-on-accent))] shadow-[0_10px_24px_-18px_hsl(var(--accent-strong)/0.88)] transition-transform hover:scale-[1.02]`}
                data-tooltip={
                  stopGenerationActive
                    ? t("composerTooltipStopAllEsc", "Stop all (Esc)")
                    : t("composerAriaSendAll", "Send all")
                }
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

        <PromptQuickPickPopover
          anchorRef={promptLibraryButtonRef}
          favorites={promptQuickPickFavorites}
          onClose={onClosePromptQuickPick}
          onOpenLibrary={() => {
            onClosePromptQuickPick();
            onOpenPromptLibrary();
          }}
          onSelect={onQuickInsertPrompt}
          open={promptQuickPickOpen}
          recents={promptQuickPickRecents}
        />

        <button
          aria-label={t("composerAriaResizeTop", "Resize composer from top edge")}
          className="pointer-events-auto absolute left-4 right-4 top-0 z-10 h-5 -translate-y-1/2 cursor-ns-resize bg-transparent"
          data-tooltip={t("composerTooltipResizeHeight", "Drag to resize height. Double-click to fit content.")}
          onDoubleClick={onResetComposerHeight}
          onPointerDown={(event) => onBeginComposerResize("top", event)}
          style={{ cursor: "ns-resize" }}
          type="button"
        />
        <button
          aria-label={t("composerAriaResizeRight", "Resize composer from right edge")}
          className="pointer-events-auto absolute bottom-4 right-0 top-4 z-10 w-5 translate-x-1/2 cursor-ew-resize bg-transparent"
          data-tooltip={t("composerTooltipResizeWidth", "Drag to resize width. Double-click to reset width.")}
          onDoubleClick={onResetComposerWidth}
          onPointerDown={(event) => onBeginComposerResize("right", event)}
          style={{ cursor: "ew-resize" }}
          type="button"
        />
        <button
          aria-label={t("composerAriaResizeBottom", "Resize composer from bottom edge")}
          className="pointer-events-auto absolute bottom-0 left-4 right-4 z-10 h-5 translate-y-1/2 cursor-ns-resize bg-transparent"
          data-tooltip={t("composerTooltipResizeHeight", "Drag to resize height. Double-click to fit content.")}
          onDoubleClick={onResetComposerHeight}
          onPointerDown={(event) => onBeginComposerResize("bottom", event)}
          style={{ cursor: "ns-resize" }}
          type="button"
        />
        <button
          aria-label={t("composerAriaResizeLeft", "Resize composer from left edge")}
          className="pointer-events-auto absolute bottom-4 left-0 top-4 z-10 w-5 -translate-x-1/2 cursor-ew-resize bg-transparent"
          data-tooltip={t("composerTooltipResizeWidth", "Drag to resize width. Double-click to reset width.")}
          onDoubleClick={onResetComposerWidth}
          onPointerDown={(event) => onBeginComposerResize("left", event)}
          style={{ cursor: "ew-resize" }}
          type="button"
        />
      </div>
    </div>
  );
}
