import { useEffect, useMemo, useState, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PromptEditorModal,
  PromptLibraryModal,
  VariableInputModal,
  editorStateToPromptDraft,
  promptToEditorState,
  type PromptEditorFormState,
  type PromptListFilter,
} from "@/multi-panel/components/PromptLibraryModal";
import {
  clearAllPrompts,
  getAllPrompts,
  savePrompt,
  type PromptRecord,
} from "@/shared/lib/prompt-manager";
import { renderWithProviders } from "../helpers/render";

beforeEach(async () => {
  indexedDB.deleteDatabase("ParallelAiDB");
  await clearAllPrompts().catch(() => undefined);
});

interface LibraryHarnessOptions {
  initialFilter?: PromptListFilter;
  initialQuery?: string;
}

function LibraryHarness({
  handlers,
  options,
}: {
  handlers: ReturnType<typeof buildLibraryHandlers>;
  options: LibraryHarnessOptions;
}) {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [query, setQuery] = useState(options.initialQuery ?? "");
  const [filter, setFilter] = useState<PromptListFilter>(options.initialFilter ?? "all");

  useEffect(() => {
    let cancelled = false;
    void getAllPrompts().then((all) => {
      if (!cancelled) setPrompts(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = prompts;
    if (filter === "favorites") list = list.filter((p) => p.isFavorite);
    if (query.trim()) {
      const needle = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          p.content.toLowerCase().includes(needle) ||
          p.tags.some((tag) => tag.toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [filter, prompts, query]);

  return (
    <PromptLibraryModal
      categories={["General"]}
      currentFilter={filter}
      onCategoryChange={() => undefined}
      onClose={handlers.onClose}
      onCreate={handlers.onCreate}
      onDelete={handlers.onDelete}
      onEdit={handlers.onEdit}
      onExport={handlers.onExport}
      onFilterChange={(next) => {
        handlers.onFilterChange(next);
        setFilter(next);
      }}
      onImportDefaults={handlers.onImportDefaults}
      onImportFile={handlers.onImportFile}
      onReorderFavorites={handlers.onReorderFavorites}
      onSearchChange={(next) => {
        handlers.onSearchChange(next);
        setQuery(next);
      }}
      onToggleFavorite={handlers.onToggleFavorite}
      onUse={handlers.onUse}
      open
      prompts={filtered}
      searchQuery={query}
      selectedCategory=""
    />
  );
}

function buildLibraryHandlers() {
  return {
    onClose: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onExport: vi.fn(),
    onFilterChange: vi.fn(),
    onImportDefaults: vi.fn(),
    onImportFile: vi.fn(),
    onReorderFavorites: vi.fn(),
    onSearchChange: vi.fn(),
    onToggleFavorite: vi.fn(),
    onUse: vi.fn(),
  };
}

async function seedPrompts(prompts: Array<Parameters<typeof savePrompt>[0]>) {
  for (const draft of prompts) await savePrompt(draft);
}

describe("PromptLibraryModal (browse view)", () => {
  it("renders an empty state when no prompts exist", async () => {
    const handlers = buildLibraryHandlers();
    const { findByText } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{}} />) as ReactElement,
    );
    expect(
      await findByText(/libraryEmptyTitle|No prompts found/i),
    ).toBeInTheDocument();
  });

  it("renders saved prompts in the list", async () => {
    await seedPrompts([
      { title: "Brainstorm", content: "Brainstorm ideas about {topic}", variables: ["topic"] },
      { title: "Summarize", content: "Summarize the following text" },
    ]);
    const handlers = buildLibraryHandlers();
    const { findByText, getByText } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{}} />) as ReactElement,
    );
    expect(await findByText("Brainstorm")).toBeInTheDocument();
    expect(getByText("Summarize")).toBeInTheDocument();
  });

  it("filters the list when the search query narrows it to one prompt", async () => {
    await seedPrompts([
      { title: "Brainstorm", content: "Brainstorm ideas" },
      { title: "Summarize", content: "Summarize" },
    ]);
    const handlers = buildLibraryHandlers();
    const { findByText, getByPlaceholderText, queryByText, user } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{}} />) as ReactElement,
    );
    await findByText("Brainstorm");
    const search = getByPlaceholderText(
      /librarySearchPlaceholder|Search prompts, tags, or content/i,
    );
    await user.type(search, "summa");
    expect(handlers.onSearchChange).toHaveBeenCalled();
    expect(queryByText("Brainstorm")).toBeNull();
    // "Summarize" appears in both the title heading and the content body,
    // so use a role-scoped query for the title.
    expect(await findByText("Summarize", { selector: "h3" })).toBeInTheDocument();
  });

  it("calls onToggleFavorite when the favorite (star) button is clicked", async () => {
    await seedPrompts([{ title: "Star me", content: "Body" }]);
    const handlers = buildLibraryHandlers();
    const { findByRole, user } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{}} />) as ReactElement,
    );
    const starButton = await findByRole("button", {
      name: /libraryAriaAddFavorite.*Star me|Add Star me to favorites/i,
    });
    await user.click(starButton);
    expect(handlers.onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleFavorite.mock.calls[0]![0]).toMatchObject({ title: "Star me" });
  });

  it("calls onEdit when the edit button is clicked", async () => {
    await seedPrompts([{ title: "Editable", content: "Text" }]);
    const handlers = buildLibraryHandlers();
    const { findByRole, user } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{}} />) as ReactElement,
    );
    const editButton = await findByRole("button", {
      name: /libraryAriaEdit.*Editable|Edit Editable/i,
    });
    await user.click(editButton);
    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onEdit.mock.calls[0]![0]).toMatchObject({ title: "Editable" });
  });

  it("calls onUse with the prompt when the Use button is clicked", async () => {
    await seedPrompts([{ title: "Useable", content: "Use me" }]);
    const handlers = buildLibraryHandlers();
    const { findByRole, user } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{}} />) as ReactElement,
    );
    const useButton = await findByRole("button", { name: /libraryUse|^Use$/i });
    await user.click(useButton);
    expect(handlers.onUse).toHaveBeenCalledTimes(1);
    expect(handlers.onUse.mock.calls[0]![0]).toMatchObject({ title: "Useable" });
  });

  it("shows only favorites when the favorites filter is active", async () => {
    await seedPrompts([
      { title: "Favorite", content: "Fav", isFavorite: true },
      { title: "Regular", content: "Reg", isFavorite: false },
    ]);
    const handlers = buildLibraryHandlers();
    const { findByText, queryByText } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{ initialFilter: "favorites" }} />) as ReactElement,
    );
    expect(await findByText("Favorite", { selector: "h3" })).toBeInTheDocument();
    expect(queryByText("Regular")).toBeNull();
  });

  it("opens a confirmation dialog when delete is clicked; confirming fires onDelete", async () => {
    await seedPrompts([{ title: "DeleteMe", content: "Body" }]);
    const handlers = buildLibraryHandlers();
    const { findByRole, getAllByRole, user } = renderWithProviders(
      (<LibraryHarness handlers={handlers} options={{}} />) as ReactElement,
    );
    const deleteButton = await findByRole("button", {
      name: /libraryAriaDelete.*DeleteMe|Delete DeleteMe/i,
    });
    await user.click(deleteButton);
    // confirm button in the confirm dialog
    const confirmButtons = getAllByRole("button", {
      name: /libraryDeleteConfirmLabel|^Delete$/i,
    });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("PromptEditorModal", () => {
  function renderEditor(initial?: Partial<PromptEditorFormState>) {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const onClose = vi.fn();
    const draft: PromptEditorFormState = {
      ...promptToEditorState(null),
      ...(initial ?? {}),
    };
    const utils = renderWithProviders(
      <PromptEditorModal
        draft={draft}
        onChange={onChange}
        onClose={onClose}
        onSave={onSave}
        open
      />,
    );
    return { ...utils, onChange, onSave, onClose };
  }

  it("forwards title edits to onChange", async () => {
    const { getByPlaceholderText, onChange, user } = renderEditor();
    await user.type(getByPlaceholderText(/Prompt title|promptEditorTitlePlaceholder/i), "X");
    expect(onChange).toHaveBeenCalledWith({ title: "X" });
  });

  it("calls onSave when the Save button is clicked", async () => {
    const { getByRole, onSave, user } = renderEditor({ title: "T", content: "Body" });
    await user.click(getByRole("button", { name: /promptEditorSave|Save prompt/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe("VariableInputModal (use-prompt flow)", () => {
  const prompt: PromptRecord = {
    id: 1,
    title: "With Variables",
    content: "Hello {name}, talk about {topic}",
    category: "General",
    tags: [],
    variables: ["name", "topic"],
    isFavorite: false,
    createdAt: 0,
    lastUsed: null,
    useCount: 0,
    favoriteOrder: null,
  };

  it("renders one input per variable and forwards typed values to onChange", async () => {
    const onApply = vi.fn();
    const onChange = vi.fn();
    const onClose = vi.fn();
    const { getByPlaceholderText, user } = renderWithProviders(
      <VariableInputModal
        onApply={onApply}
        onChange={onChange}
        onClose={onClose}
        open
        prompt={prompt}
        values={{}}
      />,
    );
    // i18n in tests returns the key with parenthesized substitutions.
    const nameInput = getByPlaceholderText(/name/i);
    const topicInput = getByPlaceholderText(/topic/i);
    await user.type(nameInput, "P");
    expect(onChange).toHaveBeenCalledWith("name", "P");
    await user.type(topicInput, "X");
    expect(onChange).toHaveBeenCalledWith("topic", "X");
  });

  it("calls onApply when Apply prompt is clicked", async () => {
    const onApply = vi.fn();
    const { getByRole, user } = renderWithProviders(
      <VariableInputModal
        onApply={onApply}
        onChange={vi.fn()}
        onClose={vi.fn()}
        open
        prompt={prompt}
        values={{ name: "P", topic: "X" }}
      />,
    );
    await user.click(getByRole("button", { name: /variableApplyPrompt|Apply prompt/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe("editor helpers", () => {
  it("round-trips a record through promptToEditorState + editorStateToPromptDraft", () => {
    const state = promptToEditorState({
      id: 1,
      title: "T",
      content: "C",
      category: "Cat",
      tags: ["a", "b"],
      variables: ["x"],
      isFavorite: true,
      createdAt: 0,
      lastUsed: null,
      useCount: 0,
      favoriteOrder: null,
    });
    expect(state).toMatchObject({
      title: "T",
      content: "C",
      category: "Cat",
      tags: "a, b",
      variables: "x",
      isFavorite: true,
    });
    expect(editorStateToPromptDraft(state)).toMatchObject({
      title: "T",
      content: "C",
      category: "Cat",
      tags: ["a", "b"],
      variables: ["x"],
      isFavorite: true,
    });
  });
});
