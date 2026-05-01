import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { clamp } from "@/multi-panel/lib/math";
import {
  DEFAULT_COMPOSER_OFFSET,
  DEFAULT_COMPOSER_SIZE,
  type ComposerSize,
  type ExtensionSettings,
} from "@/shared/lib/settings";
import type { ComposerResizeEdge } from "@/multi-panel/types";

const COMPOSER_MIN_WIDTH_PX = 600;
const COMPOSER_MIN_HEIGHT_PX = DEFAULT_COMPOSER_SIZE.height;

interface UseComposerFrameControllerOptions {
  attachmentCount: number;
  isHydrated: boolean;
  prompt: string;
  settings: ExtensionSettings;
  showStatus: (message: string) => void;
  updateSetting: <Key extends keyof ExtensionSettings>(
    key: Key,
    value: ExtensionSettings[Key],
  ) => Promise<void>;
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>;
}

export function useComposerFrameController({
  attachmentCount,
  isHydrated,
  prompt,
  settings,
  showStatus,
  updateSetting,
  updateSettings,
}: UseComposerFrameControllerOptions) {
  const [composerOffset, setComposerOffset] = useState(settings.composerOffset);
  const [composerSize, setComposerSize] = useState(settings.composerSize);
  const [composerContentHeight, setComposerContentHeight] = useState(settings.composerSize.height);
  const [composerDragging, setComposerDragging] = useState(false);
  const [composerResizing, setComposerResizing] = useState(false);

  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const composerOffsetRef = useRef(settings.composerOffset);
  const composerSizeRef = useRef(settings.composerSize);
  const composerContentHeightRef = useRef(settings.composerSize.height);
  const composerOffsetStateRafRef = useRef<number | null>(null);
  const composerDragRef = useRef<{
    handle: HTMLElement;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const composerResizeRef = useRef<{
    edge: ComposerResizeEdge;
    handle: HTMLElement;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  function hydrateComposerFrame() {
    const hydratedComposerSize = clampComposerSize(
      settings.composerSize.width,
      settings.composerSize.height,
    );
    const hydratedOffset = clampComposerOffset(
      settings.composerOffset.x,
      settings.composerOffset.y,
      hydratedComposerSize,
    );
    setComposerOffset(hydratedOffset);
    setComposerSize(hydratedComposerSize);
    setComposerContentHeight(hydratedComposerSize.height);
    composerOffsetRef.current = hydratedOffset;
    composerSizeRef.current = hydratedComposerSize;
    composerContentHeightRef.current = hydratedComposerSize.height;
  }

  function focusComposerInput(delay = 0) {
    return window.setTimeout(() => {
      const input = composerInputRef.current;
      if (!input || input.matches(":disabled")) {
        return;
      }

      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    }, delay);
  }

  function clampComposerSize(nextWidth: number, nextHeight: number): ComposerSize {
    const horizontalMargin = 16;
    const verticalMargin = 20;
    const maxWidth = Math.max(0, window.innerWidth - horizontalMargin * 2);
    const minWidth = Math.min(COMPOSER_MIN_WIDTH_PX, maxWidth || COMPOSER_MIN_WIDTH_PX);
    const maxHeight = Math.max(0, window.innerHeight - verticalMargin * 2 - 32);
    const minHeight = Math.min(COMPOSER_MIN_HEIGHT_PX, maxHeight || COMPOSER_MIN_HEIGHT_PX);

    return {
      width: Math.min(maxWidth, Math.max(minWidth, nextWidth)),
      height: Math.min(maxHeight, Math.max(minHeight, nextHeight)),
    };
  }

  function getComposerWidthStyle(width: number) {
    return `min(${width}px, calc(100vw - 32px))`;
  }

  function getComposerHeightStyle(height: number) {
    return `min(${height}px, calc(100vh - 72px))`;
  }

  function measureComposerInputHeight(input: HTMLTextAreaElement) {
    const previousFlex = input.style.flex;
    const previousHeight = input.style.height;
    const previousOverflowY = input.style.overflowY;

    input.style.flex = "0 0 auto";
    input.style.height = "0px";
    input.style.overflowY = "hidden";
    const measuredHeight = input.scrollHeight;
    input.style.flex = previousFlex;
    input.style.height = previousHeight;
    input.style.overflowY = previousOverflowY;

    return measuredHeight;
  }

  function updateComposerContentHeight() {
    const composerElement = composerRef.current;
    const input = composerInputRef.current;

    if (!composerElement || !input) {
      return;
    }

    const currentComposerHeight = composerElement.offsetHeight || composerSizeRef.current.height;
    const attachmentElement = composerElement.querySelector<HTMLElement>(
      "[data-composer-attachments]",
    );
    const attachmentReservedHeight = attachmentElement?.offsetHeight ?? 0;
    const fixedChromeHeight = Math.max(0, currentComposerHeight - input.clientHeight);
    const requestedHeight = fixedChromeHeight + measureComposerInputHeight(input);
    const requestedHeightWithReservedAttachments = Math.max(
      requestedHeight,
      composerSizeRef.current.height + attachmentReservedHeight,
    );
    const maxHeight = clampComposerSize(composerSizeRef.current.width, Number.MAX_SAFE_INTEGER).height;
    const nextHeight = clampComposerSize(
      composerSizeRef.current.width,
      requestedHeightWithReservedAttachments,
    ).height;
    const hasRoomForContent = requestedHeightWithReservedAttachments <= maxHeight;

    input.style.overflowY = hasRoomForContent ? "hidden" : "auto";

    if (hasRoomForContent) {
      input.scrollTop = 0;
    }

    composerContentHeightRef.current = nextHeight;
    setComposerContentHeight((currentHeight) =>
      Math.abs(currentHeight - nextHeight) < 1 ? currentHeight : nextHeight,
    );
  }

  function paintComposerFrame(offset: { x: number; y: number }, size: ComposerSize) {
    if (composerShellRef.current) {
      composerShellRef.current.style.transform = `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`;
      composerShellRef.current.style.width = getComposerWidthStyle(size.width);
    }

    if (composerRef.current) {
      composerRef.current.style.height = getComposerHeightStyle(size.height);
    }
  }

  function scheduleComposerOffsetStateSync() {
    if (composerOffsetStateRafRef.current !== null) {
      return;
    }

    composerOffsetStateRafRef.current = window.requestAnimationFrame(() => {
      composerOffsetStateRafRef.current = null;
      setComposerOffset(composerOffsetRef.current);
    });
  }

  function cancelComposerOffsetStateSync() {
    if (composerOffsetStateRafRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(composerOffsetStateRafRef.current);
    composerOffsetStateRafRef.current = null;
  }

  function clampComposerOffset(nextX: number, nextY: number, sizeOverride?: ComposerSize) {
    const effectiveComposerHeight =
      sizeOverride?.height ??
      Math.max(composerSizeRef.current.height, composerContentHeightRef.current);
    const nextSize = clampComposerSize(
      sizeOverride?.width ?? composerSizeRef.current.width,
      effectiveComposerHeight,
    );
    const composerWidth = Math.min(nextSize.width, window.innerWidth - 32);
    const composerHeight = Math.min(nextSize.height, window.innerHeight - 72);
    const horizontalMargin = 16;
    const verticalMargin = 20;

    const maxX = Math.max(0, (window.innerWidth - composerWidth) / 2 - horizontalMargin);
    const minY = -Math.max(0, window.innerHeight - composerHeight - verticalMargin * 2);
    const maxY = 0;

    return {
      x: Math.min(maxX, Math.max(-maxX, nextX)),
      y: Math.min(maxY, Math.max(minY, nextY)),
    };
  }

  function handleComposerPointerMove(event: PointerEvent) {
    if (!composerDragRef.current || composerDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if ((event.buttons & 1) !== 1) {
      finishComposerDrag(true);
      return;
    }

    const nextOffset = clampComposerOffset(
      composerDragRef.current.startOffsetX + (event.clientX - composerDragRef.current.startClientX),
      composerDragRef.current.startOffsetY + (event.clientY - composerDragRef.current.startClientY),
    );

    composerOffsetRef.current = nextOffset;
    paintComposerFrame(nextOffset, composerSizeRef.current);
    scheduleComposerOffsetStateSync();
  }

  function finishComposerDrag(persist: boolean) {
    const activeDrag = composerDragRef.current;
    if (!activeDrag) {
      return;
    }

    composerDragRef.current = null;
    cancelComposerOffsetStateSync();
    activeDrag.handle.removeEventListener("lostpointercapture", handleComposerLostPointerCapture);
    if (activeDrag.handle.hasPointerCapture?.(activeDrag.pointerId)) {
      try {
        activeDrag.handle.releasePointerCapture(activeDrag.pointerId);
      } catch {
        // The browser may have already released capture after a fast pointerup.
      }
    }

    setComposerOffset(composerOffsetRef.current);
    setComposerDragging(false);
    window.removeEventListener("pointermove", handleComposerPointerMove);
    window.removeEventListener("pointerup", handleComposerPointerUp);
    window.removeEventListener("pointercancel", handleComposerPointerUp);
    window.removeEventListener("mouseup", handleComposerMouseUp);
    window.removeEventListener("blur", handleComposerDragCancel);

    if (persist) {
      void updateSetting("composerOffset", composerOffsetRef.current);
    }
  }

  function handleComposerPointerUp(event: PointerEvent) {
    if (!composerDragRef.current || composerDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    finishComposerDrag(true);
  }

  function handleComposerMouseUp() {
    finishComposerDrag(true);
  }

  function handleComposerDragCancel() {
    finishComposerDrag(true);
  }

  function handleComposerLostPointerCapture(event: PointerEvent) {
    if (!composerDragRef.current || composerDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    finishComposerDrag(true);
  }

  function handleComposerResizePointerMove(event: PointerEvent) {
    if (!composerResizeRef.current || composerResizeRef.current.pointerId !== event.pointerId) {
      return;
    }

    if ((event.buttons & 1) !== 1) {
      finishComposerResize(true);
      return;
    }

    const activeResize = composerResizeRef.current;
    const deltaX = event.clientX - activeResize.startClientX;
    const deltaY = event.clientY - activeResize.startClientY;
    let nextSize = clampComposerSize(activeResize.startWidth, activeResize.startHeight);
    let nextOffset = clampComposerOffset(
      activeResize.startOffsetX,
      activeResize.startOffsetY,
      nextSize,
    );

    if (activeResize.edge === "left") {
      nextSize = clampComposerSize(activeResize.startWidth - deltaX, activeResize.startHeight);
      const appliedWidthDelta = nextSize.width - activeResize.startWidth;
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX - appliedWidthDelta / 2,
        activeResize.startOffsetY,
        nextSize,
      );
    } else if (activeResize.edge === "right") {
      nextSize = clampComposerSize(activeResize.startWidth + deltaX, activeResize.startHeight);
      const appliedWidthDelta = nextSize.width - activeResize.startWidth;
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX + appliedWidthDelta / 2,
        activeResize.startOffsetY,
        nextSize,
      );
    } else if (activeResize.edge === "top") {
      nextSize = clampComposerSize(activeResize.startWidth, activeResize.startHeight - deltaY);
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX,
        activeResize.startOffsetY,
        nextSize,
      );
    } else {
      nextSize = clampComposerSize(activeResize.startWidth, activeResize.startHeight + deltaY);
      const appliedHeightDelta = nextSize.height - activeResize.startHeight;
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX,
        activeResize.startOffsetY + appliedHeightDelta,
        nextSize,
      );
    }

    composerSizeRef.current = nextSize;
    composerOffsetRef.current = nextOffset;
    paintComposerFrame(nextOffset, nextSize);
  }

  function finishComposerResize(persist: boolean) {
    const activeResize = composerResizeRef.current;
    if (!activeResize) {
      return;
    }

    if (activeResize.handle.hasPointerCapture?.(activeResize.pointerId)) {
      activeResize.handle.releasePointerCapture(activeResize.pointerId);
    }

    setComposerSize(composerSizeRef.current);
    setComposerOffset(composerOffsetRef.current);
    composerResizeRef.current = null;
    setComposerResizing(false);
    window.removeEventListener("pointermove", handleComposerResizePointerMove);
    window.removeEventListener("pointerup", handleComposerResizePointerUp);
    window.removeEventListener("pointercancel", handleComposerResizePointerUp);
    window.removeEventListener("blur", handleComposerResizeCancel);

    if (persist) {
      void updateSettings({
        composerOffset: composerOffsetRef.current,
        composerSize: composerSizeRef.current,
      });
    }
  }

  function handleComposerResizePointerUp(event: PointerEvent) {
    if (!composerResizeRef.current || composerResizeRef.current.pointerId !== event.pointerId) {
      return;
    }

    finishComposerResize(true);
  }

  function handleComposerResizeCancel() {
    finishComposerResize(true);
  }

  function beginComposerDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture failures
    }
    composerDragRef.current = {
      handle: event.currentTarget,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: composerOffsetRef.current.x,
      startOffsetY: composerOffsetRef.current.y,
    };
    setComposerDragging(true);
    window.addEventListener("pointermove", handleComposerPointerMove);
    window.addEventListener("pointerup", handleComposerPointerUp);
    window.addEventListener("pointercancel", handleComposerPointerUp);
    window.addEventListener("mouseup", handleComposerMouseUp);
    window.addEventListener("blur", handleComposerDragCancel);
    event.currentTarget.addEventListener("lostpointercapture", handleComposerLostPointerCapture);
  }

  function beginComposerDragFromHeader(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, input, textarea, select, label, a, [role='button']")
    ) {
      return;
    }

    beginComposerDrag(event);
  }

  function beginComposerResize(edge: ComposerResizeEdge, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture failures
    }
    composerResizeRef.current = {
      edge,
      handle: event.currentTarget,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: composerOffsetRef.current.x,
      startOffsetY: composerOffsetRef.current.y,
      startWidth:
        composerShellRef.current?.offsetWidth ??
        composerRef.current?.offsetWidth ??
        composerSizeRef.current.width,
      startHeight: composerRef.current?.offsetHeight ?? composerSizeRef.current.height,
    };
    setComposerResizing(true);
    window.addEventListener("pointermove", handleComposerResizePointerMove);
    window.addEventListener("pointerup", handleComposerResizePointerUp);
    window.addEventListener("pointercancel", handleComposerResizePointerUp);
    window.addEventListener("blur", handleComposerResizeCancel);
  }

  function resetComposerPosition() {
    const nextOffset = DEFAULT_COMPOSER_OFFSET;
    setComposerOffset(nextOffset);
    composerOffsetRef.current = nextOffset;
    void updateSetting("composerOffset", nextOffset);
    showStatus("Composer position reset.");
  }

  function resetComposerSize() {
    const nextSize = clampComposerSize(DEFAULT_COMPOSER_SIZE.width, DEFAULT_COMPOSER_SIZE.height);
    const nextOffset = clampComposerOffset(
      composerOffsetRef.current.x,
      composerOffsetRef.current.y,
      nextSize,
    );
    setComposerSize(nextSize);
    composerSizeRef.current = nextSize;
    setComposerOffset(nextOffset);
    composerOffsetRef.current = nextOffset;
    void updateSettings({
      composerOffset: nextOffset,
      composerSize: nextSize,
    });
    showStatus("Composer size reset.");
  }

  useEffect(() => {
    composerOffsetRef.current = composerOffset;
  }, [composerOffset]);

  useEffect(() => {
    composerSizeRef.current = composerSize;
  }, [composerSize]);

  useEffect(() => {
    composerContentHeightRef.current = composerContentHeight;
  }, [composerContentHeight]);

  useLayoutEffect(() => {
    if (!isHydrated || composerResizing) {
      return;
    }

    updateComposerContentHeight();
  }, [
    attachmentCount,
    composerResizing,
    composerSize.height,
    composerSize.width,
    isHydrated,
    prompt,
  ]);

  useEffect(() => {
    const handleResize = () => {
      updateComposerContentHeight();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timeoutIds = [0, 120, 450, 900].map((delay) => focusComposerInput(delay));

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || composerDragging || composerResizing) {
      return;
    }

    setComposerOffset(settings.composerOffset);
  }, [composerDragging, composerResizing, isHydrated, settings.composerOffset]);

  useEffect(() => {
    if (!isHydrated || composerResizing) {
      return;
    }

    setComposerSize(settings.composerSize);
  }, [composerResizing, isHydrated, settings.composerSize]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleComposerPointerMove);
      window.removeEventListener("pointerup", handleComposerPointerUp);
      window.removeEventListener("pointercancel", handleComposerPointerUp);
      window.removeEventListener("mouseup", handleComposerMouseUp);
      window.removeEventListener("blur", handleComposerDragCancel);
      cancelComposerOffsetStateSync();
      window.removeEventListener("pointermove", handleComposerResizePointerMove);
      window.removeEventListener("pointerup", handleComposerResizePointerUp);
      window.removeEventListener("pointercancel", handleComposerResizePointerUp);
      window.removeEventListener("blur", handleComposerResizeCancel);
    };
  }, []);

  const composerRenderedHeight = Math.max(composerSize.height, composerContentHeight);

  return {
    beginComposerDrag,
    beginComposerDragFromHeader,
    beginComposerResize,
    composerDragging,
    composerHeight: getComposerHeightStyle(composerRenderedHeight),
    composerInputRef,
    composerOffset,
    composerRef,
    composerShellRef,
    composerWidth: getComposerWidthStyle(composerSize.width),
    focusComposerInput,
    hydrateComposerFrame,
    resetComposerPosition,
    resetComposerSize,
  };
}
