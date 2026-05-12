import { useEffect, useState } from "react";

const POPUP_WIDTH = 1400;
const POPUP_HEIGHT = 900;

export function usePopupMode() {
  const [isPopupMode, setIsPopupMode] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.windows
      .getCurrent()
      .then((win) => {
        if (!cancelled) {
          setIsPopupMode(win.type === "popup");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsPopupMode(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePopupMode() {
    // Move the existing tab into a window of the opposite type so the iframe
    // sessions (provider chats) are preserved. Reopening the URL would reload
    // everything from scratch.
    const tab = await chrome.tabs.getCurrent();
    if (!tab?.id) {
      return;
    }
    const current = await chrome.windows.getCurrent();

    if (current.type === "popup") {
      const allWindows = await chrome.windows.getAll();
      const target = allWindows.find(
        (win) => win.type === "normal" && win.id !== current.id,
      );
      if (target?.id != null) {
        await chrome.tabs.move(tab.id, { windowId: target.id, index: -1 });
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(target.id, { focused: true });
      } else {
        await chrome.windows.create({ tabId: tab.id, type: "normal" });
      }
      setIsPopupMode(false);
    } else {
      await chrome.windows.create({
        tabId: tab.id,
        type: "popup",
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
      });
      setIsPopupMode(true);
    }
  }

  return { isPopupMode, togglePopupMode };
}
