import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN_PX = 8;

type WidthMode = "anchor" | number;
type AlignMode = "start" | "center";

interface FloatingMenuPanelProps {
  align?: AlignMode;
  anchorRef: RefObject<HTMLElement>;
  ariaLabelledBy?: string;
  children: ReactNode;
  gap?: number;
  id?: string;
  menuRef: RefObject<HTMLDivElement>;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  open: boolean;
  role?: "listbox" | "menu";
  width?: WidthMode;
}

interface MenuPosition {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

function computePosition(
  anchor: HTMLElement,
  width: WidthMode,
  align: AlignMode,
  gap: number,
): MenuPosition {
  const rect = anchor.getBoundingClientRect();
  const computedWidth = width === "anchor" ? rect.width : width;
  const top = rect.bottom + gap;

  const baseLeft = align === "center" ? rect.left + (rect.width - computedWidth) / 2 : rect.left;
  const left = Math.min(
    Math.max(baseLeft, VIEWPORT_MARGIN_PX),
    Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - computedWidth - VIEWPORT_MARGIN_PX),
  );

  return {
    left,
    maxHeight: Math.max(160, window.innerHeight - top - VIEWPORT_MARGIN_PX),
    top,
    width: computedWidth,
  };
}

export function FloatingMenuPanel({
  align = "start",
  anchorRef,
  ariaLabelledBy,
  children,
  gap = 6,
  id,
  menuRef,
  onPointerEnter,
  onPointerLeave,
  open,
  role = "listbox",
  width = "anchor",
}: FloatingMenuPanelProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      return;
    }
    setPosition(computePosition(anchorRef.current, width, align, gap));
  }, [align, anchorRef, gap, open, width]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function reposition() {
      if (anchorRef.current) {
        setPosition(computePosition(anchorRef.current, width, align, gap));
      }
    }

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [align, anchorRef, gap, open, width]);

  if (!open || !position) {
    return null;
  }

  const widthStyle: Record<string, string | number> =
    width === "anchor" ? { minWidth: position.width } : { width: position.width };

  return createPortal(
    <div
      aria-labelledby={ariaLabelledBy}
      className="fixed z-[999998] overflow-hidden rounded-[14px] bg-[#424242] p-1 shadow-[0_20px_52px_-24px_rgba(0,0,0,0.95)]"
      id={id}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      ref={menuRef}
      role={role}
      style={{
        left: position.left,
        maxHeight: position.maxHeight,
        top: position.top,
        ...widthStyle,
      }}
    >
      <div className="minimal-scrollbar max-h-full overflow-y-auto">{children}</div>
    </div>,
    document.body,
  );
}
