import { describe, expect, it, vi } from "vitest";

import { Button } from "@/shared/components/Button";
import { renderWithProviders } from "../helpers/render";

describe("Button", () => {
  it("renders children and triggers onClick", async () => {
    const onClick = vi.fn();
    const { getByRole, user } = renderWithProviders(
      <Button onClick={onClick}>Click me</Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    await user.click(getByRole("button", { name: /click me/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type='button' (prevents accidental form submits)", () => {
    const { getByRole } = renderWithProviders(<Button>Save</Button>, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    expect(getByRole("button")).toHaveAttribute("type", "button");
  });

  it("applies aria-label when provided", () => {
    const { getByRole } = renderWithProviders(
      <Button aria-label="settings"><span aria-hidden>x</span></Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("uses aria-label as tooltip when title is missing", () => {
    const { getByRole } = renderWithProviders(
      <Button aria-label="Open Settings">x</Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("button")).toHaveAttribute("data-tooltip", "Open Settings");
  });

  it("uses explicit title over aria-label for tooltip", () => {
    const { getByRole } = renderWithProviders(
      <Button aria-label="x" title="Custom Title">y</Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("button")).toHaveAttribute("data-tooltip", "Custom Title");
  });

  it("falls back to inferring tooltip from text children", () => {
    const { getByRole } = renderWithProviders(<Button>Save changes</Button>, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    expect(getByRole("button")).toHaveAttribute("data-tooltip", "Save changes");
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    const { getByRole, user } = renderWithProviders(
      <Button onClick={onClick} disabled>Disabled</Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    await user.click(getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders each variant + size combo without crashing", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
      for (const size of ["sm", "md", "icon", "iconSm"] as const) {
        const { unmount } = renderWithProviders(
          <Button variant={variant} size={size}>x</Button>,
          { withoutI18n: true, withoutSettings: true, withoutProviders: true },
        );
        unmount();
      }
    }
  });
});
