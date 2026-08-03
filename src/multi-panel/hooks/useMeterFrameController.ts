import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  type ComposerOffset,
  type ComposerSize,
  type ExtensionSettings,
} from "@/shared/lib/settings";
import {
  readTokenMeterTabState,
  writeTokenMeterTabState,
} from "@/multi-panel/lib/tokenMeterTabState";

// The panel is positioned by its top-left corner in viewport pixels. Every edge
// and corner resizes it like a normal window: the dragged edge follows the
// pointer while the opposite edge stays fixed. Left/top edges move the panel
// origin (x/y) as they shrink or grow it; right/bottom edges only change size.
export type MeterResizeEdge =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const METER_VIEWPORT_MARGIN_PX = 16;
const METER_DEFAULT_TOP_PX = 64;

const METER_MIN_WIDTH_PX = 240;
const METER_MIN_HEIGHT_PX = 200;
// The default panel opens large: three-quarters of the viewport wide and half
// of it tall (clamped to the viewport margins and the min size).
const METER_DEFAULT_WIDTH_FRACTION = 0.75;
const METER_DEFAULT_HEIGHT_FRACTION = 0.5;

// Sentinel for "the user has not placed the panel yet" — it then opens near the
// top-right corner. Any real position the panel takes is clamped to >= margin.
const METER_AUTO_POSITION: ComposerOffset = { x: -1, y: -1 };

function isAutoPosition(position: ComposerOffset) {
  return position.x < 0 || position.y < 0;
}

interface UseMeterFrameControllerOptions {
  isHydrated: boolean;
  layoutColumnCount: number;
  settings: ExtensionSettings;
  updateSetting: <Key extends keyof ExtensionSettings>(
    key: Key,
    value: ExtensionSettings[Key],
  ) => Promise<void>;
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>;
}

export function useMeterFrameController({
  isHydrated,
  layoutColumnCount,
  settings,
  updateSetting,
  updateSettings,
}: UseMeterFrameControllerOptions) {
  // Open state is per-tab (sessionStorage): opening the meter in one tab must
  // not open it in every other Parallel AI tab. Position and size, by contrast,
  // live in durable settings below so they are shared across tabs and survive a
  // restart, like the floating composer.
  const [initialTabState] = useState(readTokenMeterTabState);
  function defaultMeterSize(): ComposerSize {
    return {
      width: Math.round(viewportWidth() * METER_DEFAULT_WIDTH_FRACTION),
      height: Math.round(viewportHeight() * METER_DEFAULT_HEIGHT_FRACTION),
    };
  }

  function viewportWidth() {
    return typeof window === "undefined" ? 1280 : window.innerWidth;
  }

  function viewportHeight() {
    return typeof window === "undefined" ? 800 : window.innerHeight;
  }

  function clampMeterSize(nextWidth: number, nextHeight: number, position: ComposerOffset): ComposerSize {
    // With the top-left corner fixed, the panel can grow until it reaches the
    // opposite viewport edge.
    const left = position.x < 0 ? METER_VIEWPORT_MARGIN_PX : position.x;
    const top = position.y < 0 ? METER_DEFAULT_TOP_PX : position.y;
    const maxWidth = Math.max(METER_MIN_WIDTH_PX, viewportWidth() - left - METER_VIEWPORT_MARGIN_PX);
    const maxHeight = Math.max(
      METER_MIN_HEIGHT_PX,
      viewportHeight() - top - METER_VIEWPORT_MARGIN_PX,
    );
    return {
      width: Math.min(maxWidth, Math.max(METER_MIN_WIDTH_PX, nextWidth)),
      height: Math.min(maxHeight, Math.max(METER_MIN_HEIGHT_PX, nextHeight)),
    };
  }

  function clampMeterPosition(nextX: number, nextY: number, size: ComposerSize): ComposerOffset {
    const maxX = Math.max(
      METER_VIEWPORT_MARGIN_PX,
      viewportWidth() - METER_VIEWPORT_MARGIN_PX - size.width,
    );
    const maxY = Math.max(
      METER_VIEWPORT_MARGIN_PX,
      viewportHeight() - METER_VIEWPORT_MARGIN_PX - size.height,
    );
    return {
      x: Math.min(maxX, Math.max(METER_VIEWPORT_MARGIN_PX, nextX)),
      y: Math.min(maxY, Math.max(METER_VIEWPORT_MARGIN_PX, nextY)),
    };
  }

  // Resize geometry for any edge/corner. Left/top edges keep the opposite edge
  // (right = startX + startWidth, bottom = startY + startHeight) pinned while
  // moving the origin; right/bottom edges keep the origin pinned. Every result
  // stays within the viewport margins and the min size.
  function computeMeterResize(
    edge: MeterResizeEdge,
    startX: number,
    startY: number,
    startWidth: number,
    startHeight: number,
    deltaX: number,
    deltaY: number,
  ): { x: number; y: number; width: number; height: number } {
    const margin = METER_VIEWPORT_MARGIN_PX;
    const movesLeft = edge.includes("left");
    const movesRight = edge.includes("right");
    const movesTop = edge.includes("top");
    const movesBottom = edge.includes("bottom");

    const rightEdge = startX + startWidth;
    const bottomEdge = startY + startHeight;

    let x = startX;
    let y = startY;
    let width = startWidth;
    let height = startHeight;

    if (movesRight) {
      const maxWidth = Math.max(METER_MIN_WIDTH_PX, viewportWidth() - startX - margin);
      width = Math.min(maxWidth, Math.max(METER_MIN_WIDTH_PX, startWidth + deltaX));
    } else if (movesLeft) {
      const maxX = rightEdge - METER_MIN_WIDTH_PX;
      x = Math.min(maxX, Math.max(margin, startX + deltaX));
      width = rightEdge - x;
    }

    if (movesBottom) {
      const maxHeight = Math.max(METER_MIN_HEIGHT_PX, viewportHeight() - startY - margin);
      height = Math.min(maxHeight, Math.max(METER_MIN_HEIGHT_PX, startHeight + deltaY));
    } else if (movesTop) {
      const maxY = bottomEdge - METER_MIN_HEIGHT_PX;
      y = Math.min(maxY, Math.max(margin, startY + deltaY));
      height = bottomEdge - y;
    }

    return { x, y, width, height };
  }

  function resolveSize(stored: ComposerSize): ComposerSize {
    const base = stored.width > 0 && stored.height > 0 ? stored : defaultMeterSize();
    return clampMeterSize(base.width, base.height, resolvePosition(settings.tokenMeterOffset, base));
  }

  // Auto-position opens centered in the viewport, computed from the size.
  function resolvePosition(stored: ComposerOffset, size: ComposerSize): ComposerOffset {
    if (isAutoPosition(stored)) {
      return clampMeterPosition(
        Math.round((viewportWidth() - size.width) / 2),
        Math.round((viewportHeight() - size.height) / 2),
        size,
      );
    }
    return clampMeterPosition(stored.x, stored.y, size);
  }

  const initialSize = resolveSize(settings.tokenMeterSize);
  const [meterOpen, setMeterOpen] = useState(initialTabState.open);
  const [meterMaximized, setMeterMaximized] = useState(initialTabState.maximized);
  const [meterSize, setMeterSize] = useState(initialSize);
  const [meterPosition, setMeterPosition] = useState(() =>
    resolvePosition(settings.tokenMeterOffset, initialSize),
  );
  const [meterDragging, setMeterDragging] = useState(false);
  const [meterResizing, setMeterResizing] = useState(false);

  const meterShellRef = useRef<HTMLDivElement | null>(null);
  const meterOpenRef = useRef(meterOpen);
  const meterMaximizedRef = useRef(meterMaximized);
  const meterPositionRef = useRef(meterPosition);
  const meterSizeRef = useRef(meterSize);
  const meterHasStoredSizeRef = useRef(
    settings.tokenMeterSize.width > 0 && settings.tokenMeterSize.height > 0,
  );
  const meterHasStoredPositionRef = useRef(!isAutoPosition(settings.tokenMeterOffset));

  // Open/close persists to this tab's sessionStorage only.
  function applyMeterOpen(next: boolean) {
    meterOpenRef.current = next;
    setMeterOpen(next);
    writeTokenMeterTabState({ open: next });
  }

  function toggleMeter() {
    applyMeterOpen(!meterOpenRef.current);
  }

  function closeMeter() {
    applyMeterOpen(false);
  }

  // Recenter the panel in the viewport at its current size (double-click). Marks
  // the position as user-set and persists it to durable, cross-tab settings.
  function centerMeter() {
    const size = meterSizeRef.current;
    const nextPosition = clampMeterPosition(
      Math.round((viewportWidth() - size.width) / 2),
      Math.round((viewportHeight() - size.height) / 2),
      size,
    );
    meterPositionRef.current = nextPosition;
    setMeterPosition(nextPosition);
    meterHasStoredPositionRef.current = true;
    paintMeterFrame(nextPosition, size);
    void updateSetting("tokenMeterOffset", nextPosition);
  }

  // Maximize button: fill the whole viewport edge-to-edge (a per-tab view state,
  // not a geometry change) or restore to the stored floating size/position. The
  // panel component renders the full-screen shell when `meterMaximized` is true.
  function toggleMeterMaximize() {
    const next = !meterMaximizedRef.current;
    meterMaximizedRef.current = next;
    setMeterMaximized(next);
    writeTokenMeterTabState({ maximized: next });
  }
  const meterPositionStateRafRef = useRef<number | null>(null);
  const meterDragRef = useRef<{
    handle: HTMLElement;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const meterResizeRef = useRef<{
    edge: MeterResizeEdge;
    handle: HTMLElement;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  function paintMeterFrame(position: ComposerOffset, size: ComposerSize) {
    const shell = meterShellRef.current;
    if (!shell) {
      return;
    }
    shell.style.left = `${position.x}px`;
    shell.style.top = `${position.y}px`;
    shell.style.width = `${size.width}px`;
    shell.style.height = `${size.height}px`;
  }

  function scheduleMeterPositionStateSync() {
    if (meterPositionStateRafRef.current !== null) {
      return;
    }
    meterPositionStateRafRef.current = window.requestAnimationFrame(() => {
      meterPositionStateRafRef.current = null;
      setMeterPosition(meterPositionRef.current);
    });
  }

  function cancelMeterPositionStateSync() {
    if (meterPositionStateRafRef.current === null) {
      return;
    }
    window.cancelAnimationFrame(meterPositionStateRafRef.current);
    meterPositionStateRafRef.current = null;
  }

  // --- Drag ---

  function handleMeterPointerMove(event: PointerEvent) {
    if (!meterDragRef.current || meterDragRef.current.pointerId !== event.pointerId) {
      return;
    }
    if ((event.buttons & 1) !== 1) {
      finishMeterDrag(true);
      return;
    }
    const nextPosition = clampMeterPosition(
      meterDragRef.current.startX + (event.clientX - meterDragRef.current.startClientX),
      meterDragRef.current.startY + (event.clientY - meterDragRef.current.startClientY),
      meterSizeRef.current,
    );
    meterPositionRef.current = nextPosition;
    paintMeterFrame(nextPosition, meterSizeRef.current);
    scheduleMeterPositionStateSync();
  }

  function finishMeterDrag(persist: boolean) {
    const activeDrag = meterDragRef.current;
    if (!activeDrag) {
      return;
    }
    meterDragRef.current = null;
    cancelMeterPositionStateSync();
    activeDrag.handle.removeEventListener("lostpointercapture", handleMeterLostPointerCapture);
    if (activeDrag.handle.hasPointerCapture?.(activeDrag.pointerId)) {
      try {
        activeDrag.handle.releasePointerCapture(activeDrag.pointerId);
      } catch {
        // The browser may have already released capture after a fast pointerup.
      }
    }
    setMeterPosition(meterPositionRef.current);
    setMeterDragging(false);
    meterHasStoredPositionRef.current = true;
    window.removeEventListener("pointermove", handleMeterPointerMove);
    window.removeEventListener("pointerup", handleMeterPointerUp);
    window.removeEventListener("pointercancel", handleMeterPointerUp);
    window.removeEventListener("blur", handleMeterDragCancel);
    if (persist) {
      void updateSetting("tokenMeterOffset", meterPositionRef.current);
    }
  }

  function handleMeterPointerUp(event: PointerEvent) {
    if (!meterDragRef.current || meterDragRef.current.pointerId !== event.pointerId) {
      return;
    }
    finishMeterDrag(true);
  }

  function handleMeterDragCancel() {
    finishMeterDrag(true);
  }

  function handleMeterLostPointerCapture(event: PointerEvent) {
    if (!meterDragRef.current || meterDragRef.current.pointerId !== event.pointerId) {
      return;
    }
    finishMeterDrag(true);
  }

  function beginMeterDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture failures
    }
    meterDragRef.current = {
      handle: event.currentTarget,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: meterPositionRef.current.x,
      startY: meterPositionRef.current.y,
    };
    setMeterDragging(true);
    window.addEventListener("pointermove", handleMeterPointerMove);
    window.addEventListener("pointerup", handleMeterPointerUp);
    window.addEventListener("pointercancel", handleMeterPointerUp);
    window.addEventListener("blur", handleMeterDragCancel);
    event.currentTarget.addEventListener("lostpointercapture", handleMeterLostPointerCapture);
  }

  function beginMeterDragFromHeader(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, input, textarea, select, label, a, [role='button']")
    ) {
      return;
    }
    beginMeterDrag(event);
  }

  // --- Resize (top-left corner stays fixed) ---

  function handleMeterResizePointerMove(event: PointerEvent) {
    if (!meterResizeRef.current || meterResizeRef.current.pointerId !== event.pointerId) {
      return;
    }
    if ((event.buttons & 1) !== 1) {
      finishMeterResize(true);
      return;
    }
    const activeResize = meterResizeRef.current;
    const deltaX = event.clientX - activeResize.startClientX;
    const deltaY = event.clientY - activeResize.startClientY;

    const geometry = computeMeterResize(
      activeResize.edge,
      activeResize.startX,
      activeResize.startY,
      activeResize.startWidth,
      activeResize.startHeight,
      deltaX,
      deltaY,
    );

    const nextPosition = { x: geometry.x, y: geometry.y };
    const nextSize = { width: geometry.width, height: geometry.height };
    meterPositionRef.current = nextPosition;
    meterSizeRef.current = nextSize;
    paintMeterFrame(nextPosition, nextSize);
  }

  function finishMeterResize(persist: boolean) {
    const activeResize = meterResizeRef.current;
    if (!activeResize) {
      return;
    }
    if (activeResize.handle.hasPointerCapture?.(activeResize.pointerId)) {
      try {
        activeResize.handle.releasePointerCapture(activeResize.pointerId);
      } catch {
        // already released
      }
    }
    meterResizeRef.current = null;
    meterHasStoredSizeRef.current = true;
    // A left/top resize also moves the origin, so both are committed together.
    meterHasStoredPositionRef.current = true;
    setMeterSize(meterSizeRef.current);
    setMeterPosition(meterPositionRef.current);
    setMeterResizing(false);
    window.removeEventListener("pointermove", handleMeterResizePointerMove);
    window.removeEventListener("pointerup", handleMeterResizePointerUp);
    window.removeEventListener("pointercancel", handleMeterResizePointerUp);
    window.removeEventListener("blur", handleMeterResizeCancel);
    if (persist) {
      void updateSettings({
        tokenMeterSize: meterSizeRef.current,
        tokenMeterOffset: meterPositionRef.current,
      });
    }
  }

  function handleMeterResizePointerUp(event: PointerEvent) {
    if (!meterResizeRef.current || meterResizeRef.current.pointerId !== event.pointerId) {
      return;
    }
    finishMeterResize(true);
  }

  function handleMeterResizeCancel() {
    finishMeterResize(true);
  }

  function beginMeterResize(edge: MeterResizeEdge, event: ReactPointerEvent<HTMLElement>) {
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
    meterResizeRef.current = {
      edge,
      handle: event.currentTarget,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: meterPositionRef.current.x,
      startY: meterPositionRef.current.y,
      startWidth: meterShellRef.current?.offsetWidth ?? meterSizeRef.current.width,
      startHeight: meterShellRef.current?.offsetHeight ?? meterSizeRef.current.height,
    };
    setMeterResizing(true);
    window.addEventListener("pointermove", handleMeterResizePointerMove);
    window.addEventListener("pointerup", handleMeterResizePointerUp);
    window.addEventListener("pointercancel", handleMeterResizePointerUp);
    window.addEventListener("blur", handleMeterResizeCancel);
  }

  useEffect(() => {
    meterPositionRef.current = meterPosition;
  }, [meterPosition]);

  useEffect(() => {
    meterSizeRef.current = meterSize;
  }, [meterSize]);

  // Follow the pane layout while the user has not set an explicit size.
  useEffect(() => {
    if (!isHydrated || meterResizing || meterHasStoredSizeRef.current) {
      return;
    }
    const nextSize = clampMeterSize(
      defaultMeterSize().width,
      defaultMeterSize().height,
      meterPositionRef.current,
    );
    setMeterSize(nextSize);
    meterSizeRef.current = nextSize;
    if (!meterHasStoredPositionRef.current) {
      const nextPosition = resolvePosition(METER_AUTO_POSITION, nextSize);
      setMeterPosition(nextPosition);
      meterPositionRef.current = nextPosition;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, layoutColumnCount, meterResizing]);

  // Adopt stored geometry (another tab, hydration, or a settings reset) unless a
  // gesture is running. Size and position resolve together as they do at mount:
  // clamping them separately measured each against the other's stale value, and
  // resolveSize/resolvePosition also turn the reset sentinels back into the
  // default centered geometry.
  useEffect(() => {
    if (!isHydrated || meterDragging || meterResizing) {
      return;
    }

    const storedSize = settings.tokenMeterSize;
    const storedOffset = settings.tokenMeterOffset;
    const nextSize = resolveSize(storedSize);
    const nextPosition = resolvePosition(storedOffset, nextSize);

    // Tracks the stored values rather than latching, so a reset lets the panel
    // follow the layout again.
    meterHasStoredSizeRef.current = storedSize.width > 0 && storedSize.height > 0;
    meterHasStoredPositionRef.current = !isAutoPosition(storedOffset);

    if (
      nextSize.width !== meterSizeRef.current.width ||
      nextSize.height !== meterSizeRef.current.height
    ) {
      setMeterSize(nextSize);
      meterSizeRef.current = nextSize;
    }
    if (
      nextPosition.x !== meterPositionRef.current.x ||
      nextPosition.y !== meterPositionRef.current.y
    ) {
      setMeterPosition(nextPosition);
      meterPositionRef.current = nextPosition;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isHydrated,
    meterDragging,
    meterResizing,
    settings.tokenMeterOffset,
    settings.tokenMeterSize,
  ]);

  // Without this a panel parked near the old right/bottom edge can end up wholly
  // outside a narrowed viewport, with no handle left to drag it back.
  useEffect(() => {
    function handleViewportResize() {
      if (meterDragging || meterResizing) {
        return;
      }
      const nextSize = clampMeterSize(
        meterSizeRef.current.width,
        meterSizeRef.current.height,
        meterPositionRef.current,
      );
      const nextPosition = clampMeterPosition(
        meterPositionRef.current.x,
        meterPositionRef.current.y,
        nextSize,
      );
      if (
        nextSize.width !== meterSizeRef.current.width ||
        nextSize.height !== meterSizeRef.current.height
      ) {
        meterSizeRef.current = nextSize;
        setMeterSize(nextSize);
      }
      if (
        nextPosition.x !== meterPositionRef.current.x ||
        nextPosition.y !== meterPositionRef.current.y
      ) {
        meterPositionRef.current = nextPosition;
        setMeterPosition(nextPosition);
      }
    }

    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [meterDragging, meterResizing]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleMeterPointerMove);
      window.removeEventListener("pointerup", handleMeterPointerUp);
      window.removeEventListener("pointercancel", handleMeterPointerUp);
      window.removeEventListener("blur", handleMeterDragCancel);
      window.removeEventListener("pointermove", handleMeterResizePointerMove);
      window.removeEventListener("pointerup", handleMeterResizePointerUp);
      window.removeEventListener("pointercancel", handleMeterResizePointerUp);
      window.removeEventListener("blur", handleMeterResizeCancel);
      cancelMeterPositionStateSync();
    };
  }, []);

  return {
    beginMeterDragFromHeader,
    beginMeterResize,
    centerMeter,
    closeMeter,
    meterDragging,
    meterMaximized,
    meterOpen,
    meterPosition,
    meterResizing,
    meterShellRef,
    meterSize,
    toggleMeter,
    toggleMeterMaximize,
  };
}
