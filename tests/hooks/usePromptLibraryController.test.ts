import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { usePromptLibraryController } from "@/multi-panel/hooks/usePromptLibraryController";
import {
  clearAllPrompts,
  savePrompt,
  type PromptRecord,
} from "@/shared/lib/prompt-manager";

const assetUrl = (path: string) => `chrome-extension://test/${path}`;

async function makeHarness(opts: { loaded?: boolean } = {}) {
  const setPrompt = vi.fn();
  const showStatus = vi.fn();
  const onPromptInserted = vi.fn();

  const utils = renderHookWithProviders(({ loaded }: { loaded: boolean }) =>
    usePromptLibraryController({
      assetUrl,
      loaded,
      onPromptInserted,
      setPrompt,
      showStatus,
    }),
    { initialProps: { loaded: opts.loaded ?? true } },
  );

  return { ...utils, setPrompt, showStatus, onPromptInserted };
}

describe("usePromptLibraryController", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("ParallelAiDB");
    await clearAllPrompts().catch(() => undefined);
    vi.restoreAllMocks();
  });

  it("loads the prompt library on mount when loaded=true", async () => {
    await savePrompt({ content: "hello", title: "Greeting" });
    const h = await makeHarness({ loaded: true });
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    expect(h.result.current.promptLibraryItems[0]!.title).toBe("Greeting");
  });

  it("does not load when loaded=false", async () => {
    await savePrompt({ content: "hello", title: "Greeting" });
    const h = await makeHarness({ loaded: false });
    await Promise.resolve();
    expect(h.result.current.promptLibraryItems).toEqual([]);
  });

  it("openPromptEditor seeds the draft state from a prompt", async () => {
    const saved = await savePrompt({ content: "x", title: "Y" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    act(() => {
      h.result.current.openPromptEditor(saved);
    });
    expect(h.result.current.promptEditorOpen).toBe(true);
    expect(h.result.current.promptEditorState.id).toBe(saved.id);
  });

  it("closePromptEditor resets state", async () => {
    const h = await makeHarness();
    act(() => h.result.current.openPromptEditor());
    act(() => h.result.current.closePromptEditor());
    expect(h.result.current.promptEditorOpen).toBe(false);
    expect(h.result.current.promptEditorState.id).toBeFalsy();
  });

  it("handleSavePromptEditor creates a new prompt when no id", async () => {
    const h = await makeHarness();
    act(() => {
      h.result.current.setPromptEditorState((current) => ({
        ...current,
        title: "Fresh",
        content: "Body",
      }));
    });
    await act(async () => {
      await h.result.current.handleSavePromptEditor();
    });
    await waitFor(() => expect(h.result.current.promptLibraryItems).toHaveLength(1));
    expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/saved/i));
  });

  it("handleSavePromptEditor updates when id is set", async () => {
    const saved = await savePrompt({ content: "old", title: "Old" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    act(() => h.result.current.openPromptEditor(saved));
    act(() => {
      h.result.current.setPromptEditorState((current) => ({
        ...current,
        content: "new body",
      }));
    });
    await act(async () => {
      await h.result.current.handleSavePromptEditor();
    });
    expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/updated/i));
  });

  it("handleDeletePrompt deletes when user confirms", async () => {
    const saved = await savePrompt({ content: "x", title: "Bye" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    window.confirm = vi.fn(() => true);
    await act(async () => {
      await h.result.current.handleDeletePrompt(saved);
    });
    await waitFor(() => expect(h.result.current.promptLibraryItems).toHaveLength(0));
  });

  it("handleDeletePrompt is a no-op when user cancels", async () => {
    const saved = await savePrompt({ content: "x", title: "Bye" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    window.confirm = vi.fn(() => false);
    await act(async () => {
      await h.result.current.handleDeletePrompt(saved);
    });
    expect(h.result.current.promptLibraryItems).toHaveLength(1);
  });

  it("handleToggleFavorite flips favorite + reports status", async () => {
    const saved = await savePrompt({ content: "x", title: "Y" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    await act(async () => {
      await h.result.current.handleToggleFavorite(saved);
    });
    expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/favor/i));
  });

  it("handleUsePrompt with no variables applies immediately", async () => {
    const saved = await savePrompt({ content: "hi {there}", title: "Y" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    // Get the saved record from the loaded library (it has the parsed variables).
    const promptWithoutVars: PromptRecord = { ...h.result.current.promptLibraryItems[0]!, variables: [] };
    await act(async () => {
      await h.result.current.handleUsePrompt(promptWithoutVars);
    });
    expect(h.setPrompt).toHaveBeenCalledWith("hi {there}");
    expect(h.onPromptInserted).toHaveBeenCalled();
  });

  it("handleUsePrompt with variables opens the variable modal", async () => {
    await savePrompt({ content: "Hi {name}", title: "Greet", variables: ["name"] });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    const record = h.result.current.promptLibraryItems[0]!;
    await act(async () => {
      await h.result.current.handleUsePrompt(record);
    });
    expect(h.result.current.variablePrompt?.id).toBe(record.id);
    expect(h.result.current.variableValues.name).toBe("");
  });

  it("handleApplyPromptVariables substitutes and applies", async () => {
    await savePrompt({ content: "Hi {name}", title: "Greet", variables: ["name"] });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    const record = h.result.current.promptLibraryItems[0]!;
    await act(async () => {
      await h.result.current.handleUsePrompt(record);
    });
    act(() => {
      h.result.current.setVariableValues({ name: "Alice" });
    });
    await act(async () => {
      await h.result.current.handleApplyPromptVariables();
    });
    expect(h.setPrompt).toHaveBeenCalledWith("Hi Alice");
  });

  it("filteredPromptLibraryItems narrows by search", async () => {
    await savePrompt({ content: "Plan a launch", title: "Launch plan", tags: ["launch"] });
    await savePrompt({ content: "Other content", title: "Misc" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(2));
    act(() => h.result.current.setPromptLibrarySearch("launch"));
    await waitFor(() => expect(h.result.current.filteredPromptLibraryItems).toHaveLength(1));
  });

  it("filteredPromptLibraryItems narrows by category", async () => {
    await savePrompt({ content: "x", title: "A", category: "Cat1" });
    await savePrompt({ content: "y", title: "B", category: "Cat2" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(2));
    act(() => h.result.current.setPromptLibraryCategory("Cat1"));
    await waitFor(() =>
      expect(h.result.current.filteredPromptLibraryItems.every((i) => i.category === "Cat1")).toBe(true),
    );
  });

  it("handleClearPromptLibrary clears when confirmed", async () => {
    await savePrompt({ content: "x", title: "A" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    window.confirm = vi.fn(() => true);
    await act(async () => {
      await h.result.current.handleClearPromptLibrary();
    });
    await waitFor(() => expect(h.result.current.promptLibraryItems).toHaveLength(0));
  });

  it("handleClearPromptLibrary no-ops when cancelled", async () => {
    await savePrompt({ content: "x", title: "A" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));
    window.confirm = vi.fn(() => false);
    await act(async () => {
      await h.result.current.handleClearPromptLibrary();
    });
    expect(h.result.current.promptLibraryItems).toHaveLength(1);
  });

  it("handleExportPromptLibrary triggers a download", async () => {
    await savePrompt({ content: "x", title: "A" });
    const h = await makeHarness();
    await waitFor(() => expect(h.result.current.promptLibraryItems.length).toBe(1));

    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);
    URL.createObjectURL = vi.fn(() => "blob:fake");

    await act(async () => {
      await h.result.current.handleExportPromptLibrary();
    });
    expect(click).toHaveBeenCalled();
  });
});
