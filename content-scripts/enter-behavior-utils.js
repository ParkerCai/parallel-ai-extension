// Shared utilities for Enter key behavior modification
// Supports customizable key combinations for newline and send actions

let enterKeyConfig = null;
let enterSwapHandler = null;
const DEFAULT_ENTER_KEY_BEHAVIOR = {
  enabled: true,
  preset: 'default',
  newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
  sendModifiers: { shift: false, ctrl: false, alt: false, meta: false }
};

function enableEnterSwap() {
  if (enterSwapHandler) {
    window.addEventListener("keydown", enterSwapHandler, { capture: true });
  }
}

function disableEnterSwap() {
  if (enterSwapHandler) {
    window.removeEventListener("keydown", enterSwapHandler, { capture: true });
  }
}

function setEnterSwapHandler(handler) {
  if (enterSwapHandler && enterSwapHandler !== handler) {
    window.removeEventListener("keydown", enterSwapHandler, { capture: true });
  }

  enterSwapHandler = typeof handler === "function" ? handler : null;
}

function normalizeEnterKeyBehavior(config) {
  const source = config && typeof config === 'object' ? config : {};
  const newlineModifiers = source.newlineModifiers && typeof source.newlineModifiers === 'object'
    ? source.newlineModifiers
    : DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers;
  const sendModifiers = source.sendModifiers && typeof source.sendModifiers === 'object'
    ? source.sendModifiers
    : DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers;

  return {
    enabled: source.enabled !== false,
    preset: typeof source.preset === 'string' ? source.preset : DEFAULT_ENTER_KEY_BEHAVIOR.preset,
    newlineModifiers: {
      shift: newlineModifiers.shift === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.shift : newlineModifiers.shift === true,
      ctrl: newlineModifiers.ctrl === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.ctrl : newlineModifiers.ctrl === true,
      alt: newlineModifiers.alt === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.alt : newlineModifiers.alt === true,
      meta: newlineModifiers.meta === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.newlineModifiers.meta : newlineModifiers.meta === true
    },
    sendModifiers: {
      shift: sendModifiers.shift === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.shift : sendModifiers.shift === true,
      ctrl: sendModifiers.ctrl === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.ctrl : sendModifiers.ctrl === true,
      alt: sendModifiers.alt === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.alt : sendModifiers.alt === true,
      meta: sendModifiers.meta === undefined ? DEFAULT_ENTER_KEY_BEHAVIOR.sendModifiers.meta : sendModifiers.meta === true
    }
  };
}

function setEnterKeyConfig(config) {
  enterKeyConfig = normalizeEnterKeyBehavior(config);

  if (enterKeyConfig.enabled) {
    enableEnterSwap();
  } else {
    disableEnterSwap();
  }
}

function loadEnterBehaviorFromLocal() {
  chrome.storage.local.get({
    enterKeyBehavior: DEFAULT_ENTER_KEY_BEHAVIOR
  }, (data) => {
    setEnterKeyConfig(data.enterKeyBehavior);
  });
}

// Check if event matches the configured modifiers
function matchesModifiers(event, modifiers) {
  return event.shiftKey === (modifiers.shift || false) &&
         event.ctrlKey === (modifiers.ctrl || false) &&
         event.altKey === (modifiers.alt || false) &&
         event.metaKey === (modifiers.meta || false);
}

// Get target event modifiers based on action type
function getTargetModifiers(actionType) {
  if (!enterKeyConfig) return null;

  if (actionType === 'newline') {
    return enterKeyConfig.newlineModifiers;
  } else if (actionType === 'send') {
    return enterKeyConfig.sendModifiers;
  }
  return null;
}

function applyEnterSwapSetting(handler) {
  if (typeof handler === "function") {
    setEnterSwapHandler(handler);
  }

  chrome.storage.sync.get({
    enterKeyBehavior: DEFAULT_ENTER_KEY_BEHAVIOR
  }, (data) => {
    if (chrome.runtime.lastError) {
      loadEnterBehaviorFromLocal();
      return;
    }

    setEnterKeyConfig(data.enterKeyBehavior);
  });
}

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === "sync" || area === "local") && changes.enterKeyBehavior) {
    applyEnterSwapSetting();
  }
});

window.ParallelAIEnterBehavior = {
  applyEnterSwapSetting,
  getConfig: () => enterKeyConfig,
  matchesModifiers,
  setEnterSwapHandler,
};
