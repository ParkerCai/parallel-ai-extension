import { useEffect, useState } from "react";

interface TooltipState {
  placement: "top" | "bottom";
  text: string;
  x: number;
  y: number;
}

const TOOLTIP_MARGIN = 12;
const HOVER_DELAY_MS = 200;

function readTooltipTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>("[data-tooltip]");
}

function getTooltipState(target: HTMLElement): TooltipState | null {
  const text = target.dataset.tooltip?.trim();

  if (!text) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const x = Math.min(
    Math.max(rect.left + rect.width / 2, TOOLTIP_MARGIN),
    viewportWidth - TOOLTIP_MARGIN,
  );
  const requestedPlacement =
    target.dataset.tooltipPlacement === "bottom" || target.dataset.tooltipPlacement === "top"
      ? target.dataset.tooltipPlacement
      : null;
  const hasRoomAbove = rect.top > 44;
  const placement = requestedPlacement ?? (hasRoomAbove ? "top" : "bottom");

  return {
    placement,
    text,
    x,
    y: placement === "top" ? rect.top - 8 : rect.bottom + 8,
  };
}

export function TooltipProvider() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    let activeTarget: HTMLElement | null = null;
    let pendingTarget: HTMLElement | null = null;
    let hoverTimer: number | null = null;

    const clearHoverTimer = () => {
      if (hoverTimer !== null) {
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      pendingTarget = null;
    };

    const showTooltip = (target: HTMLElement | null) => {
      clearHoverTimer();
      activeTarget = target;
      setTooltip(target ? getTooltipState(target) : null);
    };

    const scheduleHoverTooltip = (target: HTMLElement) => {
      clearHoverTimer();
      pendingTarget = target;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = null;
        if (pendingTarget) {
          showTooltip(pendingTarget);
        }
      }, HOVER_DELAY_MS);
    };

    const handlePointerOver = (event: PointerEvent) => {
      const target = readTooltipTarget(event.target);

      if (!target) {
        return;
      }

      if (target === activeTarget || target === pendingTarget) {
        return;
      }

      scheduleHoverTooltip(target);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const nextTarget = event.relatedTarget;

      if (pendingTarget) {
        if (nextTarget instanceof Node && pendingTarget.contains(nextTarget)) {
          return;
        }
        clearHoverTimer();
      }

      if (!activeTarget) {
        return;
      }

      if (nextTarget instanceof Node && activeTarget.contains(nextTarget)) {
        return;
      }

      showTooltip(null);
    };

    const handleFocusIn = (event: FocusEvent) => {
      showTooltip(readTooltipTarget(event.target));
    };

    const handleFocusOut = () => {
      showTooltip(null);
    };

    const updatePosition = () => {
      if (!activeTarget) {
        return;
      }

      setTooltip(getTooltipState(activeTarget));
    };

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearHoverTimer();
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, []);

  if (!tooltip) {
    return null;
  }

  return (
    <div
      className={`app-tooltip app-tooltip--${tooltip.placement}`}
      role="tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      {tooltip.text}
    </div>
  );
}
