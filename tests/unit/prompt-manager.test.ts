import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAllPrompts,
  exportPrompts,
  getAllPrompts,
  getFavoritePrompts,
  getPrompt,
  importDefaultLibrary,
  importPrompts,
  recordPromptUsage,
  savePrompt,
  searchPrompts,
  toggleFavorite,
  updatePrompt,
} from "@/shared/lib/prompt-manager";

describe("prompt-manager", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("ParallelAiDB");
    await clearAllPrompts().catch(() => undefined);
  });

  it("validates required prompt content", async () => {
    await expect(savePrompt({ content: "" })).rejects.toThrow("Prompt content is required");
  });

  it("saves and reads prompts", async () => {
    const saved = await savePrompt({
      category: "Research",
      content: "Explain {topic}",
      tags: ["analysis"],
      title: "Explain topic",
      variables: ["topic"],
    });

    await expect(getPrompt(saved.id)).resolves.toMatchObject({
      id: saved.id,
      title: "Explain topic",
    });
  });

  it("updates prompts, favorites, and usage stats", async () => {
    const saved = await savePrompt({
      content: "Draft content",
      title: "Draft",
    });

    await updatePrompt(saved.id, { content: "Updated content" });
    await toggleFavorite(saved.id);
    await recordPromptUsage(saved.id);

    const prompt = await getPrompt(saved.id);
    expect(prompt).toMatchObject({
      content: "Updated content",
      isFavorite: true,
    });
    expect(prompt?.useCount).toBe(1);
    expect(prompt?.lastUsed).toBeTypeOf("number");
  });

  it("searches prompts and exports libraries", async () => {
    await savePrompt({
      content: "Plan a launch checklist",
      tags: ["launch"],
      title: "Launch plan",
    });

    await expect(searchPrompts("launch")).resolves.toHaveLength(1);
    await expect(exportPrompts()).resolves.toMatchObject({
      prompts: expect.any(Array),
      version: "1.0",
    });
  });

  it("imports libraries and skips duplicate default prompts", async () => {
    const defaults = [
      {
        category: "General",
        content: "Hello {name}",
        title: "Greeting",
        variables: ["name"],
      },
    ];

    const first = await importDefaultLibrary(defaults);
    const second = await importDefaultLibrary(defaults);

    expect(first.imported).toBe(1);
    expect(second.skipped).toBe(1);
  });

  it("imports prompt payloads and exposes favorites", async () => {
    await importPrompts({
      prompts: [
        {
          content: "One",
          isFavorite: true,
          title: "Favorite prompt",
        },
      ],
      version: "1.0",
    });

    await expect(getFavoritePrompts()).resolves.toHaveLength(1);
    await expect(getAllPrompts()).resolves.toHaveLength(1);
  });
});
