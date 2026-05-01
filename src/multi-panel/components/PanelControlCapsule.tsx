import { ChevronDown } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { runtimeAsset } from "@/multi-panel/lib/runtime";
import type { PanelDragState } from "@/multi-panel/types";
import type { Provider, ProviderId } from "@/shared/lib/providers";

const CAPSULE_VARIANTS = {
  compact: {
    barWidth: "w-[104px]",
    width:
      "w-[112px] group-hover/panel-controls:w-[116px] group-focus-within/panel-controls:w-[116px]",
  },
  wide: {
    barWidth: "w-[140px]",
    width:
      "w-[148px] group-hover/panel-controls:w-[152px] group-focus-within/panel-controls:w-[152px]",
  },
} as const;

const interactiveStateClass =
  "pointer-events-none group-hover/panel-controls:pointer-events-auto group-focus-within/panel-controls:pointer-events-auto";

const PROVIDER_PICKER_MENU_WIDTH = 140;
const PROVIDER_PICKER_MENU_GAP = 0;
const PROVIDER_PICKER_MENU_MARGIN = 8;

interface ProviderPickerMenuPosition {
  left: number;
  maxHeight: number;
  top: number;
}

function getProviderPickerMenuPosition(element: HTMLElement): ProviderPickerMenuPosition {
  const capsuleElement = element.closest<HTMLElement>("[data-panel-control-capsule]");
  const rect = (capsuleElement ?? element).getBoundingClientRect();
  const left = Math.min(
    Math.max(rect.left + (rect.width - PROVIDER_PICKER_MENU_WIDTH) / 2, PROVIDER_PICKER_MENU_MARGIN),
    Math.max(
      PROVIDER_PICKER_MENU_MARGIN,
      window.innerWidth - PROVIDER_PICKER_MENU_WIDTH - PROVIDER_PICKER_MENU_MARGIN,
    ),
  );
  const top = rect.bottom + PROVIDER_PICKER_MENU_GAP;

  return {
    left,
    maxHeight: Math.max(160, window.innerHeight - top - PROVIDER_PICKER_MENU_MARGIN),
    top,
  };
}

interface PanelControlCapsuleProps {
  children: ReactNode;
  variant: keyof typeof CAPSULE_VARIANTS;
}

export function PanelControlCapsule({ children, variant }: PanelControlCapsuleProps) {
  const variantClass = CAPSULE_VARIANTS[variant];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-4">
      <div className="group/panel-controls pointer-events-auto relative">
        <div
          data-panel-control-capsule
          className={`relative inline-flex h-[12px] ${variantClass.width} items-center justify-center overflow-hidden rounded-full bg-[rgba(45,45,45,0.42)] px-0 py-0 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] backdrop-blur-[2px] transition-[height,padding,box-shadow,width] duration-200 ease-out group-hover/panel-controls:h-[44px] group-hover/panel-controls:px-1.5 group-hover/panel-controls:py-1.5 group-focus-within/panel-controls:h-[44px] group-focus-within/panel-controls:px-1.5 group-focus-within/panel-controls:py-1.5`}
        >
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 h-[3px] ${variantClass.barWidth} -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2d2d2d] transition-all duration-150 ease-out group-hover/panel-controls:w-0 group-hover/panel-controls:opacity-0 group-focus-within/panel-controls:w-0 group-focus-within/panel-controls:opacity-0`}
          />

          <div className="flex items-center gap-1 opacity-0 transition-all duration-150 ease-out group-hover/panel-controls:opacity-100 group-focus-within/panel-controls:opacity-100">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PanelProviderPickerProps {
  ariaLabel: string;
  onChange: (providerId: ProviderId) => void;
  options: Provider[];
  placeholder?: string;
  resetAfterChange?: boolean;
  tooltip: string;
  value: ProviderId | "";
}

export function PanelProviderPicker({
  ariaLabel,
  onChange,
  options,
  placeholder,
  resetAfterChange = false,
  tooltip,
  value,
}: PanelProviderPickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<ProviderPickerMenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hoverCloseTimeoutRef = useRef<number | null>(null);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.id === value);

  const clearHoverCloseTimeout = () => {
    if (hoverCloseTimeoutRef.current !== null) {
      window.clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
  };

  const scheduleHoverClose = () => {
    clearHoverCloseTimeout();
    hoverCloseTimeoutRef.current = window.setTimeout(() => {
      hoverCloseTimeoutRef.current = null;
      setIsOpen(false);
    }, 120);
  };

  const openMenu = () => {
    clearHoverCloseTimeout();
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const closeMenu = () => {
    clearHoverCloseTimeout();
    setIsOpen(false);
  };

  const selectProvider = (providerId: ProviderId) => {
    if (resetAfterChange || providerId !== value) {
      onChange(providerId);
    }

    closeMenu();
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return;
    }

    setMenuPosition(getProviderPickerMenuPosition(buttonRef.current));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateMenuPosition = () => {
      if (!buttonRef.current) {
        return;
      }

      setMenuPosition(getProviderPickerMenuPosition(buttonRef.current));
    };
    const capsuleElement = buttonRef.current?.closest<HTMLElement>("[data-panel-control-capsule]");

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    capsuleElement?.addEventListener("pointerenter", clearHoverCloseTimeout);
    capsuleElement?.addEventListener("pointerleave", scheduleHoverClose);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      capsuleElement?.removeEventListener("pointerenter", clearHoverCloseTimeout);
      capsuleElement?.removeEventListener("pointerleave", scheduleHoverClose);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const handleButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        openMenu();
        return;
      }

      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((currentIndex) => (currentIndex + direction + options.length) % options.length);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (!isOpen) {
        openMenu();
        return;
      }

      const activeOption = options[activeIndex];

      if (activeOption) {
        selectProvider(activeOption.id);
      }

      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu();
    }
  };

  const menu =
    isOpen && menuPosition
      ? createPortal(
        <div
          className="fixed z-[999998] overflow-hidden rounded-[14px] bg-[#424242] p-1 shadow-[0_20px_52px_-24px_rgba(0,0,0,0.95)]"
          id={listboxId}
          onMouseEnter={clearHoverCloseTimeout}
          onMouseLeave={scheduleHoverClose}
          ref={menuRef}
          role="listbox"
          style={{
            left: menuPosition.left,
            maxHeight: menuPosition.maxHeight,
            top: menuPosition.top,
            width: PROVIDER_PICKER_MENU_WIDTH,
          }}
        >
          <div className="minimal-scrollbar max-h-full overflow-y-auto">
            {options.map((option, index) => {
              const isActive = activeIndex === index;
              const isSelected = option.id === value;

              return (
                <button
                  aria-selected={isSelected}
                  className={`flex h-9 w-full items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium leading-5 text-white transition ${
                    isSelected
                      ? "bg-[#5a5a5a]"
                      : isActive
                        ? "bg-[#4f4f4f]"
                        : "bg-transparent hover:bg-[#4f4f4f]"
                  }`}
                  id={`${listboxId}-${option.id}`}
                  key={option.id}
                  onClick={() => selectProvider(option.id)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <img
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-[5px]"
                    src={runtimeAsset(option.iconDark)}
                  />
                  <span className="min-w-0 truncate">{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
      : null;

  return (
    <div className="relative">
      <button
        aria-label={ariaLabel}
        aria-activedescendant={
          isOpen && options[activeIndex] ? `${listboxId}-${options[activeIndex].id}` : undefined
        }
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`${interactiveStateClass} inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition hover:bg-white/14 focus:outline-none focus:ring-white/20`}
        data-tooltip={isOpen ? undefined : tooltip}
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          openMenu();
        }}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        role="combobox"
        type="button"
      >
        <ChevronDown size={16} />
        <span className="sr-only">{placeholder ?? ariaLabel}</span>
      </button>
      {menu}
    </div>
  );
}

interface PanelReorderButtonProps {
  ariaLabel: string;
  dragState: PanelDragState;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  tooltip: string;
}

export function PanelReorderButton({
  ariaLabel,
  dragState,
  onPointerDown,
  tooltip,
}: PanelReorderButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={`${interactiveStateClass} inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/70 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-white ${dragState === "source" ? "cursor-grabbing" : "cursor-grab"
        }`}
      data-tooltip={tooltip}
      onPointerDown={onPointerDown}
      type="button"
    >
      <span className="grid grid-cols-3 place-items-center gap-x-1 gap-y-0.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className="h-[2.5px] w-[2.5px] rounded-full bg-current opacity-85" />
        ))}
      </span>
    </button>
  );
}

interface PanelControlIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "type"> {
  children: ReactNode;
  danger?: boolean;
  tooltip: string;
}

export function PanelControlIconButton({
  children,
  danger = false,
  tooltip,
  ...buttonProps
}: PanelControlIconButtonProps) {
  const hoverClass = danger
    ? "hover:bg-[hsl(var(--danger))]/22 hover:text-[hsl(var(--danger-text))]"
    : "hover:bg-white/14 hover:text-white";

  return (
    <button
      {...buttonProps}
      className={`${interactiveStateClass} inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition ${hoverClass}`}
      data-tooltip={tooltip}
      type="button"
    >
      {children}
    </button>
  );
}
