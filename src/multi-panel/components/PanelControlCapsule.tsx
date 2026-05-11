import { ChevronDown } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useEffect, useId, useRef } from "react";

import { FloatingMenuPanel } from "@/shared/components/FloatingMenuPanel";
import { useFloatingListbox } from "@/shared/hooks/useFloatingListbox";
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
const PROVIDER_PICKER_HOVER_CLOSE_MS = 120;

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
  const listboxId = useId();
  const capsuleRef = useRef<HTMLElement | null>(null);
  const hoverCloseTimeoutRef = useRef<number | null>(null);
  const selectedIndex = options.findIndex((option) => option.id === value);

  function clearHoverCloseTimeout() {
    if (hoverCloseTimeoutRef.current !== null) {
      window.clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
  }

  function commitIndex(index: number) {
    const option = options[index];
    if (!option) {
      return;
    }
    if (resetAfterChange || option.id !== value) {
      onChange(option.id);
    }
    clearHoverCloseTimeout();
    close();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const {
    activeIndex,
    close,
    handleTriggerKeyDown,
    isOpen,
    menuRef,
    open,
    setActiveIndex,
    triggerRef,
  } = useFloatingListbox({
    onCommit: commitIndex,
    optionsCount: options.length,
    selectedIndex,
  });

  useEffect(() => {
    if (!triggerRef.current) {
      return;
    }
    capsuleRef.current = triggerRef.current.closest<HTMLElement>(
      "[data-panel-control-capsule]",
    );
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const capsuleElement = capsuleRef.current;

    function scheduleHoverClose() {
      clearHoverCloseTimeout();
      hoverCloseTimeoutRef.current = window.setTimeout(() => {
        hoverCloseTimeoutRef.current = null;
        close();
      }, PROVIDER_PICKER_HOVER_CLOSE_MS);
    }

    capsuleElement?.addEventListener("pointerenter", clearHoverCloseTimeout);
    capsuleElement?.addEventListener("pointerleave", scheduleHoverClose);

    return () => {
      capsuleElement?.removeEventListener("pointerenter", clearHoverCloseTimeout);
      capsuleElement?.removeEventListener("pointerleave", scheduleHoverClose);
      clearHoverCloseTimeout();
    };
  }, [close, isOpen]);

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
            clearHoverCloseTimeout();
            close();
            return;
          }
          clearHoverCloseTimeout();
          open();
        }}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <ChevronDown size={16} />
        <span className="sr-only">{placeholder ?? ariaLabel}</span>
      </button>

      <FloatingMenuPanel
        align="center"
        anchorRef={capsuleRef}
        gap={0}
        id={listboxId}
        menuRef={menuRef}
        onPointerEnter={clearHoverCloseTimeout}
        open={isOpen}
        width={PROVIDER_PICKER_MENU_WIDTH}
      >
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
              onClick={() => commitIndex(index)}
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
      </FloatingMenuPanel>
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
