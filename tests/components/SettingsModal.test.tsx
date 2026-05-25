import { useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { SettingsModal } from "@/multi-panel/components/SettingsModal";
import type { SettingsTab } from "@/multi-panel/types";
import { PROVIDERS } from "@/shared/lib/providers";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "@/shared/lib/settings";
import { renderWithProviders } from "../helpers/render";

type Handlers = ReturnType<typeof buildHandlers>;
type SettingsTabState = {
  initialTab?: SettingsTab;
  initialSettings?: Partial<ExtensionSettings>;
  promptCount?: number;
};

function buildHandlers() {
  return {
    onClearPromptLibrary: vi.fn(),
    onClose: vi.fn(),
    onExportPromptLibrary: vi.fn(),
    onExportSettings: vi.fn(),
    onExportWorkspaceData: vi.fn(),
    onImportDefaultPromptLibrary: vi.fn(),
    onImportPromptFile: vi.fn(),
    onImportSettingsFile: vi.fn(),
    onOpenPromptLibrary: vi.fn(),
    onReorderProvider: vi.fn(),
    onResetAllSettings: vi.fn(),
    onResetComposer: vi.fn(),
    onResetLayout: vi.fn(),
    onRunVersionCheck: vi.fn(() => Promise.resolve(undefined)),
    onSetDefaultComposerPosition: vi.fn(),
    onSetGoogleMode: vi.fn(),
    onToggleProvider: vi.fn(),
    onUpdateSetting: vi.fn(),
  };
}

function Harness({
  handlers,
  options,
}: {
  handlers: Handlers;
  options: SettingsTabState;
}) {
  const [tab, setTab] = useState<SettingsTab>(options.initialTab ?? "appearance");
  const settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    ...(options.initialSettings ?? {}),
  };
  return (
    <SettingsModal
      assetUrl={(path) => `/${path}`}
      checking={false}
      open
      promptCount={options.promptCount ?? 0}
      providers={[...PROVIDERS]}
      settings={settings}
      settingsTab={tab}
      supportedLanguages={[
        { label: "Auto", value: "auto" },
        { label: "English", value: "en" },
      ]}
      updateStatus={null}
      versionInfo={{ manifestVersion: "1.0.0", buildDate: "2025-01-01", commitHash: "abcd123" }}
      onClearPromptLibrary={handlers.onClearPromptLibrary}
      onClose={handlers.onClose}
      onExportPromptLibrary={handlers.onExportPromptLibrary}
      onExportSettings={handlers.onExportSettings}
      onExportWorkspaceData={handlers.onExportWorkspaceData}
      onImportDefaultPromptLibrary={handlers.onImportDefaultPromptLibrary}
      onImportPromptFile={handlers.onImportPromptFile}
      onImportSettingsFile={handlers.onImportSettingsFile}
      onOpenPromptLibrary={handlers.onOpenPromptLibrary}
      onReorderProvider={handlers.onReorderProvider}
      onResetAllSettings={handlers.onResetAllSettings}
      onResetComposer={handlers.onResetComposer}
      onResetLayout={handlers.onResetLayout}
      onRunVersionCheck={handlers.onRunVersionCheck}
      onSetDefaultComposerPosition={handlers.onSetDefaultComposerPosition}
      onSetGoogleMode={handlers.onSetGoogleMode}
      onSettingsTabChange={(next) => setTab(next)}
      onToggleProvider={handlers.onToggleProvider}
      onUpdateSetting={handlers.onUpdateSetting}
    />
  );
}

function renderSettingsModal(options: SettingsTabState = {}) {
  const handlers = buildHandlers();
  const utils = renderWithProviders(
    (<Harness handlers={handlers} options={options} />) as ReactElement,
  );
  return { ...utils, handlers };
}

describe("SettingsModal", () => {
  it("renders the Appearance tab content by default with theme buttons", () => {
    const { getByRole } = renderSettingsModal();
    expect(getByRole("button", { name: /themeLight|Light/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /themeDark|Dark/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /themeAuto|Auto/i })).toBeInTheDocument();
  });

  it("switches to the providers tab when the providers nav button is clicked", async () => {
    const { getByRole, user } = renderSettingsModal();
    const providersTab = getByRole("button", { name: /tabProviders|Providers/i });
    await user.click(providersTab);
    // Each provider row has a drag-to-reorder button — that's a providers-tab signal.
    expect(getByRole("button", { name: /providerAriaDragReorder.*chatgpt|Drag ChatGPT/i })).toBeInTheDocument();
  });

  it("invokes onUpdateSetting with 'theme'/'dark' when the Dark theme button is clicked", async () => {
    const { getByRole, handlers, user } = renderSettingsModal();
    await user.click(getByRole("button", { name: /themeDark|Dark/i }));
    expect(handlers.onUpdateSetting).toHaveBeenCalledWith("theme", "dark");
  });

  it("invokes onSetDefaultComposerPosition with 'middle' when the middle button is clicked", async () => {
    const { getByRole, handlers, user } = renderSettingsModal();
    await user.click(getByRole("button", { name: /composerPositionMiddle|Middle/i }));
    expect(handlers.onSetDefaultComposerPosition).toHaveBeenCalledWith("middle");
  });

  it("toggles the connector-overlay switch which calls onUpdateSetting with the flipped value", async () => {
    const { container, handlers, user } = renderSettingsModal();
    const connectorToggle = container.querySelector(
      'input[aria-label*="connectorLines" i], input[aria-label*="connector lines" i]',
    ) as HTMLInputElement | null;
    expect(connectorToggle).not.toBeNull();
    await user.click(connectorToggle!);
    expect(handlers.onUpdateSetting).toHaveBeenCalledWith(
      "connectorOverlayEnabled",
      false,
    );
  });

  it("toggles a provider on the Providers tab via the per-row Switch", async () => {
    const { container, handlers, user } = renderSettingsModal({ initialTab: "providers" });
    const chatgptToggle = container.querySelector(
      'input[aria-label*="ChatGPT" i]',
    ) as HTMLInputElement | null;
    expect(chatgptToggle).not.toBeNull();
    await user.click(chatgptToggle!);
    expect(handlers.onToggleProvider).toHaveBeenCalledWith("chatgpt");
  });

  it("opens the Library tab and fires Open library / Export JSON / Import defaults callbacks", async () => {
    const { getByRole, handlers, user } = renderSettingsModal({
      initialTab: "library",
      promptCount: 3,
    });
    await user.click(getByRole("button", { name: /libraryOpen|Open library/i }));
    expect(handlers.onOpenPromptLibrary).toHaveBeenCalledTimes(1);
    await user.click(getByRole("button", { name: /libraryImportDefaults|Import defaults/i }));
    expect(handlers.onImportDefaultPromptLibrary).toHaveBeenCalledTimes(1);
    await user.click(getByRole("button", { name: /libraryExportJson|Export JSON/i }));
    expect(handlers.onExportPromptLibrary).toHaveBeenCalledTimes(1);
  });

  it("Data tab: Export settings + Export workspace + reset-layout / reset-composer fire their handlers", async () => {
    const { getByRole, handlers, user } = renderSettingsModal({ initialTab: "data" });
    await user.click(getByRole("button", { name: /dataExportSettings|Export settings/i }));
    expect(handlers.onExportSettings).toHaveBeenCalledTimes(1);
    await user.click(getByRole("button", { name: /dataExportWorkspace|Export workspace/i }));
    expect(handlers.onExportWorkspaceData).toHaveBeenCalledTimes(1);
    await user.click(getByRole("button", { name: /dataResetLayout|Reset layout/i }));
    expect(handlers.onResetLayout).toHaveBeenCalledTimes(1);
    await user.click(getByRole("button", { name: /dataResetComposer|Reset composer position/i }));
    expect(handlers.onResetComposer).toHaveBeenCalledTimes(1);
  });

  it("Data tab: Reset settings shows a confirm dialog and onResetAllSettings fires only on confirm", async () => {
    const { getAllByRole, getByRole, handlers, user } = renderSettingsModal({
      initialTab: "data",
    });
    await user.click(getByRole("button", { name: /dataResetSettings|Reset settings/i }));
    // The button label in the confirm dialog is also called "Reset settings".
    const buttons = getAllByRole("button", {
      name: /dataResetSettingsConfirmLabel|Reset settings/i,
    });
    // pick the danger button inside the confirm dialog
    const confirmButton = buttons[buttons.length - 1]!;
    await user.click(confirmButton);
    expect(handlers.onResetAllSettings).toHaveBeenCalledTimes(1);
  });

  it("About tab: Check version button triggers onRunVersionCheck", async () => {
    const { getByRole, handlers, user } = renderSettingsModal({ initialTab: "about" });
    await user.click(getByRole("button", { name: /aboutCheckVersion|Check version/i }));
    expect(handlers.onRunVersionCheck).toHaveBeenCalledTimes(1);
  });

  it("clicking the Close modal button fires onClose", async () => {
    const { getByRole, handlers, user } = renderSettingsModal();
    await user.click(getByRole("button", { name: /close modal/i }));
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it("invokes onUpdateSetting with 'language' when a language option is chosen", async () => {
    const { getByRole, handlers, user } = renderSettingsModal();
    await user.click(getByRole("button", { name: /tabAppearance|Appearance/i }));
    await user.click(getByRole("combobox", { name: /choose language/i }));
    await user.click(getByRole("option", { name: /^English$/i }));
    expect(handlers.onUpdateSetting).toHaveBeenCalledWith("language", "en");
  });

  it("does not reset settings when the confirm dialog is cancelled", async () => {
    const { getByRole, handlers, user } = renderSettingsModal({ initialTab: "data" });
    await user.click(getByRole("button", { name: /dataResetSettings|Reset settings/i }));
    await user.click(getByRole("button", { name: /cancel/i }));
    expect(handlers.onResetAllSettings).not.toHaveBeenCalled();
  });

  it("About tab shows version info and a check-version action", async () => {
    const { getByRole, getByText, handlers, user } = renderSettingsModal({
      initialTab: "about",
    });
    expect(getByText(/1\.0\.0/)).toBeInTheDocument();
    await user.click(getByRole("button", { name: /aboutCheckVersion|Check version/i }));
    expect(handlers.onRunVersionCheck).toHaveBeenCalledTimes(1);
  });
});
