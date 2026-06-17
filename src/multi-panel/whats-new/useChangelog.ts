import { useCallback, useEffect, useState } from "react";

import { TOUR_VERSION, readOnboardingState } from "@/multi-panel/onboarding/onboarding-storage";
import { CHANGELOG_VERSION, getLatestChangelogEntry, type ChangelogEntry } from "./changelog";
import { markChangelogSeen, readChangelogState } from "./changelog-storage";

export interface ChangelogController {
  /** The entry to surface in the toast, or null when nothing should show. */
  entry: ChangelogEntry | null;
  /** Hide the toast. The seen marker is persisted when the entry is decided (at
   * mount), independent of whether the toast ever renders. */
  dismiss: () => void;
}

/**
 * Decides whether to surface the "what's new" toast.
 *
 * The decision is made once at mount from the stored marker (so it reflects
 * true load-time state, before the onboarding tour can complete and shift it),
 * while `ready` only gates *display* — pass it false until the app is hydrated
 * and the tour is idle, so the toast never stacks on the first-run overlay.
 *
 * - Marker behind CHANGELOG_VERSION: show once (the normal update case).
 * - No marker yet: initialize it. A brand-new install (onboarding not completed
 *   — the tour handles their welcome) stays silent; an existing user updating
 *   into the first build that ships the changelog sees the highlights once.
 */
export function useChangelog({ ready }: { ready: boolean }): ChangelogController {
  const [pending, setPending] = useState<ChangelogEntry | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [state, onboarding] = await Promise.all([
        readChangelogState(),
        readOnboardingState(),
      ]);
      if (cancelled) {
        return;
      }

      // Already current — nothing new to show.
      const behind = state === null || state.seenVersion < CHANGELOG_VERSION;
      if (!behind) {
        return;
      }

      // Advance the marker so this only happens once. Suppress on a genuine fresh
      // install (no marker AND onboarding unfinished — the tour welcomes them);
      // everyone else sees the latest highlights once.
      void markChangelogSeen();
      const isFreshInstall = state === null && onboarding.completedVersion < TOUR_VERSION;
      const latest = getLatestChangelogEntry();
      if (latest && !isFreshInstall) {
        setPending(latest);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { entry: ready && !dismissed ? pending : null, dismiss };
}
