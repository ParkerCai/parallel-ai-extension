import { createRef, type MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { PanelWorkspace } from "@/multi-panel/components/PanelWorkspace";
import { PROVIDERS } from "@/shared/lib/providers";
import { renderWithProviders } from "../helpers/render";

function makeRef<T>(initial: T) {
  return { current: initial } as MutableRefObject<T>;
}

function renderWorkspace(
  overrides: Partial<Parameters<typeof PanelWorkspace>[0]> = {},
) {
  const handlers = {
    onBeginPanelDrag: vi.fn(),
    onCloseFocus: vi.fn(),
    onFocusPanel: vi.fn(),
    onOpenFocusedInTab: vi.fn(),
    onRefreshProvider: vi.fn(),
    onRegisterFrameHost: vi.fn(),
    onRemovePanel: vi.fn(),
    onResetHorizontalPanelLayout: vi.fn(),
    onResetVerticalPanelLayout: vi.fn(),
    onSwitchPanelProvider: vi.fn(),
  };

  const utils = renderWithProviders(
    <PanelWorkspace
      focusedSlotIndex={null}
      googleMode="ai"
      horizontalPanelGroupRefs={makeRef({})}
      layout="1x2"
      loadingProviders={{}}
      mainCanvasRef={createRef<HTMLElement>()}
      panelDragSourceIndex={null}
      panelDragTargetIndex={null}
      panelSlotRefs={makeRef({})}
      providerOptions={[...PROVIDERS]}
      slotProviders={[null, null]}
      temporaryChatEnabled={false}
      verticalPanelGroupRef={createRef()}
      {...handlers}
      {...overrides}
    />,
  );
  return { ...utils, handlers };
}

describe("PanelWorkspace", () => {
  it("renders one empty slot per layout cell when no providers are assigned", () => {
    const { container } = renderWorkspace();
    const emptySlots = container.querySelectorAll(
      'button[aria-label="Close empty slot"]',
    );
    expect(emptySlots).toHaveLength(2);
  });

  it("renders three slots for the 1x3 layout", () => {
    const { container } = renderWorkspace({ layout: "1x3", slotProviders: [null, null, null] });
    const emptySlots = container.querySelectorAll(
      'button[aria-label="Close empty slot"]',
    );
    expect(emptySlots).toHaveLength(3);
  });

  it("invokes onRemovePanel with the slot index when an empty slot's close button is clicked", async () => {
    const { container, handlers, user } = renderWorkspace({
      layout: "1x2",
      slotProviders: [null, null],
    });
    const buttons = container.querySelectorAll(
      'button[aria-label="Close empty slot"]',
    );
    await user.click(buttons[1] as HTMLButtonElement);
    expect(handlers.onRemovePanel).toHaveBeenCalledWith(1);
  });
});
