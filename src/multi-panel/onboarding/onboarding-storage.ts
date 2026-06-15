// Onboarding completion state.
//
// Kept in `chrome.storage.local` (NOT `ExtensionSettings`) on purpose: onboarding
// is inherently per-install / per-device, so it must not sync across devices and
// must not bloat settings import/export. The tour shows whenever the highest tour
// version the user has finished is below the current `TOUR_VERSION`, which covers
// fresh installs (no stored state) and existing users on the update that ships a
// new tour — each exactly once. Bump `TOUR_VERSION` to re-introduce the tour after
// a major UI redesign.

export const ONBOARDING_STATE_KEY = "onboardingState";

// IMPORTANT: keep this in sync with the literal mirrored in
// background/service-worker.js (it cannot import this module).
export const TOUR_VERSION = 1;

export interface OnboardingState {
  /** Highest tour version the user has completed or skipped. */
  completedVersion: number;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = { completedVersion: 0 };

function hasLocalStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

export async function readOnboardingState(): Promise<OnboardingState> {
  if (!hasLocalStorage()) {
    return { ...DEFAULT_ONBOARDING_STATE };
  }

  try {
    const result = await chrome.storage.local.get({
      [ONBOARDING_STATE_KEY]: DEFAULT_ONBOARDING_STATE,
    });
    const raw = result[ONBOARDING_STATE_KEY] as Partial<OnboardingState> | undefined;
    const completedVersion =
      typeof raw?.completedVersion === "number" && Number.isFinite(raw.completedVersion)
        ? raw.completedVersion
        : 0;
    return { completedVersion };
  } catch {
    return { ...DEFAULT_ONBOARDING_STATE };
  }
}

async function writeOnboardingState(state: OnboardingState): Promise<void> {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    await chrome.storage.local.set({ [ONBOARDING_STATE_KEY]: state });
  } catch {
    // Best-effort; onboarding is non-critical state.
  }
}

/** True when the tour should be shown for this install (not yet seen this version). */
export async function shouldShowTour(): Promise<boolean> {
  const state = await readOnboardingState();
  return state.completedVersion < TOUR_VERSION;
}

/** Mark the current tour version as seen (finished or skipped). */
export async function markTourCompleted(): Promise<void> {
  await writeOnboardingState({ completedVersion: TOUR_VERSION });
}

/** Reset so the tour shows again — used by the in-app "Replay tutorial" action. */
export async function resetOnboarding(): Promise<void> {
  await writeOnboardingState({ ...DEFAULT_ONBOARDING_STATE });
}
