// "What's new" seen-state.
//
// Lives in chrome.storage.local (per-device, like onboarding) and records the
// highest CHANGELOG_VERSION the user has seen. A *missing* key means a fresh
// install or a user predating this feature; useChangelog decides what that
// means: a fresh install is suppressed (the onboarding tour welcomes them),
// while an already-onboarded user sees the latest highlights once.

import { CHANGELOG_VERSION } from "./changelog";

export const CHANGELOG_STATE_KEY = "changelogState";

export interface ChangelogState {
  /** Highest CHANGELOG_VERSION the user has seen. */
  seenVersion: number;
}

function hasLocalStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

/**
 * Reads the stored state, or null when nothing valid has ever been written
 * (fresh install / pre-feature user). Distinguishing absent from zero is what
 * lets the controller suppress the toast on first run.
 */
export async function readChangelogState(): Promise<ChangelogState | null> {
  if (!hasLocalStorage()) {
    return null;
  }

  try {
    const result = await chrome.storage.local.get(CHANGELOG_STATE_KEY);
    const raw = result[CHANGELOG_STATE_KEY] as Partial<ChangelogState> | undefined;
    if (!raw || typeof raw.seenVersion !== "number" || !Number.isFinite(raw.seenVersion)) {
      return null;
    }
    return { seenVersion: raw.seenVersion };
  } catch {
    return null;
  }
}

/** Marks the current CHANGELOG_VERSION as seen so the toast won't show again. */
export async function markChangelogSeen(): Promise<void> {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    await chrome.storage.local.set({
      [CHANGELOG_STATE_KEY]: { seenVersion: CHANGELOG_VERSION },
    });
  } catch {
    // Best-effort; non-critical state.
  }
}
