import { createRef, type MutableRefObject } from "react";
import { fireEvent } from "@testing-library/react";
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
    onCommitFocusModalWidth: vi.fn(),
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
      focusModalWidth={1024}
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
      usageByProvider={{}}
      usageStripEnabled={false}
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

  it("invokes onSwitchPanelProvider when a provider is chosen for an empty slot", async () => {
    const { getAllByRole, getByRole, handlers, user } = renderWorkspace({
      layout: "1x2",
      slotProviders: [null, null],
    });
    await user.click(getAllByRole("combobox", { name: /add chat pane to empty slot/i })[0]!);
    await user.click(getByRole("option", { name: /^Grok$/i }));
    expect(handlers.onSwitchPanelProvider).toHaveBeenCalledWith(0, "grok");
  });

  function renderFocusedWorkspace(
    overrides: Partial<Parameters<typeof PanelWorkspace>[0]> = {},
  ) {
    const mainCanvasRef = makeRef({
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    } as HTMLElement);
    const panelSlotRefs = makeRef({
      0: {
        getBoundingClientRect: () => ({
          height: 500,
          left: 10,
          top: 20,
          width: 600,
        }),
      } as HTMLDivElement,
    });

    return renderWorkspace({
      focusedSlotIndex: 0,
      mainCanvasRef,
      panelSlotRefs,
      slotProviders: ["chatgpt", null],
      ...overrides,
    });
  }

  it("renders the focused panel with both resize handles", () => {
    const { getByRole } = renderFocusedWorkspace({ focusModalWidth: 900 });

    const leftHandle = getByRole("button", { name: /resize focus view from the left edge/i });
    getByRole("button", { name: /resize focus view from the right edge/i });

    // The handles are siblings of the focused modal; the modal carries the
    // squircle clip. (jsdom drops the CSS `min(...)` width, so the persisted
    // value is asserted via the resize test below instead.)
    expect(leftHandle.previousElementSibling).toHaveClass("squircle");
  });

  it("resets the focus modal width to the default on double-click", () => {
    const { getByRole, handlers } = renderFocusedWorkspace({ focusModalWidth: 700 });

    fireEvent.doubleClick(
      getByRole("button", { name: /resize focus view from the right edge/i }),
    );

    expect(handlers.onCommitFocusModalWidth).toHaveBeenCalledWith(1024);
  });

  it("persists the focus modal width after a pointer resize", () => {
    const { getByRole, handlers } = renderFocusedWorkspace({ focusModalWidth: 600 });

    const handle = getByRole("button", { name: /resize focus view from the right edge/i });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 150, buttons: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    // Right edge moves +50px, symmetric resize doubles it: 600 + 100 = 700.
    expect(handlers.onCommitFocusModalWidth).toHaveBeenCalledWith(700);
  });
});
