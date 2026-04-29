import { exportPrompts, importPrompts } from "@/shared/lib/prompt-manager";
import { exportSettings, importSettings } from "@/shared/lib/settings";
import { parseJsonFile, triggerJsonDownload } from "@/multi-panel/lib/json-files";

interface WorkspaceExportPayload {
  exportedAt: string;
  prompts: Awaited<ReturnType<typeof exportPrompts>>;
  settings: Awaited<ReturnType<typeof exportSettings>>;
  version: string;
}

interface UseWorkspaceDataControllerOptions {
  refreshPromptLibrary: () => Promise<void>;
  showStatus: (message: string) => void;
}

export function useWorkspaceDataController({
  refreshPromptLibrary,
  showStatus,
}: UseWorkspaceDataControllerOptions) {
  async function handleExportSettings() {
    try {
      triggerJsonDownload("parallel-ai-settings.json", await exportSettings());
      showStatus("Settings exported.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to export settings.");
    }
  }

  async function handleExportWorkspaceData() {
    try {
      const manifestVersion = chrome.runtime?.getManifest?.().version ?? "0.1.0";
      const payload: WorkspaceExportPayload = {
        exportedAt: new Date().toISOString(),
        prompts: await exportPrompts(),
        settings: await exportSettings(),
        version: manifestVersion,
      };

      triggerJsonDownload("parallel-ai-workspace.json", payload);
      showStatus("Workspace data exported.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to export workspace data.");
    }
  }

  async function handleImportSettingsFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const payload = await parseJsonFile<Record<string, unknown>>(file);
      const settingsPayload =
        typeof payload.settings === "object" && payload.settings !== null
          ? (payload.settings as Record<string, unknown>)
          : payload;
      const result = await importSettings(settingsPayload);

      if ("prompts" in payload) {
        await importPrompts(payload.prompts as never, "skip");
        await refreshPromptLibrary();
      }

      showStatus(
        `Imported ${result.imported.length} setting${result.imported.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to import settings.");
    }
  }

  return {
    handleExportSettings,
    handleExportWorkspaceData,
    handleImportSettingsFile,
  };
}
