export function findTextInputElement(selector: string | null | undefined) {
  if (!selector || typeof selector !== "string") {
    return null;
  }

  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

export function injectTextIntoElement(element: HTMLElement | null, text: string) {
  if (!element || !text || typeof text !== "string" || text.trim() === "") {
    return false;
  }

  try {
    const isTextarea = element.tagName === "TEXTAREA" || element.tagName === "INPUT";
    const isContentEditable =
      element.isContentEditable || element.getAttribute("contenteditable") === "true";

    if (!isTextarea && !isContentEditable) {
      return false;
    }

    if (isTextarea) {
      const field = element as HTMLTextAreaElement | HTMLInputElement;
      const currentValue = field.value || "";
      field.value = currentValue + text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.focus();
      field.selectionStart = field.selectionEnd = field.value.length;
      return true;
    }

    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch {
      inserted = false;
    }

    if (!inserted) {
      element.appendChild(document.createTextNode(text));
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    try {
      const endRange = document.createRange();
      endRange.selectNodeContents(element);
      endRange.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(endRange);
    } catch {
      // ignore selection restore failures
    }

    return true;
  } catch {
    return false;
  }
}
