// Parallel AI — Claude model selection sync (pane side).
//
// The model fallback picker (claude-model-fallback.ts, MAIN world) persists its
// selection in the iframe's localStorage. Chrome partitions storage for
// embedded third-party frames, and privacy settings ("block third-party
// cookies", "clear on exit") can empty or block that storage entirely, so on a
// fresh browser start the picker resets to its built-in default.
//
// This script mirrors the selection into chrome.storage.local, which belongs to
// the extension and survives partitioning and site-data clearing:
//
//  - On load, restores the stored selection into the iframe's localStorage and
//    notifies the MAIN-world picker via its selection event (detail is a JSON
//    string — primitives are the only values guaranteed to cross worlds).
//  - Listens for the picker's selection event and publishes changes back to
//    chrome.storage.local.
//  - Follows storage.onChanged so multiple panes stay in sync.
//
// Runs in the isolated world (needs chrome.storage) at document_start.

(() => {
  if (window.top === window.self) return;

  const STORAGE_KEY = "parallel-ai:claude:model-fallback";
  const SYNC_KEY = "claudeModelFallbackSelection";
  const EVENT_NAME = "parallel-ai:claude-model-fallback-select";

  // Set while we dispatch the selection event ourselves so our own listener
  // does not republish the value we just restored.
  let applying = false;

  function safeParse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function isValidSelection(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const parsed = safeParse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return false;
    }
    const id = (parsed as Record<string, unknown>).id;
    return typeof id === "string" && id.startsWith("claude-");
  }

  function readLocal(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw && isValidSelection(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  function applyToIframe(raw: unknown) {
    if (!isValidSelection(raw)) return;
    if (readLocal() === raw) return;
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      // localStorage can be blocked in some iframe contexts; the event below
      // still updates the picker's in-memory selection.
    }
    applying = true;
    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: raw }));
    } finally {
      applying = false;
    }
  }

  function publish(raw: string | null) {
    if (!isValidSelection(raw)) return;
    chrome.storage.local.get(SYNC_KEY, (result) => {
      if (chrome.runtime.lastError) return;
      if (result?.[SYNC_KEY] === raw) return;
      chrome.storage.local.set({ [SYNC_KEY]: raw });
    });
  }

  function serializeDetail(detail: unknown): string | null {
    if (typeof detail === "string") return detail;
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
      return null;
    }
    try {
      return JSON.stringify(detail);
    } catch {
      return null;
    }
  }

  window.addEventListener(EVENT_NAME, (event) => {
    if (applying) return;
    // The picker persists to localStorage before dispatching, so prefer that
    // canonical value; fall back to the event detail when localStorage is
    // blocked in this iframe.
    const detail = (event as CustomEvent<unknown>).detail;
    publish(readLocal() ?? serializeDetail(detail));
  });

  chrome.storage.local.get(SYNC_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    const stored = result?.[SYNC_KEY];
    if (isValidSelection(stored)) {
      applyToIframe(stored);
    } else {
      // First run after this feature ships: seed shared storage from the
      // selection already saved in the iframe, if any.
      publish(readLocal());
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(SYNC_KEY in changes)) return;
    const newValue = changes[SYNC_KEY].newValue;
    if (typeof newValue === "string") applyToIframe(newValue);
  });
})();
