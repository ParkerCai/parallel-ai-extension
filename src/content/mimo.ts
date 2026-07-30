import "../../content-scripts/enter-behavior-utils.js";
import "../../content-scripts/enter-behavior-mimo.js";
import "../../content-scripts/text-injection-all-providers.js";
import "../../content-scripts/file-injection.js";
import "../../content-scripts/scroll-sync.js";
import "../../content-scripts/focus-toggle.js";

const MIMO_COOKIE_SYNC_RELOAD_KEY = "parallel-ai-mimo-cookie-sync-reloaded";

if (
  window.location.hostname === "aistudio.xiaomimimo.com" &&
  window.parent === window.top &&
  window.parent !== window
) {
  void chrome.runtime
    .sendMessage({ type: "SYNC_MIMO_COOKIE_PARTITION" })
    .then((result) => {
      if (
        result?.changed &&
        sessionStorage.getItem(MIMO_COOKIE_SYNC_RELOAD_KEY) !== "1"
      ) {
        sessionStorage.setItem(MIMO_COOKIE_SYNC_RELOAD_KEY, "1");
        window.location.reload();
      } else if (!result?.changed) {
        sessionStorage.removeItem(MIMO_COOKIE_SYNC_RELOAD_KEY);
      }
    })
    .catch(() => {
      // Keep the provider usable even when cookie partition sync is unavailable.
    });
}
