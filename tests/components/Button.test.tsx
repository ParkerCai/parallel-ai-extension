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

  it("uses aria-label as tooltip for an icon-only button when title is missing", () => {
    const { getByRole } = renderWithProviders(
      <Button aria-label="Open Settings"><svg aria-hidden /></Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("button")).toHaveAttribute("data-tooltip", "Open Settings");
  });

  it("uses explicit title over aria-label for an icon-only button", () => {
    const { getByRole } = renderWithProviders(
      <Button aria-label="x" title="Custom Title"><svg aria-hidden /></Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("button")).toHaveAttribute("data-tooltip", "Custom Title");
  });

  it("suppresses the tooltip for a button with a text label even when a title is set", () => {
    const { getByRole } = renderWithProviders(
      <Button title="Import prompt library JSON"><svg aria-hidden /> Import JSON</Button>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("button")).not.toHaveAttribute("data-tooltip");
  });

  it("does not add a tooltip for a text-only button (label is already visible)", () => {
    const { getByRole } = renderWithProviders(<Button>Save changes</Button>, {
      withoutI18n: true,
      withoutSettings: true,
      withoutProviders: true,
    });
    expect(getByRole("button")).not.toHaveAttribute("data-tooltip");
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
