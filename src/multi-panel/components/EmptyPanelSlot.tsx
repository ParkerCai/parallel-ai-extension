import { X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  PanelControlCapsule,
  PanelControlIconButton,
  PanelProviderPicker,
  PanelReorderButton,
} from "@/multi-panel/components/PanelControlCapsule";
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
      <PanelControlCapsule variant="compact">
        <PanelProviderPicker
          ariaLabel="Add chat pane to empty slot"
          onChange={onSwitchProvider}
          options={providerOptions}
          placeholder="Add pane"
          resetAfterChange
          tooltip="Add chat pane"
          value=""
        />

        <PanelReorderButton
          ariaLabel="Drag empty slot to reorder"
          dragState={dragState}
          onPointerDown={onBeginReorder}
          tooltip="Drag to swap this slot with another."
        />

        <PanelControlIconButton
          aria-label="Close empty slot"
          danger
          onClick={onRemove}
          tooltip="Close empty slot"
        >
          <X size={12} />
        </PanelControlIconButton>
      </PanelControlCapsule>

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
