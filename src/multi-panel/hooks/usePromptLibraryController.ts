import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import {
  editorStateToPromptDraft,
  promptToEditorState,
  type PromptListFilter,
} from "@/multi-panel/components/PromptLibraryModal";
import { parseJsonFile, triggerJsonDownload } from "@/multi-panel/lib/json-files";
import {
  clearAllPrompts,
  deletePrompt,
  exportPrompts,
  getAllPrompts,
  importDefaultLibrary,
  importPrompts,
  recordPromptUsage,
  savePrompt,
  toggleFavorite,
  updatePrompt,
  type PromptRecord,
} from "@/shared/lib/prompt-manager";

interface UsePromptLibraryControllerOptions {
  assetUrl: (path: string) => string;
  loaded: boolean;
  onPromptInserted?: () => void;
  setPrompt: Dispatch<SetStateAction<string>>;
  showStatus: (message: string) => void;
}

export function usePromptLibraryController({
  assetUrl,
  loaded,
  onPromptInserted,
  setPrompt,
  showStatus,
}: UsePromptLibraryControllerOptions) {
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const [promptQuickPickOpen, setPromptQuickPickOpen] = useState(false);
  const [promptLibraryFilter, setPromptLibraryFilter] = useState<PromptListFilter>("recent");
  const [promptLibrarySearch, setPromptLibrarySearch] = useState("");
  const [promptLibraryCategory, setPromptLibraryCategory] = useState("");
  const [promptLibraryItems, setPromptLibraryItems] = useState<PromptRecord[]>([]);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptEditorState, setPromptEditorState] = useState(promptToEditorState());
  const [variablePrompt, setVariablePrompt] = useState<PromptRecord | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  async function loadPromptLibrary() {
    try {
      setPromptLibraryItems(await getAllPrompts());
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Failed to load prompt library.",
      );
    }
  }

  useEffect(() => {
    if (!loaded) {
      return;
    }

    void loadPromptLibrary();
  }, [loaded]);

  function openPromptEditor(promptRecord?: PromptRecord | null) {
    setPromptEditorState(promptToEditorState(promptRecord));
    setPromptEditorOpen(true);
  }

  function closePromptEditor() {
    setPromptEditorOpen(false);
    setPromptEditorState(promptToEditorState());
  }

  async function handleSavePromptEditor() {
    try {
      const nextDraft = editorStateToPromptDraft(promptEditorState);
      if (promptEditorState.id) {
        await updatePrompt(promptEditorState.id, nextDraft);
        showStatus("Prompt updated.");
      } else {
        await savePrompt(nextDraft);
        showStatus("Prompt saved.");
      }

      setPromptEditorOpen(false);
      setPromptEditorState(promptToEditorState());
      await loadPromptLibrary();
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to save prompt.");
    }
  }

  async function handleDeletePrompt(promptRecord: PromptRecord) {
    if (!window.confirm(`Delete "${promptRecord.title}" from your prompt library?`)) {
      return;
    }

    try {
      await deletePrompt(promptRecord.id);
      await loadPromptLibrary();
      showStatus("Prompt deleted.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to delete prompt.");
    }
  }

  async function handleToggleFavorite(promptRecord: PromptRecord) {
    try {
      await toggleFavorite(promptRecord.id);
      await loadPromptLibrary();
      showStatus(
        promptRecord.isFavorite ? "Removed from favorites." : "Added to favorites.",
      );
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to update favorite.");
    }
  }

  async function applyPromptToComposer(promptRecord: PromptRecord, content: string) {
    setPrompt(content);
    await recordPromptUsage(promptRecord.id);
    await loadPromptLibrary();
    setPromptLibraryOpen(false);
    setPromptQuickPickOpen(false);
    showStatus("Prompt inserted into the unified composer.");
    onPromptInserted?.();
  }

  async function handleUsePrompt(promptRecord: PromptRecord) {
    if (promptRecord.variables.length) {
      setVariablePrompt(promptRecord);
      setVariableValues(
        Object.fromEntries(promptRecord.variables.map((variable) => [variable, ""])),
      );
      return;
    }

    await applyPromptToComposer(promptRecord, promptRecord.content);
  }

  async function handleQuickInsertPrompt(promptRecord: PromptRecord) {
    await applyPromptToComposer(promptRecord, promptRecord.content);
  }

  async function handleApplyPromptVariables() {
    if (!variablePrompt) {
      return;
    }

    let content = variablePrompt.content;
    for (const variable of variablePrompt.variables) {
      const value = variableValues[variable] || `{${variable}}`;
      const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      content = content.replace(new RegExp(`\\{${escapedVariable}\\}`, "g"), value);
    }

    setVariablePrompt(null);
    setVariableValues({});
    await applyPromptToComposer(variablePrompt, content);
  }

  async function handleImportDefaultPromptLibrary() {
    try {
      const response = await fetch(assetUrl("data/prompt-libraries/default-prompts.json"));
      if (!response.ok) {
        throw new Error("Default prompt library is unavailable.");
      }

      const payload = (await response.json()) as Array<{
        category?: string;
        content: string;
        isFavorite?: boolean;
        tags?: string[];
        title?: string;
        useCount?: number;
        variables?: string[];
      }>;
      const result = await importDefaultLibrary(payload);
      await loadPromptLibrary();
      showStatus(
        `Imported ${result.imported} default prompt${result.imported === 1 ? "" : "s"}${
          result.skipped ? `, skipped ${result.skipped}` : ""
        }.`,
      );
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Failed to import default prompts.",
      );
    }
  }

  async function handleImportPromptFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const payload = await parseJsonFile<unknown>(file);
      const result = await importPrompts(payload as never);
      await loadPromptLibrary();
      showStatus(
        `Imported ${result.imported} prompt${result.imported === 1 ? "" : "s"}${
          result.skipped ? `, skipped ${result.skipped}` : ""
        }.`,
      );
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to import prompts.");
    }
  }

  async function handleExportPromptLibrary() {
    try {
      triggerJsonDownload("parallel-ai-prompts.json", await exportPrompts());
      showStatus("Prompt library exported.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to export prompts.");
    }
  }

  async function handleClearPromptLibrary() {
    if (!window.confirm("Delete every saved prompt in the library?")) {
      return;
    }

    try {
      await clearAllPrompts();
      await loadPromptLibrary();
      showStatus("Prompt library cleared.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to clear prompt library.");
    }
  }

  const promptCategories = [
    ...new Set(promptLibraryItems.map((item) => item.category).filter(Boolean)),
  ].sort();
  const filteredPromptLibraryItems = (() => {
    let nextItems = [...promptLibraryItems];

    if (promptLibrarySearch.trim()) {
      const search = promptLibrarySearch.trim().toLowerCase();
      nextItems = nextItems.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.content.toLowerCase().includes(search) ||
          item.tags.some((tag) => tag.toLowerCase().includes(search)),
      );
    } else if (promptLibraryFilter === "favorites") {
      nextItems = nextItems
        .filter((item) => item.isFavorite)
        .sort((left, right) => {
          const leftOrder = left.favoriteOrder;
          const rightOrder = right.favoriteOrder;
          if (typeof leftOrder === "number" && typeof rightOrder === "number") {
            return leftOrder - rightOrder;
          }
          if (typeof leftOrder === "number") {
            return -1;
          }
          if (typeof rightOrder === "number") {
            return 1;
          }
          return right.useCount - left.useCount;
        });
    } else if (promptLibraryFilter === "recent") {
      nextItems = nextItems
        .filter((item) => item.lastUsed !== null)
        .sort((left, right) => (right.lastUsed ?? 0) - (left.lastUsed ?? 0));

      if (nextItems.length === 0) {
        nextItems = [...promptLibraryItems];
      }
    }

    if (promptLibraryCategory) {
      nextItems = nextItems.filter((item) => item.category === promptLibraryCategory);
    }

    return nextItems;
  })();

  const quickPickItems = (() => {
    const favorites = promptLibraryItems
      .filter((item) => item.isFavorite)
      .sort((left, right) => {
        const leftOrder = left.favoriteOrder;
        const rightOrder = right.favoriteOrder;
        if (typeof leftOrder === "number" && typeof rightOrder === "number") {
          return leftOrder - rightOrder;
        }
        if (typeof leftOrder === "number") {
          return -1;
        }
        if (typeof rightOrder === "number") {
          return 1;
        }
        return right.useCount - left.useCount;
      });
    const recents = promptLibraryItems
      .filter((item) => item.lastUsed !== null && item.lastUsed !== undefined && !item.isFavorite)
      .sort((left, right) => (right.lastUsed ?? 0) - (left.lastUsed ?? 0))
      .slice(0, 5);

    return { favorites, recents };
  })();

  async function handleReorderFavorites(sourceId: number, targetId: number) {
    if (sourceId === targetId) {
      return;
    }

    try {
      const orderedFavorites = [...promptLibraryItems]
        .filter((item) => item.isFavorite)
        .sort((left, right) => {
          const leftOrder = left.favoriteOrder;
          const rightOrder = right.favoriteOrder;
          if (typeof leftOrder === "number" && typeof rightOrder === "number") {
            return leftOrder - rightOrder;
          }
          if (typeof leftOrder === "number") {
            return -1;
          }
          if (typeof rightOrder === "number") {
            return 1;
          }
          return right.useCount - left.useCount;
        });
      const orderedIds = orderedFavorites.map((favorite) => favorite.id);
      const sourceIndex = orderedIds.indexOf(sourceId);
      const targetIndex = orderedIds.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) {
        return;
      }

      [orderedIds[sourceIndex], orderedIds[targetIndex]] = [
        orderedIds[targetIndex],
        orderedIds[sourceIndex],
      ];

      await Promise.all(
        orderedIds.map((id, index) => updatePrompt(id, { favoriteOrder: index })),
      );
      await loadPromptLibrary();
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to reorder favorites.");
    }
  }

  return {
    filteredPromptLibraryItems,
    handleApplyPromptVariables,
    handleClearPromptLibrary,
    handleDeletePrompt,
    handleExportPromptLibrary,
    handleImportDefaultPromptLibrary,
    handleImportPromptFile,
    handleQuickInsertPrompt,
    handleReorderFavorites,
    handleSavePromptEditor,
    handleToggleFavorite,
    handleUsePrompt,
    closePromptEditor,
    openPromptEditor,
    promptCategories,
    promptEditorOpen,
    promptEditorState,
    promptQuickPickOpen,
    quickPickItems,
    refreshPromptLibrary: loadPromptLibrary,
    promptLibraryCategory,
    promptLibraryFilter,
    promptLibraryItems,
    promptLibraryOpen,
    promptLibrarySearch,
    setPromptEditorState,
    setPromptLibraryCategory,
    setPromptLibraryFilter,
    setPromptLibraryOpen,
    setPromptLibrarySearch,
    setPromptQuickPickOpen,
    setVariablePrompt,
    setVariableValues,
    variablePrompt,
    variableValues,
  };
}
