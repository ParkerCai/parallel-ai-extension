import { useState, type ClipboardEvent, type DragEvent } from "react";

import type { QueuedFile } from "@/multi-panel/types";

interface UseComposerDraftControllerOptions {
  showStatus: (message: string) => void;
}

export function useComposerDraftController({ showStatus }: UseComposerDraftControllerOptions) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<QueuedFile[]>([]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    const selectedFiles = Array.from(fileList).slice(0, 10);
    const mappedFiles = await Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<QueuedFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                name: file.name,
                size: file.size,
                type: file.type || "application/octet-stream",
                dataUrl: String(reader.result),
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    setAttachments((current) => [...current, ...mappedFiles].slice(0, 10));
    showStatus(`${mappedFiles.length} attachment${mappedFiles.length === 1 ? "" : "s"} ready.`);
  }

  function handleComposerDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handleFilesSelected(event.dataTransfer.files);
  }

  function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (event.clipboardData.files?.length) {
      void handleFilesSelected(event.clipboardData.files);
    }
  }

  return {
    attachments,
    handleComposerDrop,
    handleComposerPaste,
    handleFilesSelected,
    hasDraftContent: prompt.trim().length > 0 || attachments.length > 0,
    prompt,
    setAttachments,
    setPrompt,
  };
}
