import {
  Download,
  FilePlus2,
  GripVertical,
  ListRestart,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FilePickerButton } from "@/shared/components/FilePickerButton";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import { Switch } from "@/shared/components/Switch";
import { Textarea } from "@/shared/components/Textarea";
import { useTranslation } from "@/shared/contexts/I18nContext";
import type { PromptDraft, PromptRecord } from "@/shared/lib/prompt-manager";

export type PromptListFilter = "all" | "favorites" | "recent";

export interface PromptEditorFormState {
  category: string;
  content: string;
  id: number | null;
  isFavorite: boolean;
  tags: string;
  title: string;
  variables: string;
}

interface PromptLibraryModalProps {
  categories: string[];
  currentFilter: PromptListFilter;
  onCategoryChange: (category: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onDelete: (prompt: PromptRecord) => void;
  onEdit: (prompt: PromptRecord) => void;
  onExport: () => void;
  onFilterChange: (filter: PromptListFilter) => void;
  onImportDefaults: () => void;
  onImportFile: (file: File | null) => void;
  onReorderFavorites: (sourceId: number, targetId: number) => void;
  onSearchChange: (query: string) => void;
  onToggleFavorite: (prompt: PromptRecord) => void;
  onUse: (prompt: PromptRecord) => void;
  open: boolean;
  prompts: PromptRecord[];
  searchQuery: string;
  selectedCategory: string;
  statusMessage?: string | null;
}

export function PromptLibraryModal({
  categories,
  currentFilter,
  onCategoryChange,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onExport,
  onFilterChange,
  onImportDefaults,
  onImportFile,
  onReorderFavorites,
  onSearchChange,
  onToggleFavorite,
  onUse,
  open,
  prompts,
  searchQuery,
  selectedCategory,
  statusMessage,
}: PromptLibraryModalProps) {
  const [draggedFavoriteId, setDraggedFavoriteId] = useState<number | null>(null);
  const [favoriteDropTargetId, setFavoriteDropTargetId] = useState<number | null>(null);
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<PromptRecord | null>(null);
  const { t } = useTranslation();
  const reorderEnabled =
    currentFilter === "favorites" && !searchQuery.trim() && !selectedCategory;

  function clearFavoriteDragState() {
    setDraggedFavoriteId(null);
    setFavoriteDropTargetId(null);
  }

  function getFavoriteDragSource(event: React.DragEvent<HTMLElement>) {
    if (draggedFavoriteId !== null) {
      return draggedFavoriteId;
    }
    const transferId = event.dataTransfer.getData("text/plain");
    const parsed = Number(transferId);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return prompts.find((entry) => entry.id === parsed)?.id ?? null;
  }

  function handleFavoriteDragStart(
    event: React.DragEvent<HTMLButtonElement>,
    favoriteId: number,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(favoriteId));
    setDraggedFavoriteId(favoriteId);
  }

  function handleFavoriteDragOver(
    event: React.DragEvent<HTMLDivElement>,
    targetId: number,
  ) {
    const sourceId = getFavoriteDragSource(event);
    if (sourceId === null || sourceId === targetId) {
      setFavoriteDropTargetId(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setFavoriteDropTargetId((current) => (current === targetId ? current : targetId));
  }

  function handleFavoriteDrop(
    event: React.DragEvent<HTMLDivElement>,
    targetId: number,
  ) {
    event.preventDefault();
    const sourceId = getFavoriteDragSource(event);
    clearFavoriteDragState();

    if (sourceId === null || sourceId === targetId) {
      return;
    }

    onReorderFavorites(sourceId, targetId);
  }

  return (
    <Modal
      description={t(
        "libraryModalDescription",
        "Save reusable prompts, search them quickly, and inject them back into the unified composer.",
      )}
      onClose={onClose}
      open={open}
      size="xl"
      title={t("libraryModalTitle", "Prompt Library")}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--foreground-muted))]"
              size={16}
            />
            <Input
              className="pl-10"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("librarySearchPlaceholder", "Search prompts, tags, or content")}
              value={searchQuery}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto] lg:min-w-[420px]">
            <Select
              aria-label={t("libraryFilterCategoryAria", "Filter prompts by category")}
              onValueChange={onCategoryChange}
              title={t("libraryFilterCategoryAria", "Filter prompts by category")}
              value={selectedCategory}
            >
              <option value="">{t("libraryAllCategories", "All categories")}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>

            <div className="flex flex-wrap gap-2">
              {(["all", "recent", "favorites"] as PromptListFilter[]).map((filter) => (
                <Button
                  key={filter}
                  onClick={() => onFilterChange(filter)}
                  variant={currentFilter === filter ? "primary" : "secondary"}
                >
                  {filter === "all"
                    ? t("libraryFilterAll", "All")
                    : filter === "recent"
                      ? t("libraryFilterRecent", "Recent")
                      : t("libraryFilterFavorites", "Favorites")}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreate} variant="primary">
            <FilePlus2 size={14} />
            {t("libraryNewPrompt", "New prompt")}
          </Button>
          <Button onClick={onImportDefaults} variant="secondary">
            <ListRestart size={14} />
            {t("libraryImportDefaults", "Import defaults")}
          </Button>
          <FilePickerButton
            accept="application/json"
            onPick={onImportFile}

            title={t("libraryImportPromptsJsonTitle", "Import prompts JSON")}
            variant="secondary"
          >
            <Download size={14} />
            {t("libraryImportJson", "Import JSON")}
          </FilePickerButton>
          <Button onClick={onExport} variant="secondary">
            <Upload size={14} />
            {t("libraryExportJson", "Export JSON")}
          </Button>
        </div>

        {statusMessage && statusMessage !== t("appStatusReady", "Ready.") ? (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm text-emerald-100">
            {statusMessage}
          </div>
        ) : null}

        <div className="grid max-h-[58vh] gap-3 overflow-y-auto">
          {prompts.length ? (
            prompts.map((prompt) => {
              const isDraggedFavorite = reorderEnabled && draggedFavoriteId === prompt.id;
              const isDropTarget = reorderEnabled && favoriteDropTargetId === prompt.id;
              const dragLabel = t("libraryAriaDragReorder", "Drag $1 to reorder", prompt.title);

              return (
                <div
                  key={prompt.id}
                  className={`relative rounded-[24px] border border-[hsl(var(--border-muted)/0.08)] bg-[hsl(var(--surface-panel))] px-4 py-4 transition hover:border-[hsl(var(--border-muted)/0.16)] ${isDraggedFavorite ? "opacity-45" : ""
                    } ${isDropTarget ? "bg-[hsl(var(--surface-elevated))] ring-1 ring-[hsl(var(--tint-ring)/0.14)]" : ""}`}
                  onDragOver={
                    reorderEnabled
                      ? (event) => handleFavoriteDragOver(event, prompt.id)
                      : undefined
                  }
                  onDrop={
                    reorderEnabled ? (event) => handleFavoriteDrop(event, prompt.id) : undefined
                  }
                >
                  {isDropTarget ? (
                    <>
                      <div className="pointer-events-none absolute inset-0 z-[1] rounded-[24px] bg-[hsl(var(--accent-cool)/0.12)]" />
                      <div className="pointer-events-none absolute inset-0 z-[2] rounded-[24px] bg-[linear-gradient(180deg,hsl(var(--accent-cool)/0.18),hsl(var(--accent-cool)/0.07))] shadow-[inset_0_0_0_1px_hsl(var(--accent-cool)/0.48),inset_0_0_0_2px_hsl(var(--accent-cool)/0.22),inset_0_0_34px_hsl(var(--accent-cool)/0.10)]" />
                    </>
                  ) : null}
                  <div className="relative z-[3] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {reorderEnabled ? (
                      <button
                        aria-label={dragLabel}
                        className={`inline-flex w-5 shrink-0 cursor-grab items-center justify-center self-stretch text-[hsl(var(--foreground)/0.45)] transition hover:text-[hsl(var(--foreground))] active:cursor-grabbing ${isDraggedFavorite ? "cursor-grabbing text-[hsl(var(--foreground))]" : ""
                          }`}
                        draggable
                        onDragEnd={clearFavoriteDragState}
                        onDragStart={(event) => handleFavoriteDragStart(event, prompt.id)}
                        title={dragLabel}
                        type="button"
                      >
                        <GripVertical size={17} strokeWidth={2.1} />
                      </button>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">{prompt.title}</h3>
                        {prompt.category ? (
                          <span className="rounded-full border border-[hsl(var(--tint-base)/0.10)] bg-[hsl(var(--tint-base)/0.06)] px-2.5 py-1 text-xs text-[hsl(var(--foreground-soft))]">
                            {prompt.category}
                          </span>
                        ) : null}
                        {prompt.isFavorite ? (
                          <span className="rounded-full border border-amber-300/18 bg-amber-300/12 px-2.5 py-1 text-xs text-amber-200">
                            {t("libraryBadgeFavorite", "Favorite")}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--foreground-soft))]">
                        {prompt.content}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {prompt.variables.map((variable) => (
                          <span
                            key={variable}
                            className="rounded-full border border-[hsl(var(--accent-cool)/0.18)] bg-[hsl(var(--accent-cool)/0.10)] px-2.5 py-1 text-xs text-[hsl(var(--foreground))]"
                          >
                            {`{${variable}}`}
                          </span>
                        ))}
                        {prompt.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[hsl(var(--tint-base)/0.10)] bg-[hsl(var(--tint-base)/0.06)] px-2.5 py-1 text-xs text-[hsl(var(--foreground-muted))]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button onClick={() => onUse(prompt)} variant="primary">
                        {t("libraryUse", "Use")}
                      </Button>
                      <Button
                        aria-label={
                          prompt.isFavorite
                            ? t("libraryAriaRemoveFavorite", "Remove $1 from favorites", prompt.title)
                            : t("libraryAriaAddFavorite", "Add $1 to favorites", prompt.title)
                        }
                        onClick={() => onToggleFavorite(prompt)}
                        title={
                          prompt.isFavorite
                            ? t("libraryRemoveFromFavorites", "Remove from favorites")
                            : t("libraryAddToFavorites", "Add to favorites")
                        }
                        variant="secondary"
                      >
                        <Star size={14} />
                      </Button>
                      <Button
                        aria-label={t("libraryAriaEdit", "Edit $1", prompt.title)}
                        onClick={() => onEdit(prompt)}
                        title={t("libraryEditPrompt", "Edit prompt")}
                        variant="secondary"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        aria-label={t("libraryAriaDelete", "Delete $1", prompt.title)}
                        onClick={() => setPendingDeletePrompt(prompt)}
                        title={t("libraryDeletePrompt", "Delete prompt")}
                        variant="danger"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-[hsl(var(--border-muted)/0.08)] bg-[hsl(var(--surface-panel))] p-8 text-center">
              <p className="text-base font-semibold text-[hsl(var(--foreground))]">{t("libraryEmptyTitle", "No prompts found")}</p>
              <p className="mt-2 text-sm leading-6 text-[hsl(var(--foreground-muted))]">
                {t("libraryEmptyDescription", "Try a different filter, clear the search, or import the default library to get started.")}
              </p>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        confirmLabel={t("libraryDeleteConfirmLabel", "Delete")}
        destructive
        message={
          pendingDeletePrompt
            ? t(
                "libraryDeleteConfirmMessage",
                "This permanently deletes \"$1\".\nYou can't undo this.",
                pendingDeletePrompt.title,
              )
            : ""
        }
        onClose={() => setPendingDeletePrompt(null)}
        onConfirm={() => {
          if (pendingDeletePrompt) {
            onDelete(pendingDeletePrompt);
          }
        }}
        open={pendingDeletePrompt !== null}
        title={t("libraryDeleteConfirmTitle", "Delete prompt?")}
      />
    </Modal>
  );
}

interface PromptEditorModalProps {
  draft: PromptEditorFormState;
  onChange: (updates: Partial<PromptEditorFormState>) => void;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
}

export function PromptEditorModal({
  draft,
  onChange,
  onClose,
  onSave,
  open,
}: PromptEditorModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      description={t(
        "promptEditorDescription",
        "Create reusable prompts with optional tags, categories, and variables like {topic}.",
      )}
      onClose={onClose}
      open={open}
      size="lg"
      title={draft.id ? t("promptEditorEditTitle", "Edit Prompt") : t("promptEditorNewTitle", "New Prompt")}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">{t("promptEditorTitle", "Title")}</span>
            <Input
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder={t("promptEditorTitlePlaceholder", "Prompt title")}
              value={draft.title}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">{t("promptEditorCategory", "Category")}</span>
            <Input
              onChange={(event) => onChange({ category: event.target.value })}
              placeholder={t("promptEditorCategoryPlaceholder", "General")}
              value={draft.category}
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm text-[hsl(var(--foreground-soft))]">{t("promptEditorContent", "Prompt content")}</span>
          <Textarea
            onChange={(event) => onChange({ content: event.target.value })}
            placeholder={t("promptEditorContentPlaceholder", "Write your reusable prompt here")}
            value={draft.content}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">{t("promptEditorTags", "Tags")}</span>
            <Input
              onChange={(event) => onChange({ tags: event.target.value })}
              placeholder={t("promptEditorTagsPlaceholder", "research, planning, writing")}
              value={draft.tags}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">{t("promptEditorVariables", "Variables")}</span>
            <Input
              onChange={(event) => onChange({ variables: event.target.value })}
              placeholder={t("promptEditorVariablesPlaceholder", "topic, tone, audience")}
              value={draft.variables}
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-[20px] border border-[hsl(var(--tint-base)/0.10)] bg-[hsl(var(--tint-base)/0.05)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{t("promptEditorFavoriteLabel", "Favorite")}</p>
            <p className="text-xs text-[hsl(var(--foreground-muted))]">
              {t("promptEditorFavoriteDescription", "Show this prompt in the favorites filter.")}
            </p>
          </div>
          <Switch
            aria-label={
              draft.isFavorite
                ? t("promptEditorAriaRemoveFavorite", "Remove prompt from favorites")
                : t("promptEditorAriaMarkFavorite", "Mark prompt as favorite")
            }
            checked={draft.isFavorite}
            onChange={(event) => onChange({ isFavorite: event.target.checked })}
            title={
              draft.isFavorite
                ? t("promptEditorAriaRemoveFavorite", "Remove prompt from favorites")
                : t("promptEditorAriaMarkFavorite", "Mark prompt as favorite")
            }
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            {t("commonCancel", "Cancel")}
          </Button>
          <Button onClick={onSave} variant="primary">
            {t("promptEditorSave", "Save prompt")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface VariableInputModalProps {
  onApply: () => void;
  onChange: (variable: string, value: string) => void;
  onClose: () => void;
  open: boolean;
  prompt: PromptRecord | null;
  values: Record<string, string>;
}

export function VariableInputModal({
  onApply,
  onChange,
  onClose,
  open,
  prompt,
  values,
}: VariableInputModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      description={t(
        "variableModalDescription",
        "Fill the variables before the prompt is copied into the unified composer.",
      )}
      onClose={onClose}
      open={open}
      size="md"
      title={
        prompt
          ? t("variableModalTitleUse", "Use \"$1\"", prompt.title)
          : t("variableModalTitleDefault", "Prompt Variables")
      }
    >
      <div className="space-y-4">
        {prompt?.variables.map((variable) => (
          <label key={variable} className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">{variable}</span>
            <Input
              onChange={(event) => onChange(variable, event.target.value)}
              placeholder={t("variableEnterPlaceholder", "Enter $1", variable)}
              value={values[variable] ?? ""}
            />
          </label>
        ))}

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            {t("commonCancel", "Cancel")}
          </Button>
          <Button onClick={onApply} variant="primary">
            {t("variableApplyPrompt", "Apply prompt")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function promptToEditorState(prompt?: PromptRecord | null): PromptEditorFormState {
  return {
    category: prompt?.category ?? "",
    content: prompt?.content ?? "",
    id: prompt?.id ?? null,
    isFavorite: prompt?.isFavorite ?? false,
    tags: prompt?.tags.join(", ") ?? "",
    title: prompt?.title ?? "",
    variables: prompt?.variables.join(", ") ?? "",
  };
}

export function editorStateToPromptDraft(state: PromptEditorFormState): PromptDraft {
  const splitList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    category: state.category,
    content: state.content,
    isFavorite: state.isFavorite,
    tags: splitList(state.tags),
    title: state.title,
    variables: splitList(state.variables),
  };
}
