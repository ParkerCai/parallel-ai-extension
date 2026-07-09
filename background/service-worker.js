const APP_PATH = "multi-panel/index.html";
const CONTEXT_MENU_ID = "open-parallel-ai";
const PENDING_MULTI_PANEL_ACTION_KEY = "pendingMultiPanelAction";

// The Claude pane runs claude.ai in a cross-origin iframe whose cookie jar is
// empty (Chrome partitions storage for embedded third-party frames), so
// claude.ai can't read its `lastActiveOrg` cookie and defaults to the wrong
// workspace. The browser cookie store is readable here regardless of open tabs,
// so read that cookie and publish it to chrome.storage.local for the Claude
// content scripts to pin to. See src/content/claude-workspace*.ts.
const CLAUDE_WORKSPACE_STORAGE_KEY = "claudeActiveWorkspace";
const CLAUDE_LAST_ACTIVE_ORG_COOKIE = "lastActiveOrg";
const CLAUDE_ORG_UUID = /^[0-9a-fA-F-]{36}$/;

async function readClaudeWorkspace() {
  try {
    const cookie = await chrome.cookies.get({
      url: "https://claude.ai/",
      name: CLAUDE_LAST_ACTIVE_ORG_COOKIE,
    });
    const value = cookie?.value;
    return value && CLAUDE_ORG_UUID.test(value) ? value : null;
  } catch {
    return null;
  }
}

async function publishClaudeWorkspace() {
  const uuid = await readClaudeWorkspace();
  if (uuid) {
    try {
      await chrome.storage.local.set({ [CLAUDE_WORKSPACE_STORAGE_KEY]: uuid });
    } catch {
      // A transient storage failure just means the pane keeps its last value.
    }
  }
  return uuid;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SYNC_CLAUDE_WORKSPACE") {
    publishClaudeWorkspace().then((uuid) => sendResponse({ uuid }));
    return true; // keep the message channel open for the async response
  }
  return undefined;
});

chrome.cookies?.onChanged?.addListener((change) => {
  const cookie = change.cookie;
  if (
    cookie?.name === CLAUDE_LAST_ACTIVE_ORG_COOKIE &&
    cookie.domain.replace(/^\./, "").endsWith("claude.ai")
  ) {
    void publishClaudeWorkspace();
  }
});

function getAppUrl() {
  return chrome.runtime.getURL(APP_PATH);
}

async function openMultiPanel() {
  // Always open a fresh tab so pending actions land in a new workspace,
  // never reused into an existing one.
  await chrome.tabs.create({
    url: getAppUrl(),
    active: true,
  });
}

async function setPendingAction(action, payload = {}) {
  const pendingAction = {
    action,
    payload,
    createdAt: Date.now(),
  };

  try {
    await chrome.storage.session.set({ [PENDING_MULTI_PANEL_ACTION_KEY]: pendingAction });
    return;
  } catch {
    // fall through
  }

  try {
    await chrome.storage.local.set({ [PENDING_MULTI_PANEL_ACTION_KEY]: pendingAction });
  } catch {
    // ignore storage failures
  }
}

async function createContextMenus() {
  try {
    await chrome.contextMenus.removeAll();
  } catch {
    // ignore stale menu removal failures
  }

  // Use the callback form so we can swallow `lastError`. Without this,
  // when onInstalled + onStartup fire close together (or the service
  // worker respawns between them), the second create() collides with
  // the still-present item and Chrome surfaces "Unchecked runtime.lastError:
  // Cannot create item with duplicate id …" in DevTools.
  await new Promise((resolve) => {
    chrome.contextMenus.create(
      {
        id: CONTEXT_MENU_ID,
        title: "Pre-fill this in Parallel AI",
        contexts: ["page", "selection", "link", "image"],
      },
      () => {
        // Touch lastError so Chrome marks it as handled.
        void chrome.runtime.lastError;
        resolve();
      },
    );
  });
}

function isFetchableImageSrc(srcUrl) {
  try {
    const protocol = new URL(srcUrl).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function getSelectedTextFromContext(info) {
  return (
    (typeof info.selectionText === "string" && info.selectionText.trim() && info.selectionText) ||
    (typeof info.linkUrl === "string" && info.linkUrl.trim() && info.linkUrl) ||
    (typeof info.pageUrl === "string" && info.pageUrl.trim() && info.pageUrl) ||
    ""
  );
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await createContextMenus();
  void publishClaudeWorkspace();

  // On a fresh install, open the workspace so the first-run onboarding tour
  // greets the user immediately. The tour itself decides whether to show based
  // on its own version-gated state in chrome.storage.local (see
  // src/multi-panel/onboarding/onboarding-storage.ts) — we only open the tab.
  if (details?.reason === "install") {
    await openMultiPanel();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await createContextMenus();
  void publishClaudeWorkspace();
});

chrome.action.onClicked.addListener(async () => {
  await openMultiPanel();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  // chrome.permissions.request MUST be the first awaited call so the user
  // gesture from the menu click stays valid. Any await before it will eat
  // the gesture and the prompt fails silently. We ask for <all_urls> once
  // rather than per-host so users aren't prompted on every new image CDN.
  if (info.mediaType === "image" && isFetchableImageSrc(info.srcUrl)) {
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
    } catch {
      // fall through to text path
    }
    if (granted) {
      await setPendingAction("attachImage", { imageUrl: info.srcUrl });
      await openMultiPanel();
      return;
    }
  }

  await setPendingAction("sendToPanel", { selectedText: getSelectedTextFromContext(info) });
  await openMultiPanel();
});
