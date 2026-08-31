// Z.ai Enter/Shift+Enter behavior swap.

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

function isZaiInput(element) {
  return Boolean(
    element &&
      element.tagName === "TEXTAREA" &&
      element.offsetParent !== null &&
      (element.id === "chat-input" || element.closest("form")),
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

function findSendButton() {
  return (
    document.querySelector("#send-message-button:not([disabled])") ||
    document.querySelector("button.sendMessageButton:not([disabled])") ||
    document.querySelector('form button[type="submit"]:not([disabled])')
  );
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
  if (!isZaiInput(activeElement)) {
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
