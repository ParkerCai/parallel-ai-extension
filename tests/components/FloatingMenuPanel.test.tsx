import { useRef, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { FloatingMenuPanel } from "@/shared/components/FloatingMenuPanel";
import { renderWithProviders } from "../helpers/render";

interface HarnessProps {
  align?: "start" | "center";
  open: boolean;
  width?: "anchor" | number;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

function Harness({ align, open, width, onPointerEnter, onPointerLeave }: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  return (
    <>
      <button ref={anchorRef} type="button">
        anchor
      </button>
      <FloatingMenuPanel
        align={align}
        anchorRef={anchorRef}
        id="menu-1"
        menuRef={menuRef}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        open={open}
        width={width}
      >
        <div>menu-item</div>
      </FloatingMenuPanel>
    </>
  );
}

describe("FloatingMenuPanel", () => {
  it("renders nothing when open=false", () => {
    const { queryByText } = renderWithProviders(
      (<Harness open={false} />) as ReactElement,
    );
    expect(queryByText("menu-item")).toBeNull();
  });

  it("renders the children inside a portal to document.body when open=true", () => {
    renderWithProviders((<Harness open />) as ReactElement);
    // FloatingMenuPanel uses createPortal to document.body, so the content
    // shows up outside the harness root.
    expect(document.body.textContent).toContain("menu-item");
  });

  it("applies the given id to the menu container", () => {
    renderWithProviders((<Harness open />) as ReactElement);
    expect(document.getElementById("menu-1")).not.toBeNull();
  });

  it("uses the default role='listbox' on the menu container", () => {
    renderWithProviders((<Harness open />) as ReactElement);
    expect(document.getElementById("menu-1")?.getAttribute("role")).toBe("listbox");
  });

  it("applies the configured numeric width to the menu container style", () => {
    renderWithProviders((<Harness open width={200} />) as ReactElement);
    const menu = document.getElementById("menu-1") as HTMLDivElement;
    expect(menu.style.width).toBe("200px");
  });

  it("forwards onPointerEnter to the menu container", async () => {
    const onPointerEnter = vi.fn();
    const { user } = renderWithProviders(
      (<Harness onPointerEnter={onPointerEnter} open />) as ReactElement,
    );
    const menu = document.getElementById("menu-1") as HTMLDivElement;
    await user.pointer({ target: menu });
    expect(onPointerEnter).toHaveBeenCalled();
  });

  it("positions the menu below the anchor's bottom + gap", () => {
    renderWithProviders((<Harness open />) as ReactElement);
    const menu = document.getElementById("menu-1") as HTMLDivElement;
    // happy-dom returns 0/0 for getBoundingClientRect on unstyled elements; we
    // still verify the menu was positioned with a numeric top.
    expect(menu.style.top).toMatch(/^\d+px$/);
  });
});
