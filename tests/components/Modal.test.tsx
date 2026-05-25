import { describe, expect, it, vi } from "vitest";

import { Modal } from "@/shared/components/Modal";
import { renderWithProviders } from "../helpers/render";

function renderModal(overrides: Partial<Parameters<typeof Modal>[0]> = {}) {
  const onClose = vi.fn();
  const utils = renderWithProviders(
    <Modal onClose={onClose} open title="Hello" {...overrides}>
      <p>body</p>
    </Modal>,
    { withoutI18n: true, withoutSettings: true, withoutProviders: true },
  );
  return { ...utils, onClose };
}

describe("Modal", () => {
  it("renders nothing when open=false", () => {
    const { queryByText } = renderModal({ open: false });
    expect(queryByText("Hello")).toBeNull();
    expect(queryByText("body")).toBeNull();
  });

  it("renders title + body when open", () => {
    const { getByText } = renderModal();
    expect(getByText("Hello")).toBeInTheDocument();
    expect(getByText("body")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    const { getByText } = renderModal({ description: "extra info" });
    expect(getByText("extra info")).toBeInTheDocument();
  });

  it("renders actions slot when provided", () => {
    const { getByText } = renderModal({
      actions: <button type="button">Save</button>,
    });
    expect(getByText("Save")).toBeInTheDocument();
  });

  it("clicking the backdrop calls onClose", async () => {
    const { container, onClose, user } = renderModal();
    const backdrop = container.ownerDocument.querySelector(".fixed.inset-0") as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the modal body does NOT call onClose", async () => {
    const { getByText, onClose, user } = renderModal();
    await user.click(getByText("body"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking the close button calls onClose", async () => {
    const { getByRole, onClose, user } = renderModal();
    await user.click(getByRole("button", { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies the right max-width class per size", () => {
    const { container, rerender } = renderModal({ size: "md" });
    expect(container.querySelector(".max-w-2xl")).toBeInTheDocument();
    rerender(
      <Modal onClose={vi.fn()} open title="t" size="xl">
        <p>body</p>
      </Modal>,
    );
    expect(container.querySelector(".max-w-6xl")).toBeInTheDocument();
  });
});
