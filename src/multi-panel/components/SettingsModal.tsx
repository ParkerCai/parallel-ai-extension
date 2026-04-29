import {
  ArrowDown,
  ArrowUp,
  Download,
  LoaderCircle,
  MoonStar,
  Notebook,
  RotateCcw,
  Sparkles,
  SunMedium,
  Upload,
} from "lucide-react";

import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import { SettingItem } from "@/shared/components/SettingItem";
import { Switch } from "@/shared/components/Switch";
import type { SettingsTab } from "@/multi-panel/types";
import type { Provider, ProviderId } from "@/shared/lib/providers";
import type {
  ExtensionSettings,
  GoogleProviderMode,
  SourceUrlPlacement,
} from "@/shared/lib/settings";
import type { UpdateStatus, VersionInfo } from "@/shared/lib/version-checker";

const SETTINGS_TABS: Array<{ label: string; value: SettingsTab }> = [
  { label: "Appearance", value: "appearance" },
  { label: "Providers", value: "providers" },
  { label: "Keyboard", value: "keyboard" },
  { label: "Prompt Library", value: "library" },
  { label: "Data", value: "data" },
  { label: "About", value: "about" },
];

interface SettingsModalProps {
  assetUrl: (path: string) => string;
  checking: boolean;
  open: boolean;
  promptCount: number;
  providers: Provider[];
  settings: ExtensionSettings;
  settingsTab: SettingsTab;
  supportedLanguages: Array<{ label: string; value: string }>;
  updateStatus: UpdateStatus | null;
  versionInfo: VersionInfo | null;
  onClearDraft: () => void;
  onClearPromptLibrary: () => void | Promise<void>;
  onClose: () => void;
  onExportPromptLibrary: () => void | Promise<void>;
  onExportSettings: () => void | Promise<void>;
  onExportWorkspaceData: () => void | Promise<void>;
  onImportDefaultPromptLibrary: () => void | Promise<void>;
  onImportPromptFile: (file: File | null) => void | Promise<void>;
  onImportSettingsFile: (file: File | null) => void | Promise<void>;
  onMoveProvider: (providerId: ProviderId, direction: "up" | "down") => void | Promise<void>;
  onOpenPromptLibrary: () => void;
  onResetAllSettings: () => void | Promise<void>;
  onRunVersionCheck: () => void | Promise<unknown>;
  onSetGoogleMode: (mode: GoogleProviderMode) => void | Promise<void>;
  onSettingsTabChange: (tab: SettingsTab) => void;
  onToggleProvider: (providerId: ProviderId) => void | Promise<void>;
  onUpdateSetting: <Key extends keyof ExtensionSettings>(
    key: Key,
    value: ExtensionSettings[Key],
  ) => void | Promise<void>;
}

export function SettingsModal({
  assetUrl,
  checking,
  open,
  promptCount,
  providers,
  settings,
  settingsTab,
  supportedLanguages,
  updateStatus,
  versionInfo,
  onClearDraft,
  onClearPromptLibrary,
  onClose,
  onExportPromptLibrary,
  onExportSettings,
  onExportWorkspaceData,
  onImportDefaultPromptLibrary,
  onImportPromptFile,
  onImportSettingsFile,
  onMoveProvider,
  onOpenPromptLibrary,
  onResetAllSettings,
  onRunVersionCheck,
  onSetGoogleMode,
  onSettingsTabChange,
  onToggleProvider,
  onUpdateSetting,
}: SettingsModalProps) {
  return (
    <Modal
      description="All controls now live inside the workspace instead of a separate options page."
      onClose={onClose}
      open={open}
      size="xl"
      stableHeight
      title="Settings"
    >
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          {SETTINGS_TABS.map(({ value, label }) => (
            <button
              key={value}
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${settingsTab === value
                ? "bg-white/12 text-white"
                : "bg-white/4 text-[hsl(var(--foreground-soft))] hover:bg-white/8 hover:text-white"
                }`}
              onClick={() => onSettingsTabChange(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {settingsTab === "appearance" ? (
            <>
              <SettingItem
                description="Light, dark, or follow your system preference."
                title="Theme"
                trailing={
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => void onUpdateSetting("theme", "light")}
                      variant={settings.theme === "light" ? "primary" : "secondary"}
                    >
                      <SunMedium size={16} />
                      Light
                    </Button>
                    <Button
                      onClick={() => void onUpdateSetting("theme", "dark")}
                      variant={settings.theme === "dark" ? "primary" : "secondary"}
                    >
                      <MoonStar size={16} />
                      Dark
                    </Button>
                    <Button
                      onClick={() => void onUpdateSetting("theme", "auto")}
                      variant={settings.theme === "auto" ? "primary" : "secondary"}
                    >
                      Auto
                    </Button>
                  </div>
                }
              />

              <SettingItem
                description="Choose which locale the extension UI should prefer."
                title="Language"
              >
                <Select
                  aria-label="Choose language"
                  onChange={(event) =>
                    void onUpdateSetting(
                      "language",
                      event.target.value === "auto" ? null : event.target.value,
                    )
                  }
                  title="Choose language"
                  value={settings.language ?? "auto"}
                >
                  {supportedLanguages.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </Select>
              </SettingItem>

              <SettingItem
                description="Show the experimental animated links between the floating composer and provider prompts."
                title="Connector lines"
                trailing={
                  <Switch
                    aria-label={
                      settings.connectorOverlayEnabled
                        ? "Disable connector lines"
                        : "Enable connector lines"
                    }
                    checked={settings.connectorOverlayEnabled}
                    onChange={(event) =>
                      void onUpdateSetting("connectorOverlayEnabled", event.target.checked)
                    }
                    title={
                      settings.connectorOverlayEnabled
                        ? "Disable connector lines"
                        : "Enable connector lines"
                    }
                  />
                }
              />

              <SettingItem
                description="Pick whether the Google panel should open AI mode or standard search."
                title="Google mode"
              >
                <Select
                  aria-label="Choose Google mode"
                  onChange={(event) =>
                    void onSetGoogleMode(event.target.value === "search" ? "search" : "ai")
                  }
                  title="Choose Google mode"
                  value={settings.googleProviderMode}
                >
                  <option value="ai">AI mode</option>
                  <option value="search">Search mode</option>
                </Select>
              </SettingItem>
            </>
          ) : null}

          {settingsTab === "providers" ? (
            <div className="space-y-3">
              {providers.map((provider, index) => {
                const enabled = settings.enabledProviders.includes(provider.id);
                return (
                  <div
                    key={provider.id}
                    className="glass-panel flex items-center justify-between gap-4 rounded-[24px] p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        alt=""
                        className="h-10 w-10 rounded-2xl bg-white/8 p-2"
                        src={assetUrl(provider.icon)}
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{provider.name}</p>
                        <p className="text-sm text-[hsl(var(--foreground-muted))]">
                          {provider.url}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        aria-label={`Move ${provider.name} up`}
                        disabled={index === 0}
                        onClick={() => void onMoveProvider(provider.id, "up")}
                        size="icon"
                        title={`Move ${provider.name} up`}
                        variant="ghost"
                      >
                        <ArrowUp size={15} />
                      </Button>
                      <Button
                        aria-label={`Move ${provider.name} down`}
                        disabled={index === providers.length - 1}
                        onClick={() => void onMoveProvider(provider.id, "down")}
                        size="icon"
                        title={`Move ${provider.name} down`}
                        variant="ghost"
                      >
                        <ArrowDown size={15} />
                      </Button>
                      <Switch
                        aria-label={enabled ? `Disable ${provider.name}` : `Enable ${provider.name}`}
                        checked={enabled}
                        onChange={() => void onToggleProvider(provider.id)}
                        title={enabled ? `Disable ${provider.name}` : `Enable ${provider.name}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {settingsTab === "keyboard" ? (
            <>
              <SettingItem
                description="Keep the action shortcut available for opening the workspace."
                title="Keyboard shortcut"
                trailing={
                  <Switch
                    aria-label={
                      settings.keyboardShortcutEnabled
                        ? "Disable keyboard shortcut"
                        : "Enable keyboard shortcut"
                    }
                    checked={settings.keyboardShortcutEnabled}
                    onChange={(event) =>
                      void onUpdateSetting("keyboardShortcutEnabled", event.target.checked)
                    }
                    title={
                      settings.keyboardShortcutEnabled
                        ? "Disable keyboard shortcut"
                        : "Enable keyboard shortcut"
                    }
                  />
                }
              />

              <SettingItem
                description="Tune how Enter behaves when the extension fills provider inputs."
                title="Enter key behavior"
              >
                <div className="grid gap-4 md:grid-cols-[auto_minmax(0,240px)] md:items-center">
                  <Switch
                    aria-label={
                      settings.enterKeyBehavior.enabled
                        ? "Disable custom Enter key behavior"
                        : "Enable custom Enter key behavior"
                    }
                    checked={settings.enterKeyBehavior.enabled}
                    onChange={(event) =>
                      void onUpdateSetting("enterKeyBehavior", {
                        ...settings.enterKeyBehavior,
                        enabled: event.target.checked,
                      })
                    }
                    title={
                      settings.enterKeyBehavior.enabled
                        ? "Disable custom Enter key behavior"
                        : "Enable custom Enter key behavior"
                    }
                  />
                  <Select
                    aria-label="Choose Enter key behavior"
                    onChange={(event) =>
                      void onUpdateSetting("enterKeyBehavior", {
                        ...settings.enterKeyBehavior,
                        preset: event.target.value as ExtensionSettings["enterKeyBehavior"]["preset"],
                      })
                    }
                    title="Choose Enter key behavior"
                    value={settings.enterKeyBehavior.preset}
                  >
                    <option value="default">Default</option>
                    <option value="swapped">Swapped</option>
                    <option value="slack">Slack</option>
                    <option value="discord">Discord</option>
                    <option value="custom">Custom</option>
                  </Select>
                </div>
              </SettingItem>

              <SettingItem
                description="When enabled, prompts with line breaks require Ctrl/Cmd + Enter to send."
                title="Require Ctrl/Cmd + Enter for multiline prompts"
                trailing={
                  <Switch
                    aria-label={
                      settings.requireModifierForMultilineSend
                        ? "Disable modifier requirement for multiline prompts"
                        : "Require Ctrl or Command Enter for multiline prompts"
                    }
                    checked={settings.requireModifierForMultilineSend}
                    onChange={(event) =>
                      void onUpdateSetting(
                        "requireModifierForMultilineSend",
                        event.target.checked,
                      )
                    }
                    title={
                      settings.requireModifierForMultilineSend
                        ? "Disable modifier requirement for multiline prompts"
                        : "Require Ctrl or Command Enter for multiline prompts"
                    }
                  />
                }
              />

              <SettingItem
                description="Control whether selected URLs are prefixed or appended when importing content."
                title="Source URL placement"
              >
                <Select
                  aria-label="Choose source URL placement"
                  onChange={(event) =>
                    void onUpdateSetting(
                      "sourceUrlPlacement",
                      event.target.value as SourceUrlPlacement,
                    )
                  }
                  title="Choose source URL placement"
                  value={settings.sourceUrlPlacement}
                >
                  <option value="none">Do not include source URL</option>
                  <option value="beginning">Place URL at the beginning</option>
                  <option value="end">Place URL at the end</option>
                </Select>
              </SettingItem>
            </>
          ) : null}

          {settingsTab === "library" ? (
            <>
              <SettingItem
                description="Your saved prompt library is stored locally in IndexedDB for quick reuse."
                title="Library overview"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-[hsl(var(--foreground-soft))]">
                    {promptCount} saved prompt{promptCount === 1 ? "" : "s"}
                  </div>
                  <Button onClick={onOpenPromptLibrary} variant="primary">
                    <Notebook size={16} />
                    Open library
                  </Button>
                </div>
              </SettingItem>

              <SettingItem
                description="Bring in starter prompts or exchange libraries as JSON files."
                title="Import and export"
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void onImportDefaultPromptLibrary()} variant="secondary">
                    <Sparkles size={16} />
                    Import defaults
                  </Button>
                  <label className="inline-flex" data-tooltip="Import prompt library JSON">
                    <input
                      accept="application/json"
                      className="hidden"
                      onChange={(event) => {
                        void onImportPromptFile(event.target.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                    <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/8 px-4 text-sm font-medium text-[hsl(var(--foreground))] ring-1 ring-white/10 transition hover:bg-white/12">
                      <Upload size={16} />
                      Import JSON
                    </span>
                  </label>
                  <Button onClick={() => void onExportPromptLibrary()} variant="secondary">
                    <Download size={16} />
                    Export JSON
                  </Button>
                  <Button onClick={() => void onClearPromptLibrary()} variant="danger">
                    Clear library
                  </Button>
                </div>
              </SettingItem>
            </>
          ) : null}

          {settingsTab === "data" ? (
            <>
              <SettingItem
                description="Export your current settings or the full workspace state, including saved prompts."
                title="Backup and restore"
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void onExportSettings()} variant="secondary">
                    <Download size={16} />
                    Export settings
                  </Button>
                  <Button onClick={() => void onExportWorkspaceData()} variant="secondary">
                    <Download size={16} />
                    Export workspace
                  </Button>
                  <label className="inline-flex" data-tooltip="Import settings JSON">
                    <input
                      accept="application/json"
                      className="hidden"
                      onChange={(event) => {
                        void onImportSettingsFile(event.target.files?.[0] ?? null);
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                    <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/8 px-4 text-sm font-medium text-[hsl(var(--foreground))] ring-1 ring-white/10 transition hover:bg-white/12">
                      <Upload size={16} />
                      Import JSON
                    </span>
                  </label>
                </div>
              </SettingItem>

              <SettingItem
                description="Workspace-only actions for clearing local draft state or resetting the extension."
                title="Workspace actions"
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={onClearDraft} variant="secondary">
                    Clear draft
                  </Button>
                  <Button onClick={() => void onResetAllSettings()} variant="danger">
                    <RotateCcw size={16} />
                    Reset settings
                  </Button>
                </div>
              </SettingItem>
            </>
          ) : null}

          {settingsTab === "about" ? (
            <>
              <SettingItem
                description="Build and package information for this extension bundle."
                title="Version info"
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-[hsl(var(--foreground-soft))]">
                    Manifest version:{" "}
                    <span className="text-white">{versionInfo?.manifestVersion ?? "0.1.0"}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-[hsl(var(--foreground-soft))]">
                    Build date: <span className="text-white">{versionInfo?.buildDate ?? "Unknown"}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-[hsl(var(--foreground-soft))]">
                    Commit: <span className="text-white">{versionInfo?.commitHash ?? "Unknown"}</span>
                  </div>
                </div>
              </SettingItem>

              <SettingItem
                description="Runs the packaged version check using the local build metadata."
                title="Update check"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void onRunVersionCheck()} variant="secondary">
                    {checking ? <LoaderCircle className="animate-spin" size={16} /> : null}
                    Check version
                  </Button>
                  {updateStatus ? (
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-[hsl(var(--foreground-soft))]">
                      {updateStatus.error
                        ? updateStatus.error
                        : updateStatus.updateAvailable
                          ? `Newer metadata version available: ${updateStatus.latestVersion}`
                          : `You are on ${updateStatus.currentVersion}.`}
                    </div>
                  ) : null}
                </div>
              </SettingItem>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
