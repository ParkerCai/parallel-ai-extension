// Xiaomi MiMo Enter/Shift+Enter behavior swap.

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

function isMiMoInput(element) {
  return Boolean(
    element?.tagName === "TEXTAREA" &&
      element.offsetParent !== null &&
      (element.placeholder?.includes("有问题") ||
        element.placeholder?.includes("Ask me anything") ||
        element.placeholder?.includes("Shift") ||
        element.closest("form")),
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

function findSendButton(input) {
  const selectors = [
    'button[data-track-id*="send" i]',
    'button[aria-label="Send message"]',
    'button[aria-label="发送消息"]',
    'button[aria-label="Send"]',
    'button[type="submit"]',
  ];
  const root = input.closest("form") || document;

  for (const selector of selectors) {
    for (const candidate of root.querySelectorAll(selector)) {
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

  if (!enterKeyConfig || typeof matchesModifiers !== "function") {
    return;
  }

  const activeElement = document.activeElement;
  if (!isMiMoInput(activeElement)) {
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    insertTextareaNewline(activeElement);
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
