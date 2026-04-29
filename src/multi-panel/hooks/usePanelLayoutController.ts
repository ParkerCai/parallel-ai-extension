import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";

import { DEFAULT_PANEL_PROVIDERS } from "@/shared/lib/constants";
import {
  DEFAULT_LAYOUT,
  getBestLayoutForPanelCount,
  getLayoutCellCount,
  LAYOUTS,
  type LayoutId,
} from "@/shared/lib/layouts";
import type { ProviderId } from "@/shared/lib/providers";
import type { ExtensionSettings, PanelProviderSlot } from "@/shared/lib/settings";
import {
  buildEqualGroupLayout,
  getActivePanelProviders,
  getColumnPanelId,
  getRowPanelId,
  resizePanelProviders,
  trimTrailingEmptyPanelSlots,
} from "@/multi-panel/lib/panel-layout";

interface UsePanelLayoutControllerOptions {
  enabledProviders: ProviderId[];
  isHydrated: boolean;
  showStatus: (message: string) => void;
  updateSetting: <Key extends keyof ExtensionSettings>(
    key: Key,
    value: ExtensionSettings[Key],
  ) => Promise<void>;
}

export function usePanelLayoutController({
  enabledProviders,
  isHydrated,
  showStatus,
  updateSetting,
}: UsePanelLayoutControllerOptions) {
  const [layout, setLayout] = useState<LayoutId>(DEFAULT_LAYOUT);
  const [panelProviders, setPanelProviders] =
    useState<PanelProviderSlot[]>(DEFAULT_PANEL_PROVIDERS);
  const [panelDragSourceIndex, setPanelDragSourceIndex] = useState<number | null>(null);
  const [panelDragTargetIndex, setPanelDragTargetIndex] = useState<number | null>(null);

  const verticalPanelGroupRef = useRef<GroupImperativeHandle | null>(null);
  const horizontalPanelGroupRefs = useRef<Record<number, GroupImperativeHandle | null>>({});
  const panelSlotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const panelDragRef = useRef<{
    handle: HTMLButtonElement;
    pointerId: number;
    sourceIndex: number;
  } | null>(null);
  const panelDragTargetRef = useRef<number | null>(null);

  function hydratePanelLayout(
    nextLayout: LayoutId,
    nextPanelProviders: PanelProviderSlot[],
    nextEnabledProviders: ProviderId[],
  ) {
    setLayout(nextLayout);
    setPanelProviders(
      resizePanelProviders(nextPanelProviders, nextEnabledProviders, nextLayout),
    );
  }

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const nextPanels = resizePanelProviders(panelProviders, enabledProviders, layout);

    if (nextPanels.join("|") !== panelProviders.join("|")) {
      setPanelProviders(nextPanels);
    }
  }, [enabledProviders, isHydrated, layout, panelProviders]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void updateSetting("currentLayout", layout);
  }, [isHydrated, layout, updateSetting]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void updateSetting("panelProviders", panelProviders);
  }, [isHydrated, panelProviders, updateSetting]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePanelDragPointerMove);
      window.removeEventListener("pointerup", handlePanelDragPointerUp);
      window.removeEventListener("pointercancel", handlePanelDragPointerUp);
      window.removeEventListener("blur", handlePanelDragCancel);
    };
  }, []);

  function resetVerticalPanelLayout() {
    const rowIds = LAYOUTS[layout].rows.map((_, rowIndex) => getRowPanelId(layout, rowIndex));
    verticalPanelGroupRef.current?.setLayout(buildEqualGroupLayout(rowIds));
  }

  function resetHorizontalPanelLayout(rowIndex: number, columnCount: number) {
    const panelIds = Array.from({ length: columnCount }, (_, columnIndex) =>
      getColumnPanelId(layout, rowIndex, columnIndex),
    );
    horizontalPanelGroupRefs.current[rowIndex]?.setLayout(buildEqualGroupLayout(panelIds));
  }

  function updatePanelDragTarget(clientX: number, clientY: number) {
    const activeDrag = panelDragRef.current;
    if (!activeDrag) {
      return;
    }

    let nextTargetIndex: number | null = null;

    for (const [indexText, element] of Object.entries(panelSlotRefs.current)) {
      const slotIndex = Number(indexText);

      if (!element || slotIndex === activeDrag.sourceIndex || slotIndex >= getLayoutCellCount(layout)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        nextTargetIndex = slotIndex;
        break;
      }
    }

    panelDragTargetRef.current = nextTargetIndex;
    setPanelDragTargetIndex((current) => (current === nextTargetIndex ? current : nextTargetIndex));
  }

  function finishPanelDrag(commit: boolean) {
    const activeDrag = panelDragRef.current;
    if (!activeDrag) {
      return;
    }

    if (activeDrag.handle.hasPointerCapture?.(activeDrag.pointerId)) {
      activeDrag.handle.releasePointerCapture(activeDrag.pointerId);
    }

    const targetIndex = panelDragTargetRef.current;
    panelDragRef.current = null;
    panelDragTargetRef.current = null;
    setPanelDragSourceIndex(null);
    setPanelDragTargetIndex(null);
    window.removeEventListener("pointermove", handlePanelDragPointerMove);
    window.removeEventListener("pointerup", handlePanelDragPointerUp);
    window.removeEventListener("pointercancel", handlePanelDragPointerUp);
    window.removeEventListener("blur", handlePanelDragCancel);

    if (
      !commit ||
      targetIndex === null ||
      targetIndex === activeDrag.sourceIndex ||
      targetIndex >= getLayoutCellCount(layout) ||
      activeDrag.sourceIndex >= getLayoutCellCount(layout)
    ) {
      return;
    }

    setPanelProviders((current) => {
      const sourceProviderId = current[activeDrag.sourceIndex] ?? null;
      const targetProviderId = current[targetIndex] ?? null;

      if (
        activeDrag.sourceIndex === targetIndex ||
        (sourceProviderId === null && targetProviderId === null)
      ) {
        return current;
      }

      const nextPanels = [...current];
      const nextLength = Math.max(nextPanels.length, activeDrag.sourceIndex + 1, targetIndex + 1);

      while (nextPanels.length < nextLength) {
        nextPanels.push(null);
      }

      [nextPanels[activeDrag.sourceIndex], nextPanels[targetIndex]] = [
        targetProviderId,
        sourceProviderId,
      ];

      return trimTrailingEmptyPanelSlots(nextPanels);
    });
    showStatus("Panels reordered.");
  }

  function handlePanelDragPointerMove(event: PointerEvent) {
    if (!panelDragRef.current || panelDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if ((event.buttons & 1) !== 1) {
      finishPanelDrag(true);
      return;
    }

    event.preventDefault();
    updatePanelDragTarget(event.clientX, event.clientY);
  }

  function handlePanelDragPointerUp(event: PointerEvent) {
    if (!panelDragRef.current || panelDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    finishPanelDrag(true);
  }

  function handlePanelDragCancel() {
    finishPanelDrag(false);
  }

  function beginPanelDrag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || index >= getLayoutCellCount(layout)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture failures
    }

    panelDragRef.current = {
      handle: event.currentTarget,
      pointerId: event.pointerId,
      sourceIndex: index,
    };
    panelDragTargetRef.current = null;
    setPanelDragSourceIndex(index);
    setPanelDragTargetIndex(null);
    updatePanelDragTarget(event.clientX, event.clientY);
    window.addEventListener("pointermove", handlePanelDragPointerMove);
    window.addEventListener("pointerup", handlePanelDragPointerUp);
    window.addEventListener("pointercancel", handlePanelDragPointerUp);
    window.addEventListener("blur", handlePanelDragCancel);
  }

  function addPanel() {
    const cellCount = getLayoutCellCount(layout);
    const activePanelProviders = getActivePanelProviders(panelProviders);
    const nextProvider = enabledProviders.find(
      (providerId) => !activePanelProviders.includes(providerId),
    );

    if (!nextProvider) {
      showStatus("No additional enabled providers are available.");
      return;
    }

    const hasEmptyCurrentSlot = Array.from(
      { length: cellCount },
      (_, index) => panelProviders[index] ?? null,
    ).some((providerId) => providerId === null);
    const nextCount = activePanelProviders.length + 1;

    if (!hasEmptyCurrentSlot && activePanelProviders.length >= cellCount) {
      const nextLayout = getBestLayoutForPanelCount(nextCount, layout);
      if (nextLayout !== layout) {
        setLayout(nextLayout);
      }
    }

    setPanelProviders((current) => {
      const nextPanels = [...current];
      const targetSlotCount = Math.max(getLayoutCellCount(layout), nextPanels.length);
      let emptyIndex = -1;

      for (let index = 0; index < targetSlotCount; index += 1) {
        if ((nextPanels[index] ?? null) === null) {
          emptyIndex = index;
          break;
        }
      }

      if (emptyIndex === -1) {
        nextPanels.push(nextProvider);
      } else {
        while (nextPanels.length <= emptyIndex) {
          nextPanels.push(null);
        }

        nextPanels[emptyIndex] = nextProvider;
      }

      return trimTrailingEmptyPanelSlots(nextPanels);
    });
    showStatus("Added another provider panel.");
  }

  function removePanel(index: number) {
    const activePanelProviders = getActivePanelProviders(panelProviders);
    const removingActivePanel = Boolean(panelProviders[index]);

    if (removingActivePanel && activePanelProviders.length <= 1) {
      showStatus("At least one panel needs to stay open.");
      return;
    }

    const nextCount = removingActivePanel
      ? activePanelProviders.length - 1
      : activePanelProviders.length;
    const nextLayout = getBestLayoutForPanelCount(nextCount, layout);
    if (nextLayout !== layout) {
      setLayout(nextLayout);
    }

    setPanelProviders((current) =>
      removingActivePanel
        ? current.filter((providerId, currentIndex) => currentIndex !== index && providerId !== null)
        : activePanelProviders,
    );
  }

  function switchPanelProvider(index: number, nextProviderId: ProviderId) {
    setPanelProviders((current) => {
      const nextPanels = [...current];
      const existingIndex = nextPanels.indexOf(nextProviderId);

      if (existingIndex !== -1) {
        [nextPanels[index], nextPanels[existingIndex]] = [
          nextPanels[existingIndex],
          nextPanels[index],
        ];
        return trimTrailingEmptyPanelSlots(nextPanels);
      }

      while (nextPanels.length <= index) {
        nextPanels.push(null);
      }

      nextPanels[index] = nextProviderId;
      return trimTrailingEmptyPanelSlots(nextPanels);
    });
  }

  const slotCount = getLayoutCellCount(layout);
  const slotProviders = Array.from({ length: slotCount }, (_, index) => panelProviders[index] ?? null);

  return {
    addPanel,
    beginPanelDrag,
    hydratePanelLayout,
    horizontalPanelGroupRefs,
    layout,
    panelDragSourceIndex,
    panelDragTargetIndex,
    panelProviders,
    panelSlotRefs,
    removePanel,
    resetHorizontalPanelLayout,
    resetVerticalPanelLayout,
    setLayout,
    setPanelProviders,
    slotCount,
    slotProviders,
    switchPanelProvider,
    verticalPanelGroupRef,
  };
}
