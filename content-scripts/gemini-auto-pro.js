// Gemini model guard
// Keeps Gemini on Pro when the page resets the model picker to Fast.

(function setupGeminiAutoPro() {
  "use strict";

  if (!window.location.hostname.includes("gemini.google.com")) {
    return;
  }

  const MODEL_LABEL_SELECTOR = 'div[data-test-id="logo-pill-label-container"]';
  const PRO_OPTION_SELECTOR = 'button[data-test-id="bard-mode-option-pro"]';
  const SWITCH_DEBOUNCE_MS = 120;
  const MENU_OPEN_DELAY_MS = 120;
  const SWITCH_COOLDOWN_MS = 700;

  let isEnabled = true;
  let isSwitching = false;
  let scheduledCheckId = null;

  function getVisibleElement(selector) {
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      const rect = element.getBoundingClientRect?.();
      if (rect && rect.width > 0 && rect.height > 0) {
        return element;
      }
    }

    return null;
  }

  function getModelTrigger(labelElement) {
    return (
      labelElement.closest("button") ||
      labelElement.closest('[role="button"]') ||
      labelElement.parentElement
    );
  }

  function clickProOption() {
    const proButton = getVisibleElement(PRO_OPTION_SELECTOR);

    if (proButton instanceof HTMLElement) {
      proButton.click();
    }

    window.setTimeout(() => {
      isSwitching = false;
      scheduleCheck();
    }, SWITCH_COOLDOWN_MS);
  }

  function checkAndSwitch() {
    scheduledCheckId = null;

    if (!isEnabled || isSwitching) {
      return;
    }

    const currentLabel = getVisibleElement(MODEL_LABEL_SELECTOR);
    const labelText = currentLabel?.textContent || "";

    if (!labelText.includes("Fast")) {
      return;
    }

    const triggerButton = getModelTrigger(currentLabel);

    if (!(triggerButton instanceof HTMLElement)) {
      return;
    }

    isSwitching = true;
    triggerButton.click();
    window.setTimeout(clickProOption, MENU_OPEN_DELAY_MS);
  }

  function scheduleCheck() {
    if (!isEnabled) {
      return;
    }

    if (scheduledCheckId !== null) {
      window.clearTimeout(scheduledCheckId);
    }

    scheduledCheckId = window.setTimeout(checkAndSwitch, SWITCH_DEBOUNCE_MS);
  }

  function readStoredEnabled() {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage) {
        resolve(true);
        return;
      }

      chrome.storage.sync.get({ geminiAutoProEnabled: true }, (syncResult) => {
        if (!chrome.runtime.lastError) {
          resolve(syncResult.geminiAutoProEnabled !== false);
          return;
        }

        chrome.storage.local.get({ geminiAutoProEnabled: true }, (localResult) => {
          resolve(localResult.geminiAutoProEnabled !== false);
        });
      });
    });
  }

  async function start() {
    isEnabled = await readStoredEnabled();

    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync" && areaName !== "local") {
          return;
        }

        if (!changes.geminiAutoProEnabled) {
          return;
        }

        isEnabled = changes.geminiAutoProEnabled.newValue !== false;

        if (isEnabled) {
          scheduleCheck();
        } else if (scheduledCheckId !== null) {
          window.clearTimeout(scheduledCheckId);
          scheduledCheckId = null;
        }
      });
    }

    if (!document.body) {
      scheduleCheck();
      return;
    }

    const observer = new MutationObserver(scheduleCheck);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    scheduleCheck();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
