const APP_PATH = "multi-panel/index.html";
const CONTEXT_MENU_ID = "open-parallel-ai";
const PENDING_MULTI_PANEL_ACTION_KEY = "pendingMultiPanelAction";
const MIMO_COOKIE_HOST = "aistudio.xiaomimimo.com";
const MIMO_COOKIE_ORIGIN = `https://${MIMO_COOKIE_HOST}/`;
const MIMO_PUBLIC_AUTH_COOKIE = "xiaomichatbot_ph";
const ENABLED_PROVIDERS_STORAGE_KEY = "enabledProviders";
// Existing installs should keep the pre-MiMo default until the user opts in.
// Keep this list explicit so adding a provider to the registry never silently
// enables it for users upgrading from an older version.
const PRE_MIMO_ENABLED_PROVIDERS = [
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "deepseek",
  "kimi",
  "qwen",
  "meta",
  "google",
];
// Fresh installs should persist the current defaults so a later update does
// not mistake the missing setting for a pre-MiMo install.
const CURRENT_ENABLED_PROVIDERS = [
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "deepseek",
  "kimi",
  "qwen",
  "mimo",
  "meta",
  "google",
];

async function readEnabledProviders(area) {
  const storageArea = chrome.storage?.[area];
  if (!storageArea?.get) {
    return { ok: false, value: undefined };
  }

  try {
    const items = await storageArea.get([ENABLED_PROVIDERS_STORAGE_KEY]);
    return {
      ok: true,
      value: items?.[ENABLED_PROVIDERS_STORAGE_KEY],
    };
  } catch {
    return { ok: false, value: undefined };
  }
}

async function writeEnabledProviders(area, enabledProviders) {
  const storageArea = chrome.storage?.[area];
  if (!storageArea?.set) return false;

  try {
    await storageArea.set({ [ENABLED_PROVIDERS_STORAGE_KEY]: enabledProviders });
    return true;
  } catch {
    return false;
  }
}

async function migrateEnabledProvidersOnUpdate(fallbackProviders = PRE_MIMO_ENABLED_PROVIDERS) {
  const syncState = await readEnabledProviders("sync");

  // A stored array is an explicit user choice, including an empty array or a
  // custom list. Never replace it with a provider default during an update.
  if (Array.isArray(syncState.value)) return;

  const localState = await readEnabledProviders("local");
  if (Array.isArray(localState.value)) {
    // When sync is available, copy the user's existing local setting into it.
    // If sync.set fails, leaving the local value untouched is the safe
    // fallback; a later settings read can still use local storage.
    if (syncState.ok) {
      await writeEnabledProviders("sync", localState.value);
    }
    return;
  }

  const fallback = [...fallbackProviders];
  if (syncState.ok && (await writeEnabledProviders("sync", fallback))) return;

  // Sync was unavailable or rejected the write. Only seed local storage when
  // its read succeeded and confirmed that no array exists, so a transient
  // read error cannot cause us to overwrite an existing user setting.
  if (localState.ok) {
    await writeEnabledProviders("local", fallback);
  }
}

async function syncMiMoCookiesToFrame(sender) {
  const tabId = sender?.tab?.id;
  const frameId = sender?.frameId;

  let senderHost = "";
  try {
    senderHost = new URL(sender?.url || "").hostname;
  } catch {
    // The sender validation below will reject malformed URLs.
  }
  if (senderHost !== MIMO_COOKIE_HOST) {
    return { supported: false, found: false, changed: false };
  }

  try {
    // The partition key for an extension-owned iframe is deterministic. Some
    // Chromium builds do not expose getPartitionKey to extensions, so derive
    // the same top-level site from this extension's own origin as a fallback.
    let partitionKey = {
      topLevelSite: chrome.runtime.getURL("/").replace(/\/$/, ""),
    };
    if (
      chrome.cookies?.getPartitionKey &&
      typeof tabId === "number" &&
      typeof frameId === "number"
    ) {
      try {
        const resolved = await chrome.cookies.getPartitionKey({
          tabId,
          frameId,
        });
        if (
          resolved?.partitionKey?.topLevelSite?.startsWith(
            "chrome-extension://",
          )
        ) {
          partitionKey = resolved.partitionKey;
        }
      } catch {
        // The derived extension origin above is the same partition key.
      }
    }

    // Network requests from an extension-owned iframe can use the first-party
    // MiMo cookie jar because the extension has host permission. JavaScript
    // document.cookie is still partitioned, however. MiMo reads this one
    // non-HttpOnly value and appends it to every POST request, so mirror only
    // that value rather than copying the user's full login cookie set.
    const sourceCookie = await chrome.cookies.get({
      url: MIMO_COOKIE_ORIGIN,
      name: MIMO_PUBLIC_AUTH_COOKIE,
    });
    if (!sourceCookie?.value) {
      const stalePartitionedCookie = await chrome.cookies.get({
        url: MIMO_COOKIE_ORIGIN,
        name: MIMO_PUBLIC_AUTH_COOKIE,
        partitionKey,
      });
      if (!stalePartitionedCookie) {
        return { supported: true, found: false, changed: false };
      }

      const removed = await chrome.cookies.remove({
        url: MIMO_COOKIE_ORIGIN,
        name: MIMO_PUBLIC_AUTH_COOKIE,
        storeId: stalePartitionedCookie.storeId,
        partitionKey,
      });
      return {
        supported: true,
        found: false,
        changed: Boolean(removed),
      };
    }

    const partitionedCookie = await chrome.cookies.get({
      url: MIMO_COOKIE_ORIGIN,
      name: MIMO_PUBLIC_AUTH_COOKIE,
      storeId: sourceCookie.storeId,
      partitionKey,
    });
    if (partitionedCookie?.value === sourceCookie.value) {
      return { supported: true, found: true, changed: false };
    }

    const details = {
      url: MIMO_COOKIE_ORIGIN,
      name: MIMO_PUBLIC_AUTH_COOKIE,
      value: sourceCookie.value,
      path: sourceCookie.path || "/",
      secure: true,
      // MiMo must be able to read this value through document.cookie.
      httpOnly: false,
      sameSite: "no_restriction",
      storeId: sourceCookie.storeId,
      partitionKey,
    };
    if (
      !sourceCookie.session &&
      typeof sourceCookie.expirationDate === "number"
    ) {
      details.expirationDate = sourceCookie.expirationDate;
    }

    const result = await chrome.cookies.set(details);
    return {
      supported: true,
      found: true,
      changed: Boolean(result),
    };
  } catch {
    return { supported: true, found: false, changed: false };
  }
}

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
  try {
    if (uuid) {
      await chrome.storage.local.set({ [CLAUDE_WORKSPACE_STORAGE_KEY]: uuid });
    } else {
      // Cookie gone or invalid (logout, cleared cookies): drop the stale pin so
      // the pane stops forcing a workspace the user is no longer on.
      await chrome.storage.local.remove(CLAUDE_WORKSPACE_STORAGE_KEY);
    }
  } catch {
    // A transient storage failure just means the pane keeps its last value.
  }
  return uuid;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SYNC_CLAUDE_WORKSPACE") {
    publishClaudeWorkspace().then((uuid) => sendResponse({ uuid }));
    return true; // keep the message channel open for the async response
  }
  if (message?.type === "SYNC_MIMO_COOKIE_PARTITION") {
    syncMiMoCookiesToFrame(_sender).then(sendResponse);
    return true;
  }
  return undefined;
});

chrome.cookies?.onChanged?.addListener((change) => {
  const cookie = change.cookie;
  if (cookie?.name !== CLAUDE_LAST_ACTIVE_ORG_COOKIE) return;
  const domain = cookie.domain.replace(/^\./, "");
  if (domain === "claude.ai" || domain.endsWith(".claude.ai")) {
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

  if (details?.reason === "update") {
    await migrateEnabledProvidersOnUpdate();
  }

  // On a fresh install, open the workspace so the first-run onboarding tour
  // greets the user immediately. The tour itself decides whether to show based
  // on its own version-gated state in chrome.storage.local (see
  // src/multi-panel/onboarding/onboarding-storage.ts) — we only open the tab.
  if (details?.reason === "install") {
    await migrateEnabledProvidersOnUpdate(CURRENT_ENABLED_PROVIDERS);
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
