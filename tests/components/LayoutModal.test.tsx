import { describe, expect, it, vi } from "vitest";

import { LayoutModal } from "@/multi-panel/components/LayoutModal";
import { ALL_LAYOUTS } from "@/shared/lib/layouts";
import { renderWithProviders } from "../helpers/render";

function renderLayoutModal(overrides: Partial<Parameters<typeof LayoutModal>[0]> = {}) {
  const onClose = vi.fn();
  const onSelectLayout = vi.fn();
  const utils = renderWithProviders(
    <LayoutModal
      currentLayout="1x3"
      onClose={onClose}
      onSelectLayout={onSelectLayout}
      open
      {...overrides}
    />,
  );
  return { ...utils, onClose, onSelectLayout };
}

describe("LayoutModal", () => {
  it("renders nothing when open=false", () => {
    const { queryByRole } = renderLayoutModal({ open: false });
    expect(queryByRole("dialog")).toBeNull();
    expect(document.body.textContent).not.toContain("Layout");
  });

  function getLayoutButton(container: HTMLElement, layoutId: string) {
    // i18n in tests returns the key with substitutions appended.
    const button = container.querySelector(
      `button[data-tooltip*="(${layoutId})"]`,
    ) as HTMLButtonElement | null;
    if (!button) throw new Error(`no layout button for ${layoutId}`);
    return button;
  }

  it("renders all known layouts as buttons when open", () => {
    const { container } = renderLayoutModal();
    for (const layout of ALL_LAYOUTS) {
      expect(getLayoutButton(container, layout.id)).toBeInTheDocument();
    }
  });

  it("invokes onSelectLayout with the layout id when a tile is clicked", async () => {
    const { container, onSelectLayout, user } = renderLayoutModal();
    await user.click(getLayoutButton(container, "2x2"));
    expect(onSelectLayout).toHaveBeenCalledWith("2x2");
  });

  it("highlights the current layout's tile with the accent border style", () => {
    const { container } = renderLayoutModal({ currentLayout: "2x2" });
    const selected = getLayoutButton(container, "2x2");
    const other = getLayoutButton(container, "1x3");
    expect(selected.className).toContain("border-[hsl(var(--accent-strong))]");
    expect(other.className).not.toContain("border-[hsl(var(--accent-strong))]");
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const { container, onClose, user } = renderLayoutModal();
    const backdrop = container.ownerDocument.querySelector(
      ".fixed.inset-0.z-50",
    ) as HTMLElement;
    expect(backdrop).not.toBeNull();
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exposes a Close modal button that calls onClose", async () => {
    const { getByRole, onClose, user } = renderLayoutModal();
    await user.click(getByRole("button", { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
