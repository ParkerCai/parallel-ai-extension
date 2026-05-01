import { ChevronDown, X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { PanelDragState } from "@/multi-panel/types";
import type { Provider, ProviderId } from "@/shared/lib/providers";

interface EmptyPanelSlotProps {
  dragState?: PanelDragState;
  onBeginReorder: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  onSwitchProvider: (providerId: ProviderId) => void;
  providerOptions: Provider[];
}

export function EmptyPanelSlot({
  dragState = "idle",
  onBeginReorder,
  onRemove,
  onSwitchProvider,
  providerOptions,
}: EmptyPanelSlotProps) {
  return (
    <div
      className={`relative flex h-full min-h-[280px] items-center justify-center bg-[rgba(13,16,24,0.98)] transition-[opacity,transform] duration-150 ${dragState === "source" ? "scale-[0.994] opacity-72" : ""
        }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-4">
        <div className="group/panel-controls pointer-events-auto relative">
          <div className="relative inline-flex h-[18px] w-[96px] items-center justify-center overflow-hidden rounded-full bg-[rgba(45,45,45,0.42)] px-0 py-0 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] backdrop-blur-[2px] transition-[height,padding,box-shadow] duration-200 ease-out group-hover/panel-controls:h-[38px] group-hover/panel-controls:w-[96px] group-hover/panel-controls:px-1.5 group-hover/panel-controls:py-1.5 group-focus-within/panel-controls:h-[38px] group-focus-within/panel-controls:w-[96px] group-focus-within/panel-controls:px-1.5 group-focus-within/panel-controls:py-1.5">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#23252b] shadow-[0_0_8px_rgba(35,37,43,0.22)] transition-all duration-150 ease-out group-hover/panel-controls:w-0 group-hover/panel-controls:opacity-0 group-focus-within/panel-controls:w-0 group-focus-within/panel-controls:opacity-0" />

            <div className="flex items-center gap-1 opacity-0 transition-all duration-150 ease-out group-hover/panel-controls:opacity-100 group-focus-within/panel-controls:opacity-100">
              <div className="relative">
                <select
                  aria-label="Add chat pane to empty slot"
                  className="pointer-events-none absolute inset-0 cursor-pointer opacity-0 group-hover/panel-controls:pointer-events-auto group-focus-within/panel-controls:pointer-events-auto"
                  data-tooltip="Add chat pane"
                  onChange={(event) => {
                    onSwitchProvider(event.target.value as ProviderId);
                    event.currentTarget.value = "";
                  }}
                  value=""
                >
                  <option disabled value="">
                    Add pane
                  </option>
                  {providerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition hover:bg-white/14">
                  <ChevronDown size={13} />
                </span>
              </div>

              <button
                aria-label="Drag empty slot to reorder"
                className={`pointer-events-none inline-flex h-6 min-w-[22px] items-center justify-center rounded-full bg-white/8 px-1.5 text-white/70 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-white group-hover/panel-controls:pointer-events-auto group-focus-within/panel-controls:pointer-events-auto ${dragState === "source" ? "cursor-grabbing" : "cursor-grab"
                  }`}
                data-tooltip="Drag to swap this slot with another."
                onPointerDown={onBeginReorder}
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

              <button
                aria-label="Close empty slot"
                className="pointer-events-none inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition hover:bg-[hsl(var(--danger))]/22 hover:text-[hsl(var(--danger-text))] group-hover/panel-controls:pointer-events-auto group-focus-within/panel-controls:pointer-events-auto"
                data-tooltip="Close empty slot"
                onClick={onRemove}
                type="button"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {dragState === "target" ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-[11] bg-[rgba(186,230,253,0.12)]" />
          <div className="pointer-events-none absolute inset-0 z-[12] bg-[linear-gradient(180deg,rgba(224,242,254,0.2),rgba(125,211,252,0.08))] shadow-[inset_0_0_0_1px_rgba(224,242,254,0.52),inset_0_0_0_2px_rgba(125,211,252,0.28),inset_0_0_48px_rgba(186,230,253,0.12)]" />
        </>
      ) : null}

      <div className="relative z-[13] max-w-[240px] text-center">
        <p className="text-sm font-semibold text-white">Empty slot</p>
        <p className="mt-2 text-sm text-[hsl(var(--foreground-muted))]">
          Drag a pane here to rearrange the workspace.
        </p>
      </div>
    </div>
  );
}
