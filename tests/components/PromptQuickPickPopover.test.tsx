import { useRef, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { PromptQuickPickPopover } from "@/multi-panel/components/PromptQuickPickPopover";
import type { PromptRecord } from "@/shared/lib/prompt-manager";
import { renderWithProviders } from "../helpers/render";

function makePrompt(overrides: Partial<PromptRecord> = {}): PromptRecord {
  return {
    id: 1,
    title: "Title",
    content: "Content",
    category: "General",
    tags: [],
    variables: [],
    isFavorite: false,
    createdAt: 0,
    lastUsed: null,
    useCount: 0,
    favoriteOrder: null,
    ...overrides,
  };
}

interface HarnessProps {
  favorites?: PromptRecord[];
  onClose?: () => void;
  onOpenLibrary?: () => void;
  onSelect?: (prompt: PromptRecord) => void;
  open?: boolean;
  recents?: PromptRecord[];
}

function Harness({
  favorites = [],
  onClose = vi.fn(),
  onOpenLibrary = vi.fn(),
  onSelect = vi.fn(),
  open = true,
  recents = [],
}: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={anchorRef} type="button">
        anchor
      </button>
      <PromptQuickPickPopover
        anchorRef={anchorRef}
        favorites={favorites}
        onClose={onClose}
        onOpenLibrary={onOpenLibrary}
        onSelect={onSelect}
        open={open}
        recents={recents}
      />
    </>
  );
}

describe("PromptQuickPickPopover", () => {
  it("renders nothing when open=false", () => {
    const { queryByRole } = renderWithProviders(
      (<Harness open={false} favorites={[makePrompt()]} />) as ReactElement,
    );
    expect(queryByRole("dialog")).toBeNull();
  });

  it("renders the favorites section when favorites are present", () => {
    const { getByRole, getByText } = renderWithProviders(
      (<Harness favorites={[makePrompt({ title: "FavOne" })]} />) as ReactElement,
    );
    expect(getByRole("dialog")).toBeInTheDocument();
    expect(getByText("Favorites")).toBeInTheDocument();
    expect(getByText("FavOne")).toBeInTheDocument();
  });

  it("renders the recents section when recents are present", () => {
    const { getByText } = renderWithProviders(
      (<Harness recents={[makePrompt({ id: 2, title: "RecentOne" })]} />) as ReactElement,
    );
    expect(getByText("Recent")).toBeInTheDocument();
    expect(getByText("RecentOne")).toBeInTheDocument();
  });

  it("fires onSelect with the prompt when a favorite item is clicked", async () => {
    const onSelect = vi.fn();
    const prompt = makePrompt({ id: 3, title: "ClickMe" });
    const { getByRole, user } = renderWithProviders(
      (<Harness favorites={[prompt]} onSelect={onSelect} />) as ReactElement,
    );
    await user.click(getByRole("button", { name: /ClickMe/i }));
    expect(onSelect).toHaveBeenCalledWith(prompt);
  });

  it("fires onOpenLibrary when 'Manage prompt library' is clicked", async () => {
    const onOpenLibrary = vi.fn();
    const { getByRole, user } = renderWithProviders(
      (<Harness onOpenLibrary={onOpenLibrary} />) as ReactElement,
    );
    await user.click(getByRole("button", { name: /Manage prompt library/i }));
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
  });

  it("shows the 'no matching prompts' message when search has no results", async () => {
    const { getByPlaceholderText, getByText, user } = renderWithProviders(
      (<Harness favorites={[makePrompt({ title: "FavOne" })]} />) as ReactElement,
    );
    const search = getByPlaceholderText("Search favorites and recent prompts");
    await user.click(search);
    await user.type(search, "zzz");
    expect(getByText("No matching prompts.")).toBeInTheDocument();
  });

  it("filters items via the search input", async () => {
    const { getByPlaceholderText, getByText, queryByText, user } = renderWithProviders(
      (
        <Harness
          favorites={[
            makePrompt({ id: 1, title: "Brainstorm" }),
            makePrompt({ id: 2, title: "Summarize" }),
          ]}
        />
      ) as ReactElement,
    );
    const search = getByPlaceholderText("Search favorites and recent prompts");
    await user.click(search);
    await user.type(search, "summa");
    expect(getByText("Summarize")).toBeInTheDocument();
    expect(queryByText("Brainstorm")).toBeNull();
  });

  it("renders a 'blank' badge for prompts that have variables", () => {
    const { getByText } = renderWithProviders(
      (
        <Harness
          favorites={[makePrompt({ title: "WithVars", variables: ["a", "b"] })]}
        />
      ) as ReactElement,
    );
    expect(getByText(/2 blanks/i)).toBeInTheDocument();
  });

  it("renders the empty-state hint when no prompts and no search", () => {
    const { getByText } = renderWithProviders(
      (<Harness />) as ReactElement,
    );
    expect(
      getByText(/Mark prompts as favorites to pin them here/i),
    ).toBeInTheDocument();
  });

  it("invokes onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    renderWithProviders((<Harness onClose={onClose} />) as ReactElement);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
