import { describe, expect, it } from "vitest";

import { readStorage, seedStorage } from "../../setup/chrome-mock";
import {
  ONBOARDING_STATE_KEY,
  TOUR_VERSION,
  markTourCompleted,
  readOnboardingState,
  resetOnboarding,
  shouldShowTour,
} from "@/multi-panel/onboarding/onboarding-storage";

describe("onboarding-storage", () => {
  it("defaults to completedVersion 0 when nothing is stored", async () => {
    expect(await readOnboardingState()).toEqual({ completedVersion: 0 });
  });

  it("shows the tour for a fresh install", async () => {
    expect(await shouldShowTour()).toBe(true);
  });

  it("markTourCompleted writes the current TOUR_VERSION and suppresses the tour", async () => {
    await markTourCompleted();
    expect(readStorage("local")[ONBOARDING_STATE_KEY]).toEqual({
      completedVersion: TOUR_VERSION,
    });
    expect(await shouldShowTour()).toBe(false);
  });

  it("does not re-show once the current version has been completed", async () => {
    seedStorage("local", { [ONBOARDING_STATE_KEY]: { completedVersion: TOUR_VERSION } });
    expect(await shouldShowTour()).toBe(false);
  });

  it("re-shows after a future tour version bump", async () => {
    seedStorage("local", { [ONBOARDING_STATE_KEY]: { completedVersion: TOUR_VERSION - 1 } });
    expect(await shouldShowTour()).toBe(true);
  });

  it("resetOnboarding re-arms the tour (used by Replay)", async () => {
    await markTourCompleted();
    await resetOnboarding();
    expect(readStorage("local")[ONBOARDING_STATE_KEY]).toEqual({ completedVersion: 0 });
    expect(await shouldShowTour()).toBe(true);
  });

  it("ignores malformed stored state", async () => {
    seedStorage("local", { [ONBOARDING_STATE_KEY]: { completedVersion: "nope" } });
    expect(await readOnboardingState()).toEqual({ completedVersion: 0 });
  });

  it("no-ops gracefully without chrome.storage", async () => {
    const holder = globalThis as { chrome?: typeof chrome };
    const original = holder.chrome;
    delete holder.chrome;
    try {
      expect(await readOnboardingState()).toEqual({ completedVersion: 0 });
      await expect(markTourCompleted()).resolves.toBeUndefined();
    } finally {
      holder.chrome = original;
    }
  });
});
