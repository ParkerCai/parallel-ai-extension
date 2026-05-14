import { Fragment, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type GroupImperativeHandle,
} from "react-resizable-panels";

import { EmptyPanelSlot } from "@/multi-panel/components/EmptyPanelSlot";
import { PanelFrame } from "@/multi-panel/components/PanelFrame";
import { getColumnPanelId, getPanelUrl, getRowPanelId } from "@/multi-panel/lib/panel-layout";
import { ALL_PROVIDER_IDS, getProviderById, type Provider, type ProviderId } from "@/shared/lib/providers";
import type { GoogleProviderMode, PanelProviderSlot } from "@/shared/lib/settings";
import { LAYOUTS, type LayoutId } from "@/shared/lib/layouts";

interface PanelWorkspaceProps {
  focusedSlotIndex: number | null;
  googleMode: GoogleProviderMode;
  horizontalPanelGroupRefs: MutableRefObject<Record<number, GroupImperativeHandle | null>>;
  layout: LayoutId;
  loadingProviders: Record<string, boolean>;
  mainCanvasRef: RefObject<HTMLElement>;
  panelDragSourceIndex: number | null;
  panelDragTargetIndex: number | null;
  panelSlotRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  providerOptions: Provider[];
  slotProviders: PanelProviderSlot[];
  temporaryChatEnabled: boolean;
  verticalPanelGroupRef: RefObject<GroupImperativeHandle>;
  onBeginPanelDrag: (index: number, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCloseFocus: () => void;
  onFocusPanel: (index: number) => void;
  onOpenFocusedInTab: () => void;
  onRefreshProvider: (providerId: ProviderId) => void;
  onRegisterFrameHost: (
    providerId: ProviderId,
    src: string,
    title: string,
    element: HTMLDivElement | null,
  ) => void;
  onRemovePanel: (index: number) => void;
  onResetHorizontalPanelLayout: (rowIndex: number, columnCount: number) => void;
  onResetVerticalPanelLayout: () => void;
  onSwitchPanelProvider: (index: number, providerId: ProviderId) => void;
}

export function PanelWorkspace({
  focusedSlotIndex,
  googleMode,
  horizontalPanelGroupRefs,
  layout,
  loadingProviders,
  mainCanvasRef,
  panelDragSourceIndex,
  panelDragTargetIndex,
  panelSlotRefs,
  providerOptions,
  slotProviders,
  temporaryChatEnabled,
  verticalPanelGroupRef,
  onBeginPanelDrag,
  onCloseFocus,
  onFocusPanel,
  onOpenFocusedInTab,
  onRefreshProvider,
  onRegisterFrameHost,
  onRemovePanel,
  onResetHorizontalPanelLayout,
  onResetVerticalPanelLayout,
  onSwitchPanelProvider,
}: PanelWorkspaceProps) {
  const isFocusActive = focusedSlotIndex !== null;
  let slotCursor = 0;
  const mainCanvasRect = mainCanvasRef.current?.getBoundingClientRect() ?? null;
  const providerOrder = new Map(ALL_PROVIDER_IDS.map((providerId, index) => [providerId, index]));
  const overlayPanels = slotProviders
    .flatMap((providerId, slotIndex) => {
      const slotElement = panelSlotRefs.current[slotIndex];

      if (!providerId || !slotElement || !mainCanvasRect) {
        return [];
      }

      const provider = getProviderById(providerId);
      if (!provider) {
        return [];
      }

      const slotRect = slotElement.getBoundingClientRect();
      if (!slotRect.width || !slotRect.height) {
        return [];
      }

      return [
        {
          left: slotRect.left - mainCanvasRect.left,
          provider,
          slotIndex,
          top: slotRect.top - mainCanvasRect.top,
          width: slotRect.width,
          height: slotRect.height,
        },
      ];
    })
    .sort(
      (left, right) =>
        (providerOrder.get(left.provider.id) ?? Number.MAX_SAFE_INTEGER) -
        (providerOrder.get(right.provider.id) ?? Number.MAX_SAFE_INTEGER),
    );

  return (
    <main
      className={`absolute inset-0 ${isFocusActive ? "z-50" : "z-0"}`}
      ref={mainCanvasRef}
    >
      <PanelGroup className="h-full" groupRef={verticalPanelGroupRef} orientation="vertical">
        {LAYOUTS[layout].rows.map((columnCount, rowIndex) => (
          <Fragment key={`${layout}-${rowIndex}`}>
            <Panel
              defaultSize={100 / LAYOUTS[layout].rows.length}
              id={getRowPanelId(layout, rowIndex)}
              minSize={12}
            >
              <PanelGroup
                className="h-full"
                groupRef={(handle) => {
                  horizontalPanelGroupRefs.current[rowIndex] = handle;
                }}
                orientation="horizontal"
              >
                {Array.from({ length: columnCount }).map((_, columnIndex) => {
                  const slotIndex = slotCursor;
                  const providerId = slotProviders[slotCursor++];
                  const provider = providerId ? getProviderById(providerId) : null;
                  return (
                    <Fragment key={`${layout}-${rowIndex}-${columnIndex}`}>
                      <Panel
                        defaultSize={100 / columnCount}
                        id={getColumnPanelId(layout, rowIndex, columnIndex)}
                        minSize={12}
                      >
                        <div
                          className="h-full"
                          ref={(element) => {
                            panelSlotRefs.current[slotIndex] = element;
                          }}
                        >
                          {provider ? (
                            <div className="h-full bg-[hsl(var(--surface-provider-panel)/0.98)]" />
                          ) : (
                            <EmptyPanelSlot
                              dragState={
                                panelDragSourceIndex === slotIndex
                                  ? "source"
                                  : panelDragTargetIndex === slotIndex
                                    ? "target"
                                    : "idle"
                              }
                              onBeginReorder={(event) => onBeginPanelDrag(slotIndex, event)}
                              onRemove={() => onRemovePanel(slotIndex)}
                              onSwitchProvider={(nextProviderId) =>
                                onSwitchPanelProvider(slotIndex, nextProviderId)
                              }
                              providerOptions={providerOptions}
                            />
                          )}
                        </div>
                      </Panel>
                      {columnIndex < columnCount - 1 ? (
                        <PanelResizeHandle
                          className="resize-handle resize-handle-horizontal"
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onResetHorizontalPanelLayout(rowIndex, columnCount);
                          }}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </PanelGroup>
            </Panel>
            {rowIndex < LAYOUTS[layout].rows.length - 1 ? (
              <PanelResizeHandle
                className="resize-handle resize-handle-vertical"
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onResetVerticalPanelLayout();
                }}
              />
            ) : null}
          </Fragment>
        ))}
      </PanelGroup>

      <div className="pointer-events-none absolute inset-0 z-20">
        {isFocusActive ? (
          <div
            className="pointer-events-auto absolute inset-0 z-30 bg-[hsl(var(--shadow-ambient)/0.45)] backdrop-blur-sm"
            onClick={onCloseFocus}
          />
        ) : null}
        {overlayPanels.map(({ height, left, provider, slotIndex, top, width }) => {
          const isFocused = slotIndex === focusedSlotIndex;
          const containerStyle = isFocused
            ? {
              position: "fixed" as const,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(64rem, 92vw)",
              height: "96vh",
              borderRadius: 28,
              overflow: "hidden",
              boxShadow:
                "0 30px 120px -40px hsl(var(--shadow-ambient) / 0.95)",
            }
            : { height, left, top, width };
          return (
            <div
              className={`pointer-events-auto absolute ${isFocused ? "squircle z-40" : ""}`}
              key={provider.id}
              style={containerStyle}
            >
              <PanelFrame
                dragState={
                  panelDragSourceIndex === slotIndex
                    ? "source"
                    : panelDragTargetIndex === slotIndex
                      ? "target"
                      : "idle"
                }
                focused={isFocused}
                loading={loadingProviders[provider.id] ?? true}
                mountFrameHost={(element) =>
                  onRegisterFrameHost(
                    provider.id,
                    getPanelUrl(provider, googleMode, temporaryChatEnabled),
                    provider.name,
                    element,
                  )
                }
                onBeginReorder={(event) => onBeginPanelDrag(slotIndex, event)}
                onOpenInTab={isFocused ? onOpenFocusedInTab : undefined}
                onRefresh={() => onRefreshProvider(provider.id)}
                onRemove={() => onRemovePanel(slotIndex)}
                onSwitchProvider={(nextProviderId) => onSwitchPanelProvider(slotIndex, nextProviderId)}
                onToggleFocus={() => onFocusPanel(slotIndex)}
                provider={provider}
                providerOptions={providerOptions}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}
