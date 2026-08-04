import { createRef, useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { FloatingComposer } from "@/multi-panel/components/FloatingComposer";
import type { QueuedFile } from "@/multi-panel/types";
import { renderWithProviders } from "../helpers/render";

interface ComposerOverrides {
  attachments?: QueuedFile[];
  hasDraftContent?: boolean;
  initialPrompt?: string;
  scrollSyncEnabled?: boolean;
  stopGenerationActive?: boolean;
  temporaryChatEnabled?: boolean;
}

function Harness(props: {
  handlers: Record<string, ReturnType<typeof vi.fn>>;
  overrides: ComposerOverrides;
}) {
  const { handlers, overrides } = props;
  const [prompt, setPrompt] = useState(overrides.initialPrompt ?? "");
  const composerInputRef = createRef<HTMLTextAreaElement>();
  const composerRef = createRef<HTMLDivElement>();
  const composerShellRef = createRef<HTMLDivElement>();
  const onPromptChange = (value: string) => {
    handlers.onPromptChange(value);
    setPrompt(value);
  };
  return (
    <FloatingComposer
      attachments={overrides.attachments ?? []}
      composerDragging={false}
      composerHeight="120px"
      composerInputRef={composerInputRef}
      composerOffset={{ x: 0, y: 0 }}
      composerRef={composerRef}
      composerShellRef={composerShellRef}
      composerStatus={null}
      composerWidth="640px"
      hasDraftContent={overrides.hasDraftContent ?? Boolean(prompt.trim())}
      prompt={prompt}
      promptLibraryOpen={false}
      promptQuickPickFavorites={[]}
      promptQuickPickOpen={false}
      promptQuickPickRecents={[]}
      scrollSyncEnabled={overrides.scrollSyncEnabled ?? false}
      stopGenerationActive={overrides.stopGenerationActive ?? false}
      temporaryChatEnabled={overrides.temporaryChatEnabled ?? false}
      tokenMeterOpen={false}
      onAddPanel={handlers.onAddPanel}
      onBeginComposerDragFromHeader={handlers.onBeginComposerDragFromHeader}
      onBeginComposerResize={handlers.onBeginComposerResize}
      onClearPanels={handlers.onClearPanels}
      onClosePromptQuickPick={handlers.onClosePromptQuickPick}
      onDispatchPrompt={handlers.onDispatchPrompt}
      onDrop={handlers.onDrop}
      onFilesSelected={handlers.onFilesSelected}
      onKeyDown={handlers.onKeyDown}
      onOpenLayoutModal={handlers.onOpenLayoutModal}
      onOpenNewChats={handlers.onOpenNewChats}
      onOpenPromptLibrary={handlers.onOpenPromptLibrary}
      onOpenPromptQuickPick={handlers.onOpenPromptQuickPick}
      onOpenSettings={handlers.onOpenSettings}
      onPaste={handlers.onPaste}
      onPromptChange={onPromptChange}
      onQuickInsertPrompt={handlers.onQuickInsertPrompt}
      onRemoveAttachment={handlers.onRemoveAttachment}
      onResetComposerHeight={handlers.onResetComposerHeight}
      onResetComposerPosition={handlers.onResetComposerPosition}
      onResetComposerWidth={handlers.onResetComposerWidth}
      onStopGeneration={handlers.onStopGeneration}
      onToggleScrollSync={handlers.onToggleScrollSync}
      onToggleTemporaryChat={handlers.onToggleTemporaryChat}
      onToggleTokenMeter={handlers.onToggleTokenMeter}
    />
  );
}

function buildHandlers() {
  return {
    onAddPanel: vi.fn(),
    onBeginComposerDragFromHeader: vi.fn(),
    onBeginComposerResize: vi.fn(),
    onClearPanels: vi.fn(),
    onClosePromptQuickPick: vi.fn(),
    onDispatchPrompt: vi.fn(),
    onDrop: vi.fn(),
    onFilesSelected: vi.fn(),
    onKeyDown: vi.fn(),
    onOpenLayoutModal: vi.fn(),
    onOpenNewChats: vi.fn(),
    onOpenPromptLibrary: vi.fn(),
    onOpenPromptQuickPick: vi.fn(),
    onOpenSettings: vi.fn(),
    onPaste: vi.fn(),
    onPromptChange: vi.fn(),
    onQuickInsertPrompt: vi.fn(),
    onRemoveAttachment: vi.fn(),
    onResetComposerHeight: vi.fn(),
    onResetComposerPosition: vi.fn(),
    onResetComposerWidth: vi.fn(),
    onStopGeneration: vi.fn(),
    onToggleScrollSync: vi.fn(),
    onToggleTemporaryChat: vi.fn(),
    onToggleTokenMeter: vi.fn(),
  };
}

function renderComposer(overrides: ComposerOverrides = {}): ReturnType<
  typeof renderWithProviders
> & { handlers: ReturnType<typeof buildHandlers> } {
  const handlers = buildHandlers();
  const utils = renderWithProviders(
    (<Harness handlers={handlers} overrides={overrides} />) as ReactElement,
  );
  return { ...utils, handlers };
}

describe("FloatingComposer", () => {
  it("renders a textarea for the prompt", () => {
    const { container } = renderComposer();
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
  });

  it("forwards typed input to onPromptChange and updates the textarea value", async () => {
    const { container, handlers, user } = renderComposer();
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await user.click(textarea);
    await user.type(textarea, "hi");
    expect(handlers.onPromptChange).toHaveBeenCalled();
    expect(textarea.value).toBe("hi");
  });

  it("forwards keydown events to onKeyDown so the parent's Enter handling runs", async () => {
    const { container, handlers, user } = renderComposer({ initialPrompt: "hi" });
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await user.click(textarea);
    await user.keyboard("{Enter}");
    expect(handlers.onKeyDown).toHaveBeenCalled();
    const event = handlers.onKeyDown.mock.calls[0]![0] as KeyboardEvent;
    expect(event.key).toBe("Enter");
  });

  it("renders an attachment chip for each queued file with a remove button", async () => {
    const attachments: QueuedFile[] = [
      { id: "a1", name: "notes.txt", size: 12, type: "text/plain", dataUrl: "data:," },
      { id: "a2", name: "image.png", size: 12, type: "image/png", dataUrl: "data:image/png;base64,xx" },
    ];
    const { getByRole, handlers, user } = renderComposer({ attachments });
    await user.click(getByRole("button", { name: /remove\(notes\.txt\)|Remove notes\.txt/i }));
    expect(handlers.onRemoveAttachment).toHaveBeenCalledWith("a1");
  });

  it("fires onDispatchPrompt with autoSubmit=true when the send button is clicked", async () => {
    const { getByRole, handlers, user } = renderComposer({ initialPrompt: "hello" });
    const sendButton = getByRole("button", { name: /send all|composerAriaSendAll/i });
    await user.click(sendButton);
    expect(handlers.onDispatchPrompt).toHaveBeenCalledWith(undefined, true);
  });

  it("fires onDispatchPrompt with autoSubmit=false when the fill button is clicked", async () => {
    const { getByRole, handlers, user } = renderComposer({ initialPrompt: "hello" });
    const fillButton = getByRole("button", { name: /fill all|composerAriaFillAll/i });
    await user.click(fillButton);
    expect(handlers.onDispatchPrompt).toHaveBeenCalledWith(undefined, false);
  });

  it("invokes onStopGeneration when stopGenerationActive=true and the send slot is clicked", async () => {
    const { getByRole, handlers, user } = renderComposer({
      initialPrompt: "x",
      stopGenerationActive: true,
    });
    await user.click(getByRole("button", { name: /stop all|composerAriaStopAll/i }));
    expect(handlers.onStopGeneration).toHaveBeenCalledTimes(1);
    expect(handlers.onDispatchPrompt).not.toHaveBeenCalled();
  });

  it("invokes the right handlers for each composer bar control", async () => {
    const { getByRole, handlers, user } = renderComposer();
    await user.click(getByRole("button", { name: /open settings|composerAriaOpenSettings/i }));
    await user.click(getByRole("button", { name: /open layout picker|composerAriaOpenLayout/i }));
    await user.click(getByRole("button", { name: /new chats|composerAriaNewChats/i }));
    await user.click(getByRole("button", { name: /add pane|composerAriaAddPane/i }));
    await user.click(getByRole("button", { name: /enable scroll sync|composerAriaEnableScrollSync/i }));
    await user.click(
      getByRole("button", { name: /enable temporary chats|composerAriaEnableTemporaryChats/i }),
    );
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenLayoutModal).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenNewChats).toHaveBeenCalledTimes(1);
    expect(handlers.onAddPanel).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleScrollSync).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleTemporaryChat).toHaveBeenCalledTimes(1);
  });

  it("renders a clear-all button only while there is draft content", () => {
    const empty = renderComposer({ hasDraftContent: false });
    expect(
      empty.queryByRole("button", { name: /clear all|composerAriaClearAll/i }),
    ).toBeNull();
    empty.unmount();

    const withDraft = renderComposer({ initialPrompt: "drafty", hasDraftContent: true });
    expect(
      withDraft.getByRole("button", { name: /clear all|composerAriaClearAll/i }),
    ).toBeInTheDocument();
  });

  it("invokes onFilesSelected when files are picked through the hidden file input", async () => {
    const { container, handlers } = renderComposer();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    const file = new File(["abc"], "doc.txt", { type: "text/plain" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    Object.defineProperty(fileInput, "files", { value: dataTransfer.files });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handlers.onFilesSelected).toHaveBeenCalled();
    const fileList = handlers.onFilesSelected.mock.calls[0]![0] as FileList;
    expect(fileList[0]?.name).toBe("doc.txt");
  });
});
