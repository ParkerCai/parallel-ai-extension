import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useComposerDraftController } from "@/multi-panel/hooks/useComposerDraftController";

function makeFile(name: string, content = "data", lastModified = 0) {
  return new File([content], name, { type: "text/plain", lastModified });
}

function fakeFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    *[Symbol.iterator]() {
      yield* files;
    },
  } as unknown as FileList;
  files.forEach((file, index) => {
    (list as unknown as Record<number, File>)[index] = file;
  });
  return list;
}

describe("useComposerDraftController", () => {
  let showStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showStatus = vi.fn();
  });

  it("starts with empty prompt + attachments + no draft content", () => {
    const { result } = renderHookWithProviders(() =>
      useComposerDraftController({ showStatus }),
    );
    expect(result.current.prompt).toBe("");
    expect(result.current.attachments).toEqual([]);
    expect(result.current.hasDraftContent).toBe(false);
  });

  it("hasDraftContent flips true on non-empty prompt", () => {
    const { result } = renderHookWithProviders(() =>
      useComposerDraftController({ showStatus }),
    );
    act(() => result.current.setPrompt("hello"));
    expect(result.current.hasDraftContent).toBe(true);
  });

  it("hasDraftContent ignores prompts that are pure whitespace", () => {
    const { result } = renderHookWithProviders(() =>
      useComposerDraftController({ showStatus }),
    );
    act(() => result.current.setPrompt("   \n  "));
    expect(result.current.hasDraftContent).toBe(false);
  });

  it("ingests files and emits singular status for one file", async () => {
    const { result } = renderHookWithProviders(() =>
      useComposerDraftController({ showStatus }),
    );
    await act(async () => {
      await result.current.handleFilesSelected(fakeFileList([makeFile("a.txt")]));
    });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0]!.name).toBe("a.txt");
    expect(result.current.hasDraftContent).toBe(true);
    expect(showStatus).toHaveBeenCalledWith(expect.stringContaining("1"));
  });

  it("ingests multiple files and emits plural status", async () => {
    const { result } = renderHookWithProviders(() =>
      useComposerDraftController({ showStatus }),
    );
    await act(async () => {
      await result.current.handleFilesSelected(
        fakeFileList([makeFile("a.txt"), makeFile("b.txt")]),
      );
    });
    expect(result.current.attachments).toHaveLength(2);
    expect(showStatus).toHaveBeenCalledWith(expect.stringContaining("2"));
  });

  it("caps attachments at 10", async () => {
    const { result } = renderHookWithProviders(() =>
      useComposerDraftController({ showStatus }),
    );
    const files = Array.from({ length: 15 }, (_, i) => makeFile(`f${i}.txt`, "x", i));
    await act(async () => {
      await result.current.handleFilesSelected(fakeFileList(files));
    });
    expect(result.current.attachments).toHaveLength(10);
  });

  it("ignores null / empty file lists", async () => {
    const { result } = renderHookWithProviders(() =>
      useComposerDraftController({ showStatus }),
    );
    await act(async () => {
      await result.current.handleFilesSelected(null);
    });
    expect(result.current.attachments).toEqual([]);
    expect(showStatus).not.toHaveBeenCalled();
  });
});
