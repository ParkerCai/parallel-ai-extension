import "../../content-scripts/enter-behavior-utils.js";
import "../../content-scripts/enter-behavior-mimo.js";
import "../../content-scripts/text-injection-all-providers.js";
import "../../content-scripts/file-injection.js";
import "../../content-scripts/scroll-sync.js";
import "../../content-scripts/focus-toggle.js";

import {
  isMiMoLoginControlLabel,
  syncMiMoCookiePartitionWithRetry,
} from "../shared/lib/mimo-cookie-sync";

const MIMO_LOGIN_PENDING_KEY = "parallel-ai-mimo-login-pending";
const MIMO_AUTO_LOGIN_CLICKED_KEY = "parallel-ai-mimo-auto-login-clicked";

function markLoginClick(event: MouseEvent) {
  // The automatic continuation click below must not reset its own guard.
  if (!event.isTrusted) return;
  const control = event
    .composedPath()
    .find(
      (item) =>
        item instanceof HTMLElement &&
        item.matches("button, a, [role='button']"),
    );
  if (!(control instanceof HTMLElement)) return;

  const label = (control.innerText || control.textContent || "").trim();
  if (isMiMoLoginControlLabel(label)) {
    sessionStorage.setItem(MIMO_LOGIN_PENDING_KEY, "1");
    sessionStorage.removeItem(MIMO_AUTO_LOGIN_CLICKED_KEY);
    return;
  }

  if (/(退出登录|登出|sign\s*out|log\s*out)/i.test(label)) {
    sessionStorage.removeItem(MIMO_LOGIN_PENDING_KEY);
    sessionStorage.removeItem(MIMO_AUTO_LOGIN_CLICKED_KEY);
  }
}

function findMiMoLoginControl(): HTMLElement | null {
  const controls = document.querySelectorAll<HTMLElement>(
    "button, a, [role='button']",
  );
  return (
    Array.from(controls).find((control) =>
      isMiMoLoginControlLabel(
        (control.innerText || control.textContent || "").trim(),
      ),
    ) || null
  );
}

if (
  window.location.hostname === "aistudio.xiaomimimo.com" &&
  window.parent === window.top &&
  window.parent !== window
) {
  document.addEventListener("click", markLoginClick, true);

  void (async () => {
    let loginContinuationClicked = false;
    const syncResult = await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage: async () => {
        const result = await chrome.runtime.sendMessage({
          type: "SYNC_MIMO_COOKIE_PARTITION",
        });
        if (result?.found) {
          sessionStorage.removeItem(MIMO_LOGIN_PENDING_KEY);
          sessionStorage.removeItem(MIMO_AUTO_LOGIN_CLICKED_KEY);
        }
        return result;
      },
      reload: () => window.location.reload(),
      storage: sessionStorage,
      onMissingCookie: () => {
        if (sessionStorage.getItem(MIMO_LOGIN_PENDING_KEY) !== "1") {
          return false;
        }
        if (sessionStorage.getItem(MIMO_AUTO_LOGIN_CLICKED_KEY) === "1") {
          return false;
        }

        const loginControl = findMiMoLoginControl();
        if (!loginControl) return false;

        sessionStorage.setItem(MIMO_AUTO_LOGIN_CLICKED_KEY, "1");
        loginContinuationClicked = true;
        loginControl.click();
        return true;
      },
    });

    // The click normally navigates the iframe. Leave the guards in place for
    // the next document, which will retry the cookie copy without clicking a
    // second time.
    if (loginContinuationClicked) return;

    if (sessionStorage.getItem(MIMO_LOGIN_PENDING_KEY) !== "1") return;
    if (sessionStorage.getItem(MIMO_AUTO_LOGIN_CLICKED_KEY) === "1") {
      sessionStorage.removeItem(MIMO_LOGIN_PENDING_KEY);
      sessionStorage.removeItem(MIMO_AUTO_LOGIN_CLICKED_KEY);
      return;
    }

    // Never continue a login after messaging failures or unsupported cookie
    // APIs. Only an authoritative first-party-cookie miss is actionable.
    if (syncResult?.supported !== true || syncResult.found !== false) return;

    const loginControl = findMiMoLoginControl();
    if (!loginControl) {
      sessionStorage.removeItem(MIMO_LOGIN_PENDING_KEY);
      return;
    }

    sessionStorage.setItem(MIMO_AUTO_LOGIN_CLICKED_KEY, "1");
    loginControl.click();
  })();
}
