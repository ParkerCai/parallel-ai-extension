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
      className={`relative flex h-full min-h-[280px] items-center justify-center bg-[hsl(var(--surface-provider-panel)/0.98)] transition-[opacity,transform] duration-150 ${dragState === "source" ? "scale-[0.994] opacity-72" : ""
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
          <X size={16} />
        </PanelControlIconButton>
      </PanelControlCapsule>

      {dragState === "target" ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-[11] bg-[hsl(var(--accent-cool)/0.12)]" />
          <div className="pointer-events-none absolute inset-0 z-[12] bg-[linear-gradient(180deg,hsl(var(--accent-cool)/0.2),hsl(var(--accent-cool)/0.08))] shadow-[inset_0_0_0_1px_hsl(var(--accent-cool)/0.52),inset_0_0_0_2px_hsl(var(--accent-cool)/0.28),inset_0_0_48px_hsl(var(--accent-cool)/0.12)]" />
        </>
      ) : null}

      <div className="relative z-[13] max-w-[240px] text-center">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Empty slot</p>
        <p className="mt-2 text-sm text-[hsl(var(--foreground-muted))]">
          Drag a pane here to rearrange the workspace.
        </p>
      </div>
    </div>
  );
}
