import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useWorkspaceDataController } from "@/multi-panel/hooks/useWorkspaceDataController";

vi.mock("@/multi-panel/lib/json-files", () => ({
  triggerJsonDownload: vi.fn(),
  parseJsonFile: vi.fn(),
}));

vi.mock("@/shared/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/settings")>(
    "@/shared/lib/settings",
  );
  return {
    ...actual,
    exportSettings: vi.fn(async () => ({ theme: "dark" })),
    importSettings: vi.fn(async () => ({ imported: ["theme"], skipped: [] })),
  };
});

vi.mock("@/shared/lib/prompt-manager", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/prompt-manager")>(
    "@/shared/lib/prompt-manager",
  );
  return {
    ...actual,
    exportPrompts: vi.fn(async () => ({ prompts: [], version: "1.0" })),
    importPrompts: vi.fn(async () => undefined),
  };
});

import { parseJsonFile, triggerJsonDownload } from "@/multi-panel/lib/json-files";
import { exportPrompts, importPrompts } from "@/shared/lib/prompt-manager";
import { exportSettings, importSettings } from "@/shared/lib/settings";

describe("useWorkspaceDataController", () => {
  let showStatus: ReturnType<typeof vi.fn>;
  let refreshPromptLibrary: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showStatus = vi.fn();
    refreshPromptLibrary = vi.fn(async () => undefined);
    vi.clearAllMocks();
  });

  it("handleExportSettings downloads + reports success", async () => {
    const { result } = renderHookWithProviders(() =>
      useWorkspaceDataController({ showStatus, refreshPromptLibrary }),
    );
    await act(async () => {
      await result.current.handleExportSettings();
    });
    expect(exportSettings).toHaveBeenCalled();
    expect(triggerJsonDownload).toHaveBeenCalledWith(
      "parallel-ai-settings.json",
      expect.objectContaining({ theme: "dark" }),
    );
    expect(showStatus).toHaveBeenCalledWith(expect.stringMatching(/exported/i));
  });

  it("handleExportSettings reports error message when export throws", async () => {
    (exportSettings as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("disk full"));
    const { result } = renderHookWithProviders(() =>
      useWorkspaceDataController({ showStatus, refreshPromptLibrary }),
    );
    await act(async () => {
      await result.current.handleExportSettings();
    });
    expect(showStatus).toHaveBeenCalledWith("disk full");
  });

  it("handleExportWorkspaceData bundles settings + prompts + version", async () => {
    const { result } = renderHookWithProviders(() =>
      useWorkspaceDataController({ showStatus, refreshPromptLibrary }),
    );
    await act(async () => {
      await result.current.handleExportWorkspaceData();
    });
    expect(exportPrompts).toHaveBeenCalled();
    expect(exportSettings).toHaveBeenCalled();
    const [, payload] = (triggerJsonDownload as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(payload).toMatchObject({
      settings: { theme: "dark" },
      prompts: { version: "1.0" },
      version: expect.any(String),
      exportedAt: expect.any(String),
    });
  });

  it("handleImportSettingsFile imports settings only when payload has no prompts", async () => {
    (parseJsonFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ theme: "dark" });
    const file = new File(["{}"], "settings.json", { type: "application/json" });
    const { result } = renderHookWithProviders(() =>
      useWorkspaceDataController({ showStatus, refreshPromptLibrary }),
    );
    await act(async () => {
      await result.current.handleImportSettingsFile(file);
    });
    expect(importSettings).toHaveBeenCalledWith({ theme: "dark" });
    expect(importPrompts).not.toHaveBeenCalled();
    expect(refreshPromptLibrary).not.toHaveBeenCalled();
  });

  it("handleImportSettingsFile imports both settings and prompts when present", async () => {
    (parseJsonFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      settings: { theme: "light" },
      prompts: { prompts: [], version: "1.0" },
    });
    const file = new File(["{}"], "workspace.json", { type: "application/json" });
    const { result } = renderHookWithProviders(() =>
      useWorkspaceDataController({ showStatus, refreshPromptLibrary }),
    );
    await act(async () => {
      await result.current.handleImportSettingsFile(file);
    });
    expect(importSettings).toHaveBeenCalledWith({ theme: "light" });
    expect(importPrompts).toHaveBeenCalled();
    expect(refreshPromptLibrary).toHaveBeenCalled();
  });

  it("handleImportSettingsFile no-ops on null", async () => {
    const { result } = renderHookWithProviders(() =>
      useWorkspaceDataController({ showStatus, refreshPromptLibrary }),
    );
    await act(async () => {
      await result.current.handleImportSettingsFile(null);
    });
    expect(importSettings).not.toHaveBeenCalled();
  });

  it("handleImportSettingsFile surfaces parse errors via showStatus", async () => {
    (parseJsonFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("bad json"));
    const file = new File(["x"], "x.json", { type: "application/json" });
    const { result } = renderHookWithProviders(() =>
      useWorkspaceDataController({ showStatus, refreshPromptLibrary }),
    );
    await act(async () => {
      await result.current.handleImportSettingsFile(file);
    });
    expect(showStatus).toHaveBeenCalledWith("bad json");
  });
});
