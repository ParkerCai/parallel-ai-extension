import { Library, Notebook, Search, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PromptRecord } from "@/shared/lib/prompt-manager";

interface PromptQuickPickPopoverProps {
  anchorRef: React.RefObject<HTMLElement>;
  favorites: PromptRecord[];
  onClose: () => void;
  onOpenLibrary: () => void;
  onSelect: (prompt: PromptRecord) => void;
  open: boolean;
  recents: PromptRecord[];
}

export function PromptQuickPickPopover({
  anchorRef,
  favorites,
  onClose,
  onOpenLibrary,
  onSelect,
  open,
  recents,
}: PromptQuickPickPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusTimeout = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(focusTimeout);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (popoverRef.current?.contains(target)) {
        return;
      }

      if (anchorRef.current?.contains(target)) {
        return;
      }

      onClose();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorRef, onClose, open]);

  const sections = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) {
      return [
        { items: favorites, key: "favorites", title: "Favorites" },
        { items: recents, key: "recents", title: "Recent" },
      ].filter((section) => section.items.length);
    }

    const pool = [...favorites, ...recents];
    const seen = new Set<number>();
    const matches = pool.filter((prompt) => {
      if (seen.has(prompt.id)) {
        return false;
      }

      seen.add(prompt.id);
      return (
        prompt.title.toLowerCase().includes(trimmed) ||
        prompt.content.toLowerCase().includes(trimmed) ||
        prompt.tags.some((tag) => tag.toLowerCase().includes(trimmed))
      );
    });

    return matches.length ? [{ items: matches, key: "results", title: "Matches" }] : [];
  }, [favorites, recents, search]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="glass-panel pointer-events-auto absolute bottom-full left-1/2 z-30 mb-3 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-[20px] p-3 text-sm text-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
      onPointerDown={(event) => event.stopPropagation()}
      ref={popoverRef}
      role="dialog"
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--foreground-muted))]"
          size={14}
        />
        <input
          className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[hsl(var(--foreground-muted))] focus:border-white/20 focus:bg-white/8"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search favorites and recent prompts"
          ref={searchRef}
          type="text"
          value={search}
        />
      </div>

      <div className="mt-3 max-h-80 overflow-y-auto pr-1 minimal-scrollbar">
        {sections.length ? (
          sections.map((section) => (
            <div className="mb-2 last:mb-0" key={section.key}>
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--foreground-muted))]">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((prompt) => (
                  <li key={prompt.id}>
                    <button
                      className="group flex w-full items-start gap-2 rounded-2xl border border-transparent bg-white/4 px-3 py-2 text-left transition hover:border-white/10 hover:bg-white/8 focus-visible:border-white/20 focus-visible:outline-none"
                      onClick={() => onSelect(prompt)}
                      type="button"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-amber-200">
                        {prompt.isFavorite ? <Star fill="currentColor" size={12} /> : <Library size={12} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-white">{prompt.title}</span>
                          {prompt.variables.length ? (
                            <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-px text-[10px] uppercase tracking-wide text-cyan-100">
                              {prompt.variables.length} blank{prompt.variables.length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[hsl(var(--foreground-soft))]">
                          {prompt.content}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="px-2 py-6 text-center text-xs text-[hsl(var(--foreground-muted))]">
            {search.trim() ? "No matching prompts." : "Mark prompts as favorites to pin them here."}
          </div>
        )}
      </div>

      <div className="mt-2 border-t border-white/8 pt-2">
        <button
          className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs text-[hsl(var(--foreground-soft))] transition hover:bg-white/6 hover:text-white"
          onClick={onOpenLibrary}
          type="button"
        >
          <span className="inline-flex items-center gap-2">
            <Notebook size={13} />
            Manage prompt library…
          </span>
          <span className="text-[hsl(var(--foreground-muted))]">Tab to fill blanks</span>
        </button>
      </div>
    </div>
  );
}
