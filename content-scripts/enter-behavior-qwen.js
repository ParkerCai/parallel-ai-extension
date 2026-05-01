// Qwen Enter/Shift+Enter behavior swap.

function createEnterEvent(modifiers = {}) {
  return new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    shiftKey: modifiers.shift || false,
    ctrlKey: modifiers.ctrl || false,
    metaKey: modifiers.meta || false,
    altKey: modifiers.alt || false,
  });
}

function isQwenInput(element) {
  if (!element) {
    return false;
  }

  if (element.tagName === "TEXTAREA") {
    return element.offsetParent !== null;
  }

  const isContentEditable =
    element.isContentEditable || element.getAttribute("contenteditable") === "true";

  return Boolean(
    isContentEditable &&
      element.offsetParent !== null &&
      (element.closest("form") ||
        element.getAttribute("role") === "textbox" ||
        element.classList.contains("ProseMirror")),
  );
}

function insertTextareaNewline(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;

  textarea.value = `${value.substring(0, start)}\n${value.substring(end)}`;
  textarea.selectionStart = textarea.selectionEnd = start + 1;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function insertContentEditableNewline(element) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const lineBreak = document.createElement("br");
  range.deleteContents();
  range.insertNode(lineBreak);
  range.setStartAfter(lineBreak);
  range.setEndAfter(lineBreak);
  selection.removeAllRanges();
  selection.addRange(range);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function findSendButton() {
  const selectors = [
    'button[aria-label="Send"]',
    'button[aria-label="Submit"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="submit" i]',
    'button[type="submit"]',
    'form button:not([disabled]):not([aria-disabled="true"])',
  ];

  for (const selector of selectors) {
    for (const candidate of document.querySelectorAll(selector)) {
      if (!candidate.disabled && candidate.getAttribute("aria-disabled") !== "true") {
        return candidate;
      }
    }
  }

  return null;
}

function handleEnterSwap(event) {
  if (!event.isTrusted || event.code !== "Enter" || event.isComposing) {
    return;
  }

  const enterBehavior = window.ParallelAIEnterBehavior;
  const enterKeyConfig = enterBehavior?.getConfig?.();
  const matchesModifiers = enterBehavior?.matchesModifiers;

  if (!enterKeyConfig || !enterKeyConfig.enabled || typeof matchesModifiers !== "function") {
    return;
  }

  const activeElement = document.activeElement;
  if (!isQwenInput(activeElement)) {
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (activeElement.tagName === "TEXTAREA") {
      insertTextareaNewline(activeElement);
    } else {
      insertContentEditableNewline(activeElement);
    }

    return;
  }

  if (matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const sendButton = findSendButton();
    if (sendButton) {
      sendButton.click();
    } else {
      activeElement.dispatchEvent(createEnterEvent());
    }

    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

window.ParallelAIEnterBehavior?.applyEnterSwapSetting?.(handleEnterSwap);
