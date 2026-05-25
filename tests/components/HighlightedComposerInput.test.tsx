import { createRef, useRef, useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  HighlightedComposerInput,
  selectFirstPromptBlank,
} from "@/multi-panel/components/HighlightedComposerInput";
import { renderWithProviders } from "../helpers/render";

interface HarnessProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}

function Harness({
  initialValue = "",
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
}: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <HighlightedComposerInput
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      textareaRef={textareaRef}
      value={value}
    />
  );
}

describe("HighlightedComposerInput", () => {
  it("renders a textarea bound to the value prop", () => {
    const { container } = renderWithProviders(
      (<Harness initialValue="prefilled" />) as ReactElement,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe("prefilled");
  });

  it("uses the provided placeholder", () => {
    const { container } = renderWithProviders(
      (<Harness placeholder="Type here…" />) as ReactElement,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe("Type here…");
  });

  it("forwards typed input to onChange and updates the rendered textarea", async () => {
    const onChange = vi.fn();
    const { container, user } = renderWithProviders(
      (<Harness onChange={onChange} />) as ReactElement,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await user.click(textarea);
    await user.type(textarea, "hi");
    expect(onChange).toHaveBeenCalled();
    expect(textarea.value).toBe("hi");
  });

  it("forwards non-Tab keydown events to onKeyDown", async () => {
    const onKeyDown = vi.fn();
    const { container, user } = renderWithProviders(
      (<Harness initialValue="hello" onKeyDown={onKeyDown} />) as ReactElement,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(onKeyDown).toHaveBeenCalled();
    const event = onKeyDown.mock.calls[0]![0] as React.KeyboardEvent;
    expect(event.key).toBe("Enter");
  });

  it("handles Tab by selecting the next variable blank instead of calling onKeyDown", async () => {
    const onKeyDown = vi.fn();
    const { container, user } = renderWithProviders(
      (<Harness initialValue="Hello {name}, talk about {topic}" onKeyDown={onKeyDown} />) as ReactElement,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await user.click(textarea);
    textarea.setSelectionRange(0, 0);
    await user.keyboard("{Tab}");
    // tab should have been intercepted (no parent keydown).
    expect(onKeyDown).not.toHaveBeenCalled();
    // first blank {name} starts at index 6, ends at 12.
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(12);
  });

  it("forwards onPaste events to the parent", () => {
    const onPaste = vi.fn();
    const { container } = renderWithProviders(
      (<Harness onPaste={onPaste} />) as ReactElement,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: () => "" } });
    textarea.dispatchEvent(event);
    expect(onPaste).toHaveBeenCalled();
  });

  it("highlights variable blanks inside the overlay layer", () => {
    const { container } = renderWithProviders(
      (<Harness initialValue="Hello {name}!" />) as ReactElement,
    );
    const blank = container.querySelector(".composer-blank");
    expect(blank).not.toBeNull();
    expect(blank?.textContent).toBe("{name}");
  });
});

describe("selectFirstPromptBlank", () => {
  it("returns false when the textarea has no variable blanks", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "plain text";
    expect(selectFirstPromptBlank(textarea)).toBe(false);
  });

  it("selects the first variable blank and returns true", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Hi {name}, hello {topic}";
    document.body.appendChild(textarea);
    expect(selectFirstPromptBlank(textarea)).toBe(true);
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.selectionEnd).toBe(9);
  });
});
