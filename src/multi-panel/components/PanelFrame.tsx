import { Expand, ExternalLink, RefreshCcw, X } from "lucide-react";
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
  focused?: boolean;
  loading: boolean;
  mountFrameHost: (element: HTMLDivElement | null) => void;
  onBeginReorder: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onOpenInTab?: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  onSwitchProvider: (providerId: ProviderId) => void;
  onToggleFocus?: () => void;
  provider: Provider;
  providerOptions: Provider[];
}

export function PanelFrame({
  dragState,
  focused = false,
  loading,
  mountFrameHost,
  onBeginReorder,
  onOpenInTab,
  onRefresh,
  onRemove,
  onSwitchProvider,
  onToggleFocus,
  provider,
  providerOptions,
}: PanelFrameProps) {
  return (
    <div
      className={`relative h-full min-h-[280px] overflow-hidden bg-[hsl(var(--surface-provider-panel)/0.98)] transition-[opacity,transform,box-shadow] duration-150 ${dragState === "source" ? "scale-[0.994] opacity-72" : ""
        }`}
    >
      <PanelControlCapsule variant="wide">
        <PanelProviderPicker
          ariaLabel="Change to another provider"
          onChange={onSwitchProvider}
          options={providerOptions}
          tooltip="Change to another provider"
          value={provider.id}
        />

        <PanelReorderButton
          ariaLabel="Drag to swap this panel with another"
          dragState={dragState}
          onPointerDown={onBeginReorder}
          tooltip="Drag to swap this panel with another"
        />

        {focused ? (
          <PanelControlIconButton
            aria-label="Open this on new tab"
            onClick={onOpenInTab}
            tooltip="Open this on new tab"
          >
            <ExternalLink size={16} />
          </PanelControlIconButton>
        ) : (
          <PanelControlIconButton
            aria-label={`Focus ${provider.name}`}
            onClick={onToggleFocus}
            tooltip={`Focus ${provider.name}`}
          >
            <Expand size={16} />
          </PanelControlIconButton>
        )}

        <PanelControlIconButton
          aria-label="New chat on this panel"
          onClick={onRefresh}
          tooltip="New chat on this panel"
        >
          <RefreshCcw size={16} />
        </PanelControlIconButton>

        <PanelControlIconButton
          aria-label="Close this panel"
          danger
          onClick={onRemove}
          tooltip="Close this panel"
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

      <div className="relative h-full min-h-0">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--surface-modal)/0.80)] backdrop-blur-sm">
            <div className="space-y-3 text-center">
              <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-[hsl(var(--tint-base)/0.10)]" />
              <p className="text-sm text-[hsl(var(--foreground-muted))]">
                Spinning up {provider.name}
              </p>
            </div>
          </div>
        ) : null}
        <div className="h-full w-full bg-[hsl(var(--surface-provider-frame))]" ref={mountFrameHost} />
      </div>
    </div>
  );
}
