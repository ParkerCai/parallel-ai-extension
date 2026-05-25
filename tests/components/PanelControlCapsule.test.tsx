import { describe, expect, it, vi } from "vitest";

import {
  PanelControlCapsule,
  PanelControlIconButton,
  PanelProviderPicker,
  PanelReorderButton,
} from "@/multi-panel/components/PanelControlCapsule";
import { PROVIDERS } from "@/shared/lib/providers";
import { renderWithProviders } from "../helpers/render";

const CHATGPT = PROVIDERS.find((p) => p.id === "chatgpt")!;
const CLAUDE = PROVIDERS.find((p) => p.id === "claude")!;

describe("PanelControlCapsule", () => {
  it("renders its children inside the capsule chrome", () => {
    const { getByText } = renderWithProviders(
      <PanelControlCapsule variant="compact">
        <span>capsule-child</span>
      </PanelControlCapsule>,
    );
    expect(getByText("capsule-child")).toBeInTheDocument();
  });

  it("applies the compact variant width class", () => {
    const { container } = renderWithProviders(
      <PanelControlCapsule variant="compact">
        <span>child</span>
      </PanelControlCapsule>,
    );
    expect(container.querySelector("[data-panel-control-capsule]")?.className).toContain(
      "w-[112px]",
    );
  });

  it("applies the wide variant width class", () => {
    const { container } = renderWithProviders(
      <PanelControlCapsule variant="wide">
        <span>child</span>
      </PanelControlCapsule>,
    );
    expect(container.querySelector("[data-panel-control-capsule]")?.className).toContain(
      "w-[184px]",
    );
  });
});

describe("PanelControlIconButton", () => {
  it("forwards click events to onClick", async () => {
    const onClick = vi.fn();
    const { getByRole, user } = renderWithProviders(
      <PanelControlIconButton aria-label="do thing" onClick={onClick} tooltip="Tip">
        <svg />
      </PanelControlIconButton>,
    );
    await user.click(getByRole("button", { name: /do thing/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the tooltip via data-tooltip", () => {
    const { getByRole } = renderWithProviders(
      <PanelControlIconButton aria-label="x" tooltip="Hello tip">
        <svg />
      </PanelControlIconButton>,
    );
    expect(getByRole("button", { name: /x/i })).toHaveAttribute("data-tooltip", "Hello tip");
  });

  it("renders the danger style class when danger=true", () => {
    const { getByRole } = renderWithProviders(
      <PanelControlIconButton aria-label="del" danger tooltip="x">
        <svg />
      </PanelControlIconButton>,
    );
    expect(getByRole("button", { name: /del/i }).className).toContain("--danger");
  });
});

describe("PanelReorderButton", () => {
  it("fires onPointerDown when the user presses on it", async () => {
    const onPointerDown = vi.fn();
    const { getByRole, user } = renderWithProviders(
      <PanelReorderButton
        ariaLabel="Reorder this"
        dragState="idle"
        onPointerDown={onPointerDown}
        tooltip="Drag"
      />,
    );
    await user.pointer({ keys: "[MouseLeft>]", target: getByRole("button", { name: /reorder this/i }) });
    expect(onPointerDown).toHaveBeenCalled();
  });

  it("renders with cursor-grabbing class while dragging from source", () => {
    const { getByRole } = renderWithProviders(
      <PanelReorderButton
        ariaLabel="Reorder"
        dragState="source"
        onPointerDown={vi.fn()}
        tooltip="Drag"
      />,
    );
    expect(getByRole("button", { name: /reorder/i }).className).toContain("cursor-grabbing");
  });
});

describe("PanelProviderPicker", () => {
  function renderPicker(onChange = vi.fn()) {
    const utils = renderWithProviders(
      <PanelControlCapsule variant="wide">
        <PanelProviderPicker
          ariaLabel="Change provider"
          onChange={onChange}
          options={[CHATGPT, CLAUDE]}
          tooltip="Change"
          value="chatgpt"
        />
      </PanelControlCapsule>,
    );
    return { ...utils, onChange };
  }

  it("renders a combobox with the provided aria-label", () => {
    const { getByRole } = renderPicker();
    expect(getByRole("combobox", { name: /change provider/i })).toBeInTheDocument();
  });

  it("opens a listbox of options when the trigger is clicked", async () => {
    const { findByRole, getByRole, user } = renderPicker();
    await user.click(getByRole("combobox", { name: /change provider/i }));
    const claudeOption = await findByRole("option", { name: /Claude/i });
    expect(claudeOption).toBeInTheDocument();
  });

  it("calls onChange with the option id when an option is clicked", async () => {
    const { findByRole, getByRole, onChange, user } = renderPicker();
    await user.click(getByRole("combobox", { name: /change provider/i }));
    await user.click(await findByRole("option", { name: /Claude/i }));
    expect(onChange).toHaveBeenCalledWith("claude");
  });
});
