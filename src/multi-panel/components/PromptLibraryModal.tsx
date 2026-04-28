import {
  Download,
  FilePlus2,
  Pencil,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import { Switch } from "@/shared/components/Switch";
import { Textarea } from "@/shared/components/Textarea";
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
  onSearchChange: (query: string) => void;
  onToggleFavorite: (prompt: PromptRecord) => void;
  onUse: (prompt: PromptRecord) => void;
  open: boolean;
  prompts: PromptRecord[];
  searchQuery: string;
  selectedCategory: string;
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
  onSearchChange,
  onToggleFavorite,
  onUse,
  open,
  prompts,
  searchQuery,
  selectedCategory,
}: PromptLibraryModalProps) {
  return (
    <Modal
      description="Save reusable prompts, search them quickly, and inject them back into the unified composer."
      onClose={onClose}
      open={open}
      size="xl"
      title="Prompt Library"
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
              placeholder="Search prompts, tags, or content"
              value={searchQuery}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto] lg:min-w-[420px]">
            <Select
              aria-label="Filter prompts by category"
              onChange={(event) => onCategoryChange(event.target.value)}
              title="Filter prompts by category"
              value={selectedCategory}
            >
              <option value="">All categories</option>
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
                  size="sm"
                  variant={currentFilter === filter ? "primary" : "secondary"}
                >
                  {filter === "all" ? "All" : filter === "recent" ? "Recent" : "Favorites"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreate} size="sm" variant="primary">
            <FilePlus2 size={14} />
            New prompt
          </Button>
          <Button onClick={onImportDefaults} size="sm" variant="secondary">
            <Sparkles size={14} />
            Import defaults
          </Button>
          <label className="inline-flex" data-tooltip="Import prompts JSON">
            <input
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                onImportFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
              type="file"
            />
            <span className="inline-flex h-9 items-center gap-2 rounded-2xl bg-white/8 px-3 text-sm font-medium text-[hsl(var(--foreground))] ring-1 ring-white/10 transition hover:bg-white/12">
              <Upload size={14} />
              Import JSON
            </span>
          </label>
          <Button onClick={onExport} size="sm" variant="secondary">
            <Download size={14} />
            Export JSON
          </Button>
        </div>

        <div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1">
          {prompts.length ? (
            prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="glass-panel rounded-[24px] px-4 py-4 transition hover:border-white/16"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{prompt.title}</h3>
                      {prompt.category ? (
                        <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-[hsl(var(--foreground-soft))]">
                          {prompt.category}
                        </span>
                      ) : null}
                      {prompt.isFavorite ? (
                        <span className="rounded-full border border-amber-300/18 bg-amber-300/12 px-2.5 py-1 text-xs text-amber-200">
                          Favorite
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
                          className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100"
                        >
                          {`{${variable}}`}
                        </span>
                      ))}
                      {prompt.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-[hsl(var(--foreground-muted))]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button onClick={() => onUse(prompt)} size="sm" variant="primary">
                      Use
                    </Button>
                    <Button
                      aria-label={
                        prompt.isFavorite
                          ? `Remove ${prompt.title} from favorites`
                          : `Add ${prompt.title} to favorites`
                      }
                      onClick={() => onToggleFavorite(prompt)}
                      size="sm"
                      title={
                        prompt.isFavorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      variant="secondary"
                    >
                      <Star size={14} />
                    </Button>
                    <Button
                      aria-label={`Edit ${prompt.title}`}
                      onClick={() => onEdit(prompt)}
                      size="sm"
                      title="Edit prompt"
                      variant="secondary"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      aria-label={`Delete ${prompt.title}`}
                      onClick={() => onDelete(prompt)}
                      size="sm"
                      title="Delete prompt"
                      variant="danger"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-panel rounded-[24px] p-8 text-center">
              <p className="text-base font-semibold text-white">No prompts found</p>
              <p className="mt-2 text-sm leading-6 text-[hsl(var(--foreground-muted))]">
                Try a different filter, clear the search, or import the default library to get started.
              </p>
            </div>
          )}
        </div>
      </div>
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
  return (
    <Modal
      description="Create reusable prompts with optional tags, categories, and variables like {topic}."
      onClose={onClose}
      open={open}
      size="lg"
      title={draft.id ? "Edit Prompt" : "New Prompt"}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">Title</span>
            <Input
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Prompt title"
              value={draft.title}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">Category</span>
            <Input
              onChange={(event) => onChange({ category: event.target.value })}
              placeholder="General"
              value={draft.category}
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm text-[hsl(var(--foreground-soft))]">Prompt content</span>
          <Textarea
            onChange={(event) => onChange({ content: event.target.value })}
            placeholder="Write your reusable prompt here"
            value={draft.content}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">Tags</span>
            <Input
              onChange={(event) => onChange({ tags: event.target.value })}
              placeholder="research, planning, writing"
              value={draft.tags}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">Variables</span>
            <Input
              onChange={(event) => onChange({ variables: event.target.value })}
              placeholder="topic, tone, audience"
              value={draft.variables}
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Favorite</p>
            <p className="text-xs text-[hsl(var(--foreground-muted))]">
              Show this prompt in the favorites filter.
            </p>
          </div>
          <Switch
            aria-label={draft.isFavorite ? "Remove prompt from favorites" : "Mark prompt as favorite"}
            checked={draft.isFavorite}
            onChange={(event) => onChange({ isFavorite: event.target.checked })}
            title={draft.isFavorite ? "Remove prompt from favorites" : "Mark prompt as favorite"}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onSave} variant="primary">
            Save prompt
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
  return (
    <Modal
      description="Fill the variables before the prompt is copied into the unified composer."
      onClose={onClose}
      open={open}
      size="md"
      title={prompt ? `Use "${prompt.title}"` : "Prompt Variables"}
    >
      <div className="space-y-4">
        {prompt?.variables.map((variable) => (
          <label key={variable} className="space-y-2">
            <span className="text-sm text-[hsl(var(--foreground-soft))]">{variable}</span>
            <Input
              onChange={(event) => onChange(variable, event.target.value)}
              placeholder={`Enter ${variable}`}
              value={values[variable] ?? ""}
            />
          </label>
        ))}

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onApply} variant="primary">
            Apply prompt
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
