import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { renderWithProviders } from "../helpers/render";

function render(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const utils = renderWithProviders(
    <ConfirmDialog
      message="Are you sure?"
      onClose={onClose}
      onConfirm={onConfirm}
      open
      title="Confirm"
      {...overrides}
    />,
    { withoutI18n: true, withoutSettings: true, withoutProviders: true },
  );
  return { ...utils, onClose, onConfirm };
}

describe("ConfirmDialog", () => {
  it("renders nothing when open=false", () => {
    const { queryByText } = render({ open: false });
    expect(queryByText("Confirm")).toBeNull();
    expect(queryByText("Are you sure?")).toBeNull();
  });

  it("renders title + message + default Cancel/Confirm labels", () => {
    const { getByRole, getByText } = render();
    // The word "Confirm" is both the title and the button label, so query by role for clarity.
    expect(getByRole("heading", { name: "Confirm" })).toBeInTheDocument();
    expect(getByText("Are you sure?")).toBeInTheDocument();
    expect(getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("uses custom cancel/confirm labels when provided", () => {
    const { getByRole } = render({ cancelLabel: "Nope", confirmLabel: "Yep" });
    expect(getByRole("button", { name: "Nope" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Yep" })).toBeInTheDocument();
  });

  it("Cancel calls onClose, not onConfirm", async () => {
    const { getByRole, onClose, onConfirm, user } = render();
    await user.click(getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Confirm calls onConfirm followed by onClose", async () => {
    const { getByRole, onClose, onConfirm, user } = render();
    await user.click(getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("destructive=true styles the confirm button as danger", () => {
    const { getByRole } = render({ destructive: true });
    const confirm = getByRole("button", { name: "Confirm" });
    expect(confirm.className).toMatch(/danger/);
  });
});
