// What's-new changelog.
//
// Each notable release prepends an entry below AND bumps CHANGELOG_VERSION, so
// existing users see a one-time "what's new" toast on their next launch after
// updating. Patch releases with no user-facing changes leave both untouched and
// stay silent. The newest entry (CHANGELOG[0]) drives both the toast and the
// Settings -> About "What's new" panel.

export interface ChangelogEntry {
  /** Display version, e.g. "1.0.4". */
  version: string;
  /** Short, user-facing highlights. Keep to a few lines. */
  highlights: string[];
}

// Monotonic counter bumped whenever a release adds a user-facing entry below.
// Kept separate from the semantic version so silent patch releases don't trip
// the toast; it is the value compared against the user's last-seen marker.
export const CHANGELOG_VERSION = 3;

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.5",
    highlights: [
      "Claude panels now follow the workspace you selected on claude.ai, so accounts with more than one workspace no longer get stuck sending on the wrong one.",
    ],
  },
  {
    version: "1.0.4",
    highlights: [
      "Claude is usable again on accounts that showed a broken model selector: the panel now provides a working model picker with effort and thinking controls.",
    ],
  },
  {
    version: "1.0.3",
    highlights: [
      "Session persistence: your panels and conversations now reopen where you left them after a reload or restart.",
    ],
  },
];

/** The entry surfaced in the toast and About panel (newest), or null if empty. */
export function getLatestChangelogEntry(): ChangelogEntry | null {
  return CHANGELOG[0] ?? null;
}
