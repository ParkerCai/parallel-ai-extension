// Enter/Shift+Enter behavior swap for providers without a dedicated script
// (Mistral, Brave, T3 Chat). Handles both <textarea> and contenteditable
// composers, and relies on each site's own Shift+Enter newline handling for
// rich-text editors.

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

function isComposerInput(element) {
  if (!element || element.offsetParent === null) {
    return false;
  }

  return element.tagName === "TEXTAREA" || element.isContentEditable === true;
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

function findSendButton(input) {
  const root = input.closest("form") || document;
  const selectors = [
    'button[aria-label*="Send" i]:not([disabled])',
    'button[aria-label*="Submit" i]:not([disabled])',
    'button[type="submit"]:not([disabled])',
  ];

  for (const selector of selectors) {
    const button = root.querySelector(selector);
    if (button) {
      return button;
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

  if (!enterKeyConfig || typeof matchesModifiers !== "function") {
    return;
  }

  const activeElement = document.activeElement;
  if (!isComposerInput(activeElement)) {
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (activeElement.tagName === "TEXTAREA") {
      insertTextareaNewline(activeElement);
    } else {
      activeElement.dispatchEvent(createEnterEvent({ shift: true }));
    }
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const sendButton = findSendButton(activeElement);
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
