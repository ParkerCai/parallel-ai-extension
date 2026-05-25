import { describe, expect, it } from "vitest";

import { matchesEnterKeyModifiers } from "@/shared/lib/enter-key";

const noModifiers = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };

describe("matchesEnterKeyModifiers", () => {
  it("matches when every modifier flag matches", () => {
    expect(
      matchesEnterKeyModifiers(noModifiers, {
        shift: false,
        ctrl: false,
        alt: false,
        meta: false,
      }),
    ).toBe(true);
  });

  it("matches when shift is pressed and required", () => {
    expect(
      matchesEnterKeyModifiers(
        { ...noModifiers, shiftKey: true },
        { shift: true, ctrl: false, alt: false, meta: false },
      ),
    ).toBe(true);
  });

  it("rejects when an extra modifier is pressed", () => {
    expect(
      matchesEnterKeyModifiers(
        { ...noModifiers, ctrlKey: true },
        { shift: false, ctrl: false, alt: false, meta: false },
      ),
    ).toBe(false);
  });

  it("rejects when a required modifier is missing", () => {
    expect(
      matchesEnterKeyModifiers(noModifiers, {
        shift: true,
        ctrl: false,
        alt: false,
        meta: false,
      }),
    ).toBe(false);
  });

  it("handles multi-modifier combos exactly", () => {
    expect(
      matchesEnterKeyModifiers(
        { shiftKey: true, ctrlKey: true, altKey: false, metaKey: false },
        { shift: true, ctrl: true, alt: false, meta: false },
      ),
    ).toBe(true);

    expect(
      matchesEnterKeyModifiers(
        { shiftKey: true, ctrlKey: true, altKey: true, metaKey: false },
        { shift: true, ctrl: true, alt: false, meta: false },
      ),
    ).toBe(false);
  });
});
