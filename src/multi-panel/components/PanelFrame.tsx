import { RefreshCcw, X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  PanelControlCapsule,
  PanelControlIconButton,
  PanelProviderPicker,
  PanelReorderButton,
} from "@/multi-panel/components/PanelControlCapsule";
import type { PanelDragState } from "@/multi-panel/types";
import type { Provider, ProviderId } from "@/shared/lib/providers";

interface PanelFrameProps {
  dragState: PanelDragState;
  loading: boolean;
  mountFrameHost: (element: HTMLDivElement | null) => void;
  onBeginReorder: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRefresh: () => void;
  onRemove: () => void;
  onSwitchProvider: (providerId: ProviderId) => void;
  provider: Provider;
  providerOptions: Provider[];
}

export function PanelFrame({
  dragState,
  loading,
  mountFrameHost,
  onBeginReorder,
  onRefresh,
  onRemove,
  onSwitchProvider,
  provider,
  providerOptions,
}: PanelFrameProps) {
  return (
    <div
      className={`relative h-full min-h-[280px] overflow-hidden bg-[rgba(13,16,24,0.98)] transition-[opacity,transform,box-shadow] duration-150 ${dragState === "source" ? "scale-[0.994] opacity-72" : ""
        }`}
    >
      <PanelControlCapsule variant="wide">
        <PanelProviderPicker
          ariaLabel={`Switch ${provider.name} provider`}
          onChange={onSwitchProvider}
          options={providerOptions}
          tooltip={`Switch ${provider.name} provider`}
          value={provider.id}
        />

        <PanelReorderButton
          ariaLabel={`Drag ${provider.name} panel to reorder`}
          dragState={dragState}
          onPointerDown={onBeginReorder}
          tooltip="Drag to swap this panel with another."
        />

        <PanelControlIconButton
          aria-label={`Refresh ${provider.name}`}
          onClick={onRefresh}
          tooltip={`Refresh ${provider.name}`}
        >
          <RefreshCcw size={16} />
        </PanelControlIconButton>

        <PanelControlIconButton
          aria-label={`Close ${provider.name}`}
          danger
          onClick={onRemove}
          tooltip={`Close ${provider.name}`}
        >
          <X size={16} />
        </PanelControlIconButton>
      </PanelControlCapsule>

      {dragState === "target" ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-[11] bg-[rgba(186,230,253,0.12)]" />
          <div className="pointer-events-none absolute inset-0 z-[12] bg-[linear-gradient(180deg,rgba(224,242,254,0.2),rgba(125,211,252,0.08))] shadow-[inset_0_0_0_1px_rgba(224,242,254,0.52),inset_0_0_0_2px_rgba(125,211,252,0.28),inset_0_0_48px_rgba(186,230,253,0.12)]" />
        </>
      ) : null}

      <div className="relative h-full min-h-0">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--panel))]/80 backdrop-blur-sm">
            <div className="space-y-3 text-center">
              <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-white/10" />
              <p className="text-sm text-[hsl(var(--foreground-muted))]">
                Spinning up {provider.name}
              </p>
            </div>
          </div>
        ) : null}
        <div className="h-full w-full bg-[#131313]" ref={mountFrameHost} />
      </div>
    </div>
  );
}
