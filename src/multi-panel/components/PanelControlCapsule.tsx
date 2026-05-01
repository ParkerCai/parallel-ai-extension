import { ChevronDown } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import type { PanelDragState } from "@/multi-panel/types";
import type { Provider, ProviderId } from "@/shared/lib/providers";

const CAPSULE_VARIANTS = {
  compact: {
    barWidth: "w-[87px]",
    width:
      "w-[96px] group-hover/panel-controls:w-[96px] group-focus-within/panel-controls:w-[96px]",
  },
  wide: {
    barWidth: "w-[110px]",
    width:
      "w-[119px] group-hover/panel-controls:w-[128px] group-focus-within/panel-controls:w-[128px]",
  },
} as const;

const interactiveStateClass =
  "pointer-events-none group-hover/panel-controls:pointer-events-auto group-focus-within/panel-controls:pointer-events-auto";

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
          className={`relative inline-flex h-[12px] ${variantClass.width} items-center justify-center overflow-hidden rounded-full bg-[rgba(45,45,45,0.42)] px-0 py-0 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] backdrop-blur-[2px] transition-[height,padding,box-shadow] duration-200 ease-out group-hover/panel-controls:h-[38px] group-hover/panel-controls:px-1.5 group-hover/panel-controls:py-1.5 group-focus-within/panel-controls:h-[38px] group-focus-within/panel-controls:px-1.5 group-focus-within/panel-controls:py-1.5`}
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
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        className={`${interactiveStateClass} absolute inset-0 cursor-pointer opacity-0`}
        data-tooltip={tooltip}
        onChange={(event) => {
          onChange(event.target.value as ProviderId);
          if (resetAfterChange) {
            event.currentTarget.value = "";
          }
        }}
        value={value}
      >
        {placeholder ? (
          <option disabled value="">
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition hover:bg-white/14">
        <ChevronDown size={13} />
      </span>
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
      className={`${interactiveStateClass} inline-flex h-6 min-w-[22px] items-center justify-center rounded-full bg-white/8 px-1.5 text-white/70 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-white ${dragState === "source" ? "cursor-grabbing" : "cursor-grab"
        }`}
      data-tooltip={tooltip}
      onPointerDown={onPointerDown}
      type="button"
    >
      <span className="grid grid-cols-3 place-items-center gap-x-1 gap-y-0.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className="h-[2px] w-[2px] rounded-full bg-current opacity-85"
          />
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
      className={`${interactiveStateClass} inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition ${hoverClass}`}
      data-tooltip={tooltip}
      type="button"
    >
      {children}
    </button>
  );
}
