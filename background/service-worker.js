const APP_PATH = "multi-panel/index.html";
const CONTEXT_MENU_ID = "open-parallel-ai";
const PENDING_MULTI_PANEL_ACTION_KEY = "pendingMultiPanelAction";
const MIMO_COOKIE_HOST = "aistudio.xiaomimimo.com";
const MIMO_COOKIE_ORIGIN = `https://${MIMO_COOKIE_HOST}/`;
const MIMO_PUBLIC_AUTH_COOKIE = "xiaomichatbot_ph";
const MIMO_AUTH_SESSION_RULE_ID = 17_001;
const ZAI_FRAME_SESSION_RULE_ID = 17_002;
const MIMO_AUTH_URL_REGEX =
  "^https://(account|global\\.account|logout\\.account)\\.xiaomi\\.com/";
const ZAI_FRAME_URL_FILTER = "|https://chat.z.ai/";
const WORKSPACE_FRAME_SESSION_RULE_IDS = [
  MIMO_AUTH_SESSION_RULE_ID,
  ZAI_FRAME_SESSION_RULE_ID,
];
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
  "zai",
  "mimo",
  "meta",
  "google",
];

let workspaceFramingRuleUpdate = Promise.resolve();

// Developer convenience: Chrome closes extension pages when an unpacked
// extension is reloaded. Their URLs already contain the workspace state.
// getSelf() needs no extra permission; Web Store installs never use this path.
const DEV_WORKSPACES_KEY = "devOpenWorkspaces";
const isDevelopmentInstall = Promise.resolve(chrome.management?.getSelf?.())
  .then((self) => self?.installType === "development")
  .catch(() => false);
let devWorkspaceUpdate = Promise.resolve();

function queueDevWorkspaceUpdate(update) {
  // Serialize tab events with restoration so newly opened tabs cannot replace
  // the saved list while we are still reading/reopening it.
  devWorkspaceUpdate = devWorkspaceUpdate.then(async () => {
    if (!(await isDevelopmentInstall)) return;
    const saved = (await chrome.storage.local.get(DEV_WORKSPACES_KEY))[DEV_WORKSPACES_KEY];
    const workspaces = (Array.isArray(saved) ? saved : [])
      .filter((tab) => Number.isInteger(tab?.id) && isMultiPanelTabUrl(tab?.url));
    await chrome.storage.local.set({ [DEV_WORKSPACES_KEY]: await update(workspaces) });
  }).catch((error) => console.warn("Could not preserve development workspaces", error));
  return devWorkspaceUpdate;
}

function rememberDevWorkspace(tabId, url) {
  return queueDevWorkspaceUpdate((saved) => {
    const next = saved.filter((tab) => tab.id !== tabId);
    if (isMultiPanelTabUrl(url)) next.push({ id: tabId, url });
    return next;
  });
}

function restoreDevWorkspaces() {
  return queueDevWorkspaceUpdate(async (saved) => {
    const openIds = new Set((await chrome.tabs.query({})).map((tab) => tab.id));
    const restored = [];
    for (const tab of saved) {
      if (openIds.has(tab.id)) {
        restored.push(tab);
      } else {
        try {
          const opened = await chrome.tabs.create({ url: tab.url, active: false });
          restored.push({ id: opened.id, url: tab.url });
        } catch (error) {
          // Keep the stale record so a later reload retries only this tab. Any
          // earlier successful replacements are still persisted below.
          console.warn("Could not restore development workspace", error);
          restored.push(tab);
        }
      }
    }
    return restored;
  });
}

function isMultiPanelTabUrl(value) {
  if (typeof value !== "string") return false;

  try {
    const actual = new URL(value);
    const expected = new URL(getAppUrl());
    return (
      actual.protocol === expected.protocol &&
      actual.hostname === expected.hostname &&
      actual.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

function getSessionRuleTabIds(rule) {
  return Array.isArray(rule?.condition?.tabIds)
    ? rule.condition.tabIds.filter(
        (tabId) => Number.isInteger(tabId) && tabId >= 0,
      )
    : [];
}

function buildWorkspaceFramingRules(tabIds) {
  return [
    {
      id: MIMO_AUTH_SESSION_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "X-Frame-Options", operation: "remove" },
        ],
      },
      condition: {
        regexFilter: MIMO_AUTH_URL_REGEX,
        resourceTypes: ["sub_frame"],
        tabIds,
      },
    },
    {
      id: ZAI_FRAME_SESSION_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "X-Frame-Options", operation: "remove" },
        ],
      },
      condition: {
        urlFilter: ZAI_FRAME_URL_FILTER,
        resourceTypes: ["sub_frame"],
        tabIds,
      },
    },
  ];
}

function updateWorkspaceFramingRuleTabs(mutator) {
  const run = async () => {
    if (
      !chrome.declarativeNetRequest?.getSessionRules ||
      !chrome.declarativeNetRequest?.updateSessionRules
    ) {
      return false;
    }

    try {
      const rules = await chrome.declarativeNetRequest.getSessionRules();
      const currentRules = rules.filter((rule) =>
        WORKSPACE_FRAME_SESSION_RULE_IDS.includes(rule.id),
      );
      const currentTabIds = [
        ...new Set(currentRules.flatMap(getSessionRuleTabIds)),
      ].sort((left, right) => left - right);
      const nextTabIds = [
        ...new Set(
          mutator(currentTabIds).filter(
            (tabId) => Number.isInteger(tabId) && tabId >= 0,
          ),
        ),
      ].sort((left, right) => left - right);

      const rulesAreSynchronized =
        currentRules.length === WORKSPACE_FRAME_SESSION_RULE_IDS.length &&
        WORKSPACE_FRAME_SESSION_RULE_IDS.every((ruleId) => {
          const rule = currentRules.find((candidate) => candidate.id === ruleId);
          const ruleTabIds = getSessionRuleTabIds(rule).sort(
            (left, right) => left - right,
          );
          return (
            ruleTabIds.length === nextTabIds.length &&
            ruleTabIds.every((tabId, index) => tabId === nextTabIds[index])
          );
        });

      if (
        currentTabIds.length === nextTabIds.length &&
        currentTabIds.every((tabId, index) => tabId === nextTabIds[index]) &&
        (nextTabIds.length === 0
          ? currentRules.length === 0
          : rulesAreSynchronized)
      ) {
        return true;
      }

      const update = {
        removeRuleIds: currentRules.map((rule) => rule.id),
      };
      if (nextTabIds.length > 0) {
        update.addRules = buildWorkspaceFramingRules(nextTabIds);
      }

      await chrome.declarativeNetRequest.updateSessionRules(update);
      return true;
    } catch {
      return false;
    }
  };

  const result = workspaceFramingRuleUpdate.then(run, run);
  workspaceFramingRuleUpdate = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function enableWorkspaceFramingForTab(tabId) {
  return updateWorkspaceFramingRuleTabs((tabIds) => [...tabIds, tabId]);
}

function disableWorkspaceFramingForTab(tabId) {
  return updateWorkspaceFramingRuleTabs((tabIds) =>
    tabIds.filter((candidate) => candidate !== tabId),
  );
}

async function syncWorkspaceFramingRulesWithOpenTabs() {
  if (!chrome.tabs?.query) return false;

  try {
    const tabs = await chrome.tabs.query({});
    const tabIds = tabs.flatMap((tab) => {
      const url = tab.url || tab.pendingUrl;
      return typeof tab.id === "number" && isMultiPanelTabUrl(url)
        ? [tab.id]
        : [];
    });
    return updateWorkspaceFramingRuleTabs(() => tabIds);
  } catch {
    return false;
  }
}

async function prepareWorkspaceFraming(sender) {
  const tabId = sender?.tab?.id;
  if (
    typeof tabId !== "number" ||
    (typeof sender?.frameId === "number" && sender.frameId !== 0) ||
    !isMultiPanelTabUrl(sender?.url)
  ) {
    return { ok: false };
  }

  return { ok: await enableWorkspaceFramingForTab(tabId) };
}

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
  if (
    senderHost !== MIMO_COOKIE_HOST ||
    typeof tabId !== "number" ||
    typeof frameId !== "number"
  ) {
    return { supported: false, found: false, changed: false };
  }

  try {
    const extensionTopLevelSite = chrome.runtime.getURL("/").replace(/\/$/, "");
    let partitionKey;
    if (chrome.cookies?.getPartitionKey) {
      try {
        const resolved = await chrome.cookies.getPartitionKey({
          tabId,
          frameId,
        });
        if (resolved?.partitionKey?.topLevelSite === extensionTopLevelSite) {
          partitionKey = resolved.partitionKey;
        }
      } catch {
        // The validated fallback below covers Chromium versions without a
        // usable frame partition-key result.
      }
    }

    if (!partitionKey) {
      if (!isMultiPanelTabUrl(sender?.tab?.url)) {
        return { supported: false, found: false, changed: false };
      }
      partitionKey = {
        topLevelSite: extensionTopLevelSite,
        hasCrossSiteAncestor: true,
      };
    }

    // Install the XFO exception only for this extension-owned workspace tab.
    // A session rule is removed when the tab closes and cannot make Xiaomi
    // account pages frameable from unrelated sites.
    if (!(await enableWorkspaceFramingForTab(tabId))) {
      return { supported: false, found: false, changed: false };
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    sender.frameId === 0 &&
    typeof sender.tab?.id === "number" &&
    isMultiPanelTabUrl(sender.url)
  ) {
    if (message?.type === "DEV_WORKSPACE_URL" && isMultiPanelTabUrl(message.url)) {
      rememberDevWorkspace(sender.tab.id, message.url).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message?.type === "PREPARE_WORKSPACE_FRAMING") {
      void rememberDevWorkspace(sender.tab.id, sender.url);
    }
  }
  if (message?.type === "PREPARE_WORKSPACE_FRAMING") {
    prepareWorkspaceFraming(sender).then(sendResponse);
    return true;
  }
  if (message?.type === "SYNC_CLAUDE_WORKSPACE") {
    publishClaudeWorkspace().then((uuid) => sendResponse({ uuid }));
    return true; // keep the message channel open for the async response
  }
  if (message?.type === "SYNC_MIMO_COOKIE_PARTITION") {
    syncMiMoCookiesToFrame(sender).then(sendResponse);
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

chrome.tabs?.onRemoved?.addListener((tabId) => {
  void rememberDevWorkspace(tabId, null);
  void disableWorkspaceFramingForTab(tabId);
});

chrome.tabs?.onCreated?.addListener((tab) => {
  if (
    typeof tab?.id === "number" &&
    isMultiPanelTabUrl(tab.pendingUrl || tab.url)
  ) {
    void enableWorkspaceFramingForTab(tab.id);
  }
});

chrome.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
  const changedUrl =
    typeof changeInfo?.url === "string" ? changeInfo.url : null;
  if (changedUrl) {
    if (isMultiPanelTabUrl(changedUrl)) {
      void enableWorkspaceFramingForTab(tabId);
    } else {
      void disableWorkspaceFramingForTab(tabId);
    }
    return;
  }

  // Prewarm rules when restore omits changeInfo.url. The workspace readiness
  // handshake still gates Z.ai and MiMo iframe creation on confirmed setup.
  if (
    changeInfo?.status === "loading" &&
    isMultiPanelTabUrl(tab?.pendingUrl || tab?.url)
  ) {
    void enableWorkspaceFramingForTab(tabId);
  }
});

function getAppUrl() {
  return chrome.runtime.getURL(APP_PATH);
}

async function openMultiPanel() {
  // Always open a fresh tab so pending actions land in a new workspace,
  // never reused into an existing one.
  const tab = await chrome.tabs.create({
    url: "about:blank",
    active: true,
  });
  if (typeof tab?.id === "number") {
    await enableWorkspaceFramingForTab(tab.id);
    await chrome.tabs.update(tab.id, { url: getAppUrl() });
  }
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
  // An unpacked reload fires onInstalled with reason "update". Restore before
  // any startup work can overwrite the snapshot; worker wakeups never restore.
  if (details?.reason === "update") await restoreDevWorkspaces();
  await syncWorkspaceFramingRulesWithOpenTabs();
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
  await queueDevWorkspaceUpdate(() => []);
  await syncWorkspaceFramingRulesWithOpenTabs();
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
