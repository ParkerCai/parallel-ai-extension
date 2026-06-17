import { describe, expect, it } from "vitest";

import { readStorage, seedStorage } from "../../setup/chrome-mock";
import { CHANGELOG_VERSION } from "@/multi-panel/whats-new/changelog";
import {
  CHANGELOG_STATE_KEY,
  markChangelogSeen,
  readChangelogState,
} from "@/multi-panel/whats-new/changelog-storage";

describe("changelog-storage", () => {
  it("returns null when nothing is stored (fresh install)", async () => {
    expect(await readChangelogState()).toBeNull();
  });

  it("markChangelogSeen writes the current CHANGELOG_VERSION", async () => {
    await markChangelogSeen();
    expect(readStorage("local")[CHANGELOG_STATE_KEY]).toEqual({ seenVersion: CHANGELOG_VERSION });
    expect(await readChangelogState()).toEqual({ seenVersion: CHANGELOG_VERSION });
  });

  it("reads a previously stored seenVersion", async () => {
    seedStorage("local", { [CHANGELOG_STATE_KEY]: { seenVersion: 0 } });
    expect(await readChangelogState()).toEqual({ seenVersion: 0 });
  });

  it("treats malformed state as absent", async () => {
    seedStorage("local", { [CHANGELOG_STATE_KEY]: { seenVersion: "nope" } });
    expect(await readChangelogState()).toBeNull();
  });

  it("no-ops gracefully without chrome.storage", async () => {
    const holder = globalThis as { chrome?: typeof chrome };
    const original = holder.chrome;
    delete holder.chrome;
    try {
      expect(await readChangelogState()).toBeNull();
      await expect(markChangelogSeen()).resolves.toBeUndefined();
    } finally {
      holder.chrome = original;
    }
  });
});
