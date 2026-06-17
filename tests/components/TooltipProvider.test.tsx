import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/shared/components/TooltipProvider";
import { renderWithProviders } from "../helpers/render";

describe("TooltipProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeTarget(tooltip: string, opts: { placement?: "top" | "bottom" } = {}) {
    const target = document.createElement("button");
    target.dataset.tooltip = tooltip;
    if (opts.placement) target.dataset.tooltipPlacement = opts.placement;
    target.getBoundingClientRect = () =>
      ({
        left: 100,
        right: 200,
        top: 100,
        bottom: 140,
        width: 100,
        height: 40,
        x: 100,
        y: 100,
        toJSON() {
          return this;
        },
      }) as DOMRect;
    document.body.appendChild(target);
    return target;
  }

  function pointerOver(target: HTMLElement) {
    document.dispatchEvent(
      new PointerEvent("pointerover", { target } as never),
    );
    // happy-dom doesn't set event.target from init; assign it directly.
    Object.defineProperty(target, "_dummy", { value: 1, configurable: true });
    const evt = new Event("pointerover", { bubbles: true });
    Object.defineProperty(evt, "target", { value: target });
    document.dispatchEvent(evt);
  }

  it("renders nothing by default", () => {
    const { queryByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    expect(queryByRole("tooltip")).toBeNull();
  });

  it("renders nothing when hovered element has no data-tooltip", () => {
    const { queryByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    const node = document.createElement("button");
    document.body.appendChild(node);
    const evt = new Event("pointerover", { bubbles: true });
    Object.defineProperty(evt, "target", { value: node });
    act(() => {
      document.dispatchEvent(evt);
      vi.advanceTimersByTime(250);
    });
    expect(queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip after hover delay when target has data-tooltip", () => {
    const { queryByRole, getByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    const target = makeTarget("Save changes");
    const evt = new Event("pointerover", { bubbles: true });
    Object.defineProperty(evt, "target", { value: target });
    act(() => {
      document.dispatchEvent(evt);
    });
    expect(queryByRole("tooltip")).toBeNull(); // not yet — delay
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(getByRole("tooltip").textContent).toBe("Save changes");
  });

  it("hides tooltip on focusout", () => {
    const { getByRole, queryByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    const target = makeTarget("Hello");
    const overEvt = new Event("pointerover", { bubbles: true });
    Object.defineProperty(overEvt, "target", { value: target });
    act(() => {
      document.dispatchEvent(overEvt);
      vi.advanceTimersByTime(250);
    });
    expect(getByRole("tooltip")).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new FocusEvent("focusout"));
    });
    expect(queryByRole("tooltip")).toBeNull();
  });

  function pointerOut(target: HTMLElement) {
    const evt = new Event("pointerout", { bubbles: true });
    Object.defineProperty(evt, "target", { value: target });
    Object.defineProperty(evt, "relatedTarget", { value: null });
    document.dispatchEvent(evt);
  }

  function showTooltip(text: string) {
    const target = makeTarget(text);
    const evt = new Event("pointerover", { bubbles: true });
    Object.defineProperty(evt, "target", { value: target });
    act(() => {
      document.dispatchEvent(evt);
      vi.advanceTimersByTime(250);
    });
    return target;
  }

  it("delays hiding the tooltip for 500ms after pointer-out", () => {
    const { getByRole, queryByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    const target = showTooltip("Lingering");
    expect(getByRole("tooltip")).toBeInTheDocument();

    act(() => {
      pointerOut(target);
      vi.advanceTimersByTime(450);
    });
    expect(queryByRole("tooltip")).toBeInTheDocument(); // still within the grace period

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(queryByRole("tooltip")).toBeNull(); // hidden after 500ms
  });

  it("cancels the pending hide when the pointer returns", () => {
    const { getByRole, queryByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    const target = showTooltip("Sticky");

    act(() => {
      pointerOut(target);
      vi.advanceTimersByTime(300);
    });
    expect(queryByRole("tooltip")).toBeInTheDocument();

    // Pointer comes back onto the trigger before the grace period elapses.
    const backEvt = new Event("pointerover", { bubbles: true });
    Object.defineProperty(backEvt, "target", { value: target });
    act(() => {
      document.dispatchEvent(backEvt);
      vi.advanceTimersByTime(400);
    });
    expect(getByRole("tooltip")).toBeInTheDocument(); // hide was cancelled
  });

  it("shows tooltip immediately on focusin", () => {
    const { getByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    const target = makeTarget("Focused");
    const evt = new Event("focusin", { bubbles: true });
    Object.defineProperty(evt, "target", { value: target });
    act(() => {
      document.dispatchEvent(evt);
    });
    expect(getByRole("tooltip").textContent).toBe("Focused");
  });

  it("respects placement=bottom when requested", () => {
    const { getByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    const target = makeTarget("Below", { placement: "bottom" });
    const evt = new Event("focusin", { bubbles: true });
    Object.defineProperty(evt, "target", { value: target });
    act(() => {
      document.dispatchEvent(evt);
    });
    expect(getByRole("tooltip").className).toContain("--bottom");
  });

  it("uses placement=top when there's room above the target", () => {
    const { getByRole } = renderWithProviders(<TooltipProvider />, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    // target.top = 100, > 44 => top
    const target = makeTarget("Above");
    const evt = new Event("focusin", { bubbles: true });
    Object.defineProperty(evt, "target", { value: target });
    act(() => {
      document.dispatchEvent(evt);
    });
    expect(getByRole("tooltip").className).toContain("--top");
  });
});
