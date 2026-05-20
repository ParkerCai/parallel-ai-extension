// Gemini thinking level guard
// Keeps Gemini on Extended thinking when the page resets it to Standard.
//
// Three-step click flow:
//   1. Click pill `[data-test-id="bard-mode-menu-button"]` -> opens model menu
//   2. Click the "Thinking level" item (its `.sublabel` shows current level)
//   3. Click the "Extended" item in the submenu

(function setupGeminiAutoExtendedThinking() {
  "use strict";

  if (!window.location.hostname.includes("gemini.google.com")) {
    return;
  }

  const STORAGE_KEY = "geminiAutoExtendedThinkingEnabled";
  const PILL_SELECTOR = '[data-test-id="bard-mode-menu-button"]';
  const OVERLAY_SELECTOR = ".cdk-overlay-pane";
  const CLICKABLE_SELECTOR = '[role="menuitem"], button, gem-menu-item';

  const STEP_DELAY_MS = 180;
  const WAIT_TIMEOUT_MS = 1500;
  const POLL_INTERVAL_MS = 60;

  let isEnabled = false;
  let isSwitching = false;
  let pillObserver = null;

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function findVisible(selector) {
    for (const element of document.querySelectorAll(selector)) {
      if (isVisible(element)) {
        return element;
      }
    }
    return null;
  }

  async function waitFor(getter) {
    const start = Date.now();
    while (Date.now() - start < WAIT_TIMEOUT_MS) {
      const result = getter();
      if (result) {
        return result;
      }
      await delay(POLL_INTERVAL_MS);
    }
    return null;
  }

  function findMenuItemByLabel(labelText) {
    for (const overlay of document.querySelectorAll(OVERLAY_SELECTOR)) {
      if (!isVisible(overlay)) {
        continue;
      }
      for (const label of overlay.querySelectorAll(".label")) {
        if (!isVisible(label)) {
          continue;
        }
        if ((label.textContent || "").trim().toLowerCase() !== labelText) {
          continue;
        }
        const clickable = label.closest(CLICKABLE_SELECTOR);
        if (clickable && isVisible(clickable)) {
          return clickable;
        }
      }
    }
    return null;
  }

  function dismissOverlays() {
    document.body?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  }

  async function attemptSwitch() {
    const pill = findVisible(PILL_SELECTOR);
    if (!pill) {
      return false;
    }
    pill.click();

    const thinkingItem = await waitFor(() => findMenuItemByLabel("thinking level"));
    if (!thinkingItem) {
      dismissOverlays();
      return false;
    }

    const sublabel = thinkingItem.querySelector(".sublabel")?.textContent?.trim() || "";
    if (/extended/i.test(sublabel)) {
      dismissOverlays();
      return false;
    }

    // Wide layout: Standard/Extended are inline siblings of the Thinking
    // level row — clicking the row would collapse them. Narrow layout: a
    // side submenu only appears after clicking the row.
    let extendedItem = findMenuItemByLabel("extended");
    if (!extendedItem) {
      thinkingItem.click();
      await delay(STEP_DELAY_MS);
      extendedItem = await waitFor(() => findMenuItemByLabel("extended"));
    }

    if (!extendedItem) {
      dismissOverlays();
      return false;
    }

    extendedItem.click();
    return true;
  }

  async function runOnce() {
    if (!isEnabled || isSwitching) {
      return;
    }
    isSwitching = true;
    try {
      await attemptSwitch();
    } finally {
      isSwitching = false;
    }
  }

  function trigger() {
    pillObserver?.disconnect();
    pillObserver = null;
    if (findVisible(PILL_SELECTOR)) {
      void runOnce();
      return;
    }
    if (!document.body) {
      return;
    }
    pillObserver = new MutationObserver(() => {
      if (findVisible(PILL_SELECTOR)) {
        pillObserver?.disconnect();
        pillObserver = null;
        void runOnce();
      }
    });
    pillObserver.observe(document.body, { childList: true, subtree: true });
  }

  async function readEnabled() {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return false;
    }
    try {
      const result = await chrome.storage.sync.get({ [STORAGE_KEY]: false });
      return result[STORAGE_KEY] !== false;
    } catch {
      try {
        const result = await chrome.storage.local.get({ [STORAGE_KEY]: false });
        return result[STORAGE_KEY] !== false;
      } catch {
        return false;
      }
    }
  }

  async function start() {
    isEnabled = await readEnabled();

    chrome.storage?.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" && areaName !== "local") {
        return;
      }
      const change = changes[STORAGE_KEY];
      if (!change) {
        return;
      }
      isEnabled = change.newValue !== false;
      if (isEnabled) {
        trigger();
      }
    });

    trigger();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
