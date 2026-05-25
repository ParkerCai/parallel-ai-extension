import { describe, expect, it, vi } from "vitest";

import { Select } from "@/shared/components/Select";
import { renderWithProviders } from "../helpers/render";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("Select", () => {
  it("renders the selected option's label in the trigger", () => {
    const { getByRole } = renderWithProviders(
      <Select aria-label="picker" onValueChange={vi.fn()} options={OPTIONS} value="b" />,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("combobox", { name: /picker/i }).textContent).toContain("Beta");
  });

  it("renders the placeholder when nothing matches the value", () => {
    const { getByRole } = renderWithProviders(
      <Select
        aria-label="picker"
        onValueChange={vi.fn()}
        options={OPTIONS}
        placeholder="Pick one"
        value="not-real"
      />,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("combobox").textContent).toContain("Pick one");
  });

  it("opens the listbox on click and exposes options", async () => {
    const { getByRole, findAllByRole, user } = renderWithProviders(
      <Select aria-label="picker" onValueChange={vi.fn()} options={OPTIONS} value="a" />,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    await user.click(getByRole("combobox"));
    const options = await findAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]!.textContent).toContain("Alpha");
  });

  it("clicking an option commits the value and closes", async () => {
    const onValueChange = vi.fn();
    const { getByRole, findAllByRole, user, queryByRole } = renderWithProviders(
      <Select
        aria-label="picker"
        onValueChange={onValueChange}
        options={OPTIONS}
        value="a"
      />,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    await user.click(getByRole("combobox"));
    const options = await findAllByRole("option");
    await user.click(options[2]!);
    expect(onValueChange).toHaveBeenCalledWith("c");
    // After commit the listbox closes (no options visible).
    expect(queryByRole("option")).toBeNull();
  });

  it("disabled trigger does not open the listbox", async () => {
    const { getByRole, queryByRole, user } = renderWithProviders(
      <Select
        aria-label="picker"
        disabled
        onValueChange={vi.fn()}
        options={OPTIONS}
        value="a"
      />,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    await user.click(getByRole("combobox"));
    expect(queryByRole("option")).toBeNull();
  });

  it("reads options from <option> children when options prop omitted", () => {
    const { getByRole } = renderWithProviders(
      <Select aria-label="picker" onValueChange={vi.fn()} value="b">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
      { withoutI18n: true, withoutSettings: true, withoutProviders: true },
    );
    expect(getByRole("combobox").textContent).toContain("Beta");
  });
});
