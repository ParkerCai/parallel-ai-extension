import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { readStorage, seedStorage } from "../../setup/chrome-mock";
import { ONBOARDING_STATE_KEY, TOUR_VERSION } from "@/multi-panel/onboarding/onboarding-storage";
import { CHANGELOG_VERSION, getLatestChangelogEntry } from "@/multi-panel/whats-new/changelog";
import { CHANGELOG_STATE_KEY } from "@/multi-panel/whats-new/changelog-storage";
import { useChangelog } from "@/multi-panel/whats-new/useChangelog";
import { renderHookWithProviders } from "../../helpers/hook";

function renderController(ready: boolean) {
  return renderHookWithProviders(
    ({ ready: isReady }: { ready: boolean }) => useChangelog({ ready: isReady }),
    { initialProps: { ready } },
  );
}

const onboarded = () => seedStorage("local", {
  [ONBOARDING_STATE_KEY]: { completedVersion: TOUR_VERSION },
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useChangelog", () => {
  it("suppresses the toast on a fresh install but initializes the marker", async () => {
    // No onboarding completed => fresh install; the tour handles the welcome.
    const { result } = renderController(true);
    await waitFor(() =>
      expect(readStorage("local")[CHANGELOG_STATE_KEY]).toEqual({
        seenVersion: CHANGELOG_VERSION,
      }),
    );
    expect(result.current.entry).toBeNull();
  });

  it("shows the highlights once for an already-onboarded user on the introducing release", async () => {
    onboarded();
    const { result } = renderController(true);
    await waitFor(() => expect(result.current.entry).toEqual(getLatestChangelogEntry()));
    expect(readStorage("local")[CHANGELOG_STATE_KEY]).toEqual({ seenVersion: CHANGELOG_VERSION });
  });

  it("shows when the stored seenVersion is behind", async () => {
    seedStorage("local", { [CHANGELOG_STATE_KEY]: { seenVersion: CHANGELOG_VERSION - 1 } });
    const { result } = renderController(true);
    await waitFor(() => expect(result.current.entry).toEqual(getLatestChangelogEntry()));
    expect(readStorage("local")[CHANGELOG_STATE_KEY]).toEqual({ seenVersion: CHANGELOG_VERSION });
  });

  it("stays silent when already current", async () => {
    seedStorage("local", { [CHANGELOG_STATE_KEY]: { seenVersion: CHANGELOG_VERSION } });
    const { result } = renderController(true);
    await flush();
    expect(result.current.entry).toBeNull();
  });

  it("hides the toast until ready (tour gate), then reveals it", async () => {
    seedStorage("local", { [CHANGELOG_STATE_KEY]: { seenVersion: CHANGELOG_VERSION - 1 } });
    const { result, rerender } = renderController(false);
    await flush();
    expect(result.current.entry).toBeNull();

    rerender({ ready: true });
    await waitFor(() => expect(result.current.entry).toEqual(getLatestChangelogEntry()));
  });

  it("dismiss clears the toast for good", async () => {
    seedStorage("local", { [CHANGELOG_STATE_KEY]: { seenVersion: CHANGELOG_VERSION - 1 } });
    const { result } = renderController(true);
    await waitFor(() => expect(result.current.entry).not.toBeNull());
    act(() => result.current.dismiss());
    expect(result.current.entry).toBeNull();
  });
});
