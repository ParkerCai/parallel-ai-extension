import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useFloatingListbox } from "@/shared/hooks/useFloatingListbox";

function makeHook(opts: { optionsCount?: number; selectedIndex?: number } = {}) {
  const onCommit = vi.fn();
  const utils = renderHookWithProviders(() =>
    useFloatingListbox({
      onCommit,
      optionsCount: opts.optionsCount ?? 3,
      selectedIndex: opts.selectedIndex ?? 0,
    }),
  );
  return { ...utils, onCommit };
}

function key(name: string) {
  return {
    key: name,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLElement>;
}

describe("useFloatingListbox", () => {
  it("starts closed with activeIndex 0", () => {
    const { result } = makeHook();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeIndex).toBe(0);
  });

  it("open() sets isOpen and snaps activeIndex to selectedIndex", () => {
    const { result } = makeHook({ selectedIndex: 2 });
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeIndex).toBe(2);
  });

  it("open() falls back to 0 when selectedIndex is -1", () => {
    const { result } = makeHook({ selectedIndex: -1 });
    act(() => result.current.open());
    expect(result.current.activeIndex).toBe(0);
  });

  it("close() resets isOpen to false", () => {
    const { result } = makeHook();
    act(() => result.current.open());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  describe("handleTriggerKeyDown", () => {
    it("ArrowDown opens when closed", () => {
      const { result } = makeHook();
      const event = key("ArrowDown");
      act(() => result.current.handleTriggerKeyDown(event));
      expect(result.current.isOpen).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("ArrowDown when open advances activeIndex (with wrap)", () => {
      const { result } = makeHook({ optionsCount: 3, selectedIndex: 2 });
      act(() => result.current.open());
      expect(result.current.activeIndex).toBe(2);
      act(() => result.current.handleTriggerKeyDown(key("ArrowDown")));
      expect(result.current.activeIndex).toBe(0); // wrap
    });

    it("ArrowUp when open retreats activeIndex (with wrap)", () => {
      const { result } = makeHook({ optionsCount: 3, selectedIndex: 0 });
      act(() => result.current.open());
      act(() => result.current.handleTriggerKeyDown(key("ArrowUp")));
      expect(result.current.activeIndex).toBe(2);
    });

    it("Enter commits onCommit with activeIndex when open", () => {
      const { onCommit, result } = makeHook({ optionsCount: 3, selectedIndex: 1 });
      act(() => result.current.open());
      act(() => result.current.handleTriggerKeyDown(key("Enter")));
      expect(onCommit).toHaveBeenCalledWith(1);
    });

    it("Enter opens when closed (does not commit)", () => {
      const { onCommit, result } = makeHook();
      act(() => result.current.handleTriggerKeyDown(key("Enter")));
      expect(result.current.isOpen).toBe(true);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("Space behaves like Enter (open / commit)", () => {
      const { onCommit, result } = makeHook({ selectedIndex: 1 });
      act(() => result.current.handleTriggerKeyDown(key(" ")));
      expect(result.current.isOpen).toBe(true);
      act(() => result.current.handleTriggerKeyDown(key(" ")));
      expect(onCommit).toHaveBeenCalledWith(1);
    });

    it("Escape closes when open", () => {
      const { result } = makeHook();
      act(() => result.current.open());
      act(() => result.current.handleTriggerKeyDown(key("Escape")));
      expect(result.current.isOpen).toBe(false);
    });

    it("Escape is a no-op when closed", () => {
      const { result } = makeHook();
      const event = key("Escape");
      act(() => result.current.handleTriggerKeyDown(event));
      expect(result.current.isOpen).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("ignores arrow keys when optionsCount is 0", () => {
      const { result } = makeHook({ optionsCount: 0 });
      act(() => result.current.open());
      const initial = result.current.activeIndex;
      act(() => result.current.handleTriggerKeyDown(key("ArrowDown")));
      expect(result.current.activeIndex).toBe(initial);
    });
  });

  describe("outside interaction", () => {
    it("clicking outside the trigger and menu closes the listbox", () => {
      const { result } = makeHook();
      act(() => result.current.open());
      expect(result.current.isOpen).toBe(true);

      const outside = document.createElement("div");
      document.body.appendChild(outside);
      const evt = new PointerEvent("pointerdown");
      Object.defineProperty(evt, "target", { value: outside });
      act(() => {
        document.dispatchEvent(evt);
      });
      expect(result.current.isOpen).toBe(false);
    });

    it("window blur closes the listbox", () => {
      const { result } = makeHook();
      act(() => result.current.open());
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      expect(result.current.isOpen).toBe(false);
    });
  });
});
