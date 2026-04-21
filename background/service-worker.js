const APP_PATH = "multi-panel/index.html";
const CONTEXT_MENU_ID = "open-parallel-ai";
const PENDING_MULTI_PANEL_ACTION_KEY = "pendingMultiPanelAction";

function getAppUrl() {
  return chrome.runtime.getURL(APP_PATH);
}

async function openMultiPanel() {
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

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Open in parallel-ai",
    contexts: ["page", "selection", "link"],
  });
}

async function getContextPayload(info) {
  if (typeof info.selectionText === "string" && info.selectionText.trim()) {
    return { selectedText: info.selectionText };
  }

  if (typeof info.linkUrl === "string" && info.linkUrl.trim()) {
    return { selectedText: info.linkUrl };
  }

  if (typeof info.pageUrl === "string" && info.pageUrl.trim()) {
    return { selectedText: info.pageUrl };
  }

  return { selectedText: "" };
}

chrome.runtime.onInstalled.addListener(async () => {
  await createContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await createContextMenus();
});

chrome.action.onClicked.addListener(async () => {
  await openMultiPanel();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  await setPendingAction("sendToPanel", await getContextPayload(info));
  await openMultiPanel();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-prompt-library") {
    return;
  }

  await setPendingAction("openPromptLibrary");
  await openMultiPanel();
});

