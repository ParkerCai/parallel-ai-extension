import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { clamp } from "@/multi-panel/lib/math";
import { DEFAULT_FOCUS_MODAL_WIDTH } from "@/shared/lib/settings";

export const FOCUS_MODAL_MIN_WIDTH = 480;
const FOCUS_MODAL_HORIZONTAL_MARGIN = 16;

export type FocusModalEdge = "left" | "right";

interface UseFocusModalResizeOptions {
  width: number;
  onCommitWidth: (width: number) => void;
}

function clampFocusModalWidth(nextWidth: number) {
  const maxWidth = Math.max(
    FOCUS_MODAL_MIN_WIDTH,
    window.innerWidth - FOCUS_MODAL_HORIZONTAL_MARGIN * 2,
  );
  return clamp(nextWidth, FOCUS_MODAL_MIN_WIDTH, maxWidth);
}

/** The modal's CSS width, capped to the viewport. Shared with the component. */
export function getFocusModalWidthStyle(width: number) {
  return `min(${width}px, calc(100vw - 32px))`;
}

/**
 * The `left` for an element aligned to one edge of a centred box of the given
 * width style. Used for both the modal (its left edge) and the edge handles,
 * so the modal stays centred without a CSS transform (a transformed ancestor
 * stops Chrome clipping a composited iframe to the squircle).
 */
export function getFocusEdgeLeft(edge: FocusModalEdge, widthStyle: string) {
  const half = `(${widthStyle}) / 2`;
  return edge === "left" ? `calc(50% - ${half})` : `calc(50% + ${half})`;
}

/**
 * Drives the focus-modal width via edge handles. The modal stays centred and
 * each edge grows/shrinks it symmetrically.
 *
 * During a drag the width + left are painted straight to the DOM via refs (no
 * React re-render per pointer move, so the iframe-bearing panel is untouched),
 * mirroring the composer's resize approach. React state and the persisted
 * setting are only updated when the drag ends.
 */
export function useFocusModalResize({ width, onCommitWidth }: UseFocusModalResizeOptions) {
  const [committedWidth, setCommittedWidth] = useState(width);
  const focusModalRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLButtonElement | null>(null);
  const rightHandleRef = useRef<HTMLButtonElement | null>(null);
  const widthRef = useRef(width);
  const resizeRef = useRef<{
    edge: FocusModalEdge;
    handle: HTMLElement;
    pointerId: number;
    startClientX: number;
    startWidth: number;
  } | null>(null);

  // Keep the painted width aligned with the persisted value while idle.
  useEffect(() => {
    widthRef.current = width;
    setCommittedWidth(width);
  }, [width]);

  function paintWidth(nextWidth: number) {
    const widthStyle = getFocusModalWidthStyle(nextWidth);
    const leftEdge = getFocusEdgeLeft("left", widthStyle);
    if (focusModalRef.current) {
      focusModalRef.current.style.width = widthStyle;
      focusModalRef.current.style.left = leftEdge;
    }
    if (leftHandleRef.current) {
      leftHandleRef.current.style.left = leftEdge;
    }
    if (rightHandleRef.current) {
      rightHandleRef.current.style.left = getFocusEdgeLeft("right", widthStyle);
    }
  }

  function addDragListeners() {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("blur", handleResizeCancel);
  }

  function removeDragListeners() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    window.removeEventListener("blur", handleResizeCancel);
  }

  function handlePointerMove(event: PointerEvent) {
    const activeResize = resizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    if ((event.buttons & 1) !== 1) {
      finishResize(true);
      return;
    }

    const deltaX = event.clientX - activeResize.startClientX;
    const widthDelta = activeResize.edge === "right" ? deltaX * 2 : deltaX * -2;
    const nextWidth = clampFocusModalWidth(activeResize.startWidth + widthDelta);
    widthRef.current = nextWidth;
    paintWidth(nextWidth);
  }

  function finishResize(persist: boolean) {
    const activeResize = resizeRef.current;
    if (!activeResize) {
      return;
    }

    if (activeResize.handle.hasPointerCapture?.(activeResize.pointerId)) {
      try {
        activeResize.handle.releasePointerCapture(activeResize.pointerId);
      } catch {
        // The browser may have already released capture after a fast pointerup.
      }
    }

    resizeRef.current = null;
    removeDragListeners();

    setCommittedWidth(widthRef.current);
    if (persist) {
      onCommitWidth(widthRef.current);
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (!resizeRef.current || resizeRef.current.pointerId !== event.pointerId) {
      return;
    }

    finishResize(true);
  }

  function handleResizeCancel() {
    finishResize(true);
  }

  function beginResize(edge: FocusModalEdge, event: ReactPointerEvent<HTMLElement>) {
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

    // offsetWidth can be 0 before the modal has laid out; fall back to the last
    // known width rather than letting clamp snap the start to the minimum.
    const measuredWidth = focusModalRef.current?.offsetWidth ?? 0;
    const startWidth = clampFocusModalWidth(
      measuredWidth > 0 ? measuredWidth : widthRef.current,
    );
    widthRef.current = startWidth;
    resizeRef.current = {
      edge,
      handle: event.currentTarget,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startWidth,
    };
    addDragListeners();
  }

  function resetWidth() {
    widthRef.current = DEFAULT_FOCUS_MODAL_WIDTH;
    paintWidth(DEFAULT_FOCUS_MODAL_WIDTH);
    setCommittedWidth(DEFAULT_FOCUS_MODAL_WIDTH);
    onCommitWidth(DEFAULT_FOCUS_MODAL_WIDTH);
  }

  useEffect(() => removeDragListeners, []);

  return {
    beginResize,
    focusModalRef,
    leftHandleRef,
    resetWidth,
    rightHandleRef,
    width: committedWidth,
  };
}
