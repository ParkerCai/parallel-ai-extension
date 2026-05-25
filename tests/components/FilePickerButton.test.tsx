import { describe, expect, it, vi } from "vitest";

import { FilePickerButton } from "@/shared/components/FilePickerButton";
import { renderWithProviders } from "../helpers/render";

describe("FilePickerButton", () => {
  it("renders a button + a hidden file input", () => {
    const onPick = vi.fn();
    const { container, getByRole } = renderWithProviders(
      <FilePickerButton onPick={onPick}>Upload</FilePickerButton>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("button", { name: /upload/i })).toBeInTheDocument();
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.className).toContain("hidden");
  });

  it("clicking the button triggers the hidden input's click", async () => {
    const onPick = vi.fn();
    const { container, getByRole, user } = renderWithProviders(
      <FilePickerButton onPick={onPick}>Upload</FilePickerButton>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );

    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const inputClick = vi.spyOn(input, "click");

    await user.click(getByRole("button"));
    expect(inputClick).toHaveBeenCalled();
  });

  it("forwards picked file to onPick", () => {
    const onPick = vi.fn();
    const { container } = renderWithProviders(
      <FilePickerButton onPick={onPick}>Upload</FilePickerButton>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );

    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["x"], "a.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it("forwards null when no file is selected", () => {
    const onPick = vi.fn();
    const { container } = renderWithProviders(
      <FilePickerButton onPick={onPick}>Upload</FilePickerButton>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );

    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it("respects the accept prop", () => {
    const { container } = renderWithProviders(
      <FilePickerButton accept="image/*" onPick={vi.fn()}>Upload</FilePickerButton>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(input.accept).toBe("image/*");
  });
});
