import { useState, type DragEvent } from "react";
import {
  Download,
  ExternalLink,
  Grid2x2X,
  GripVertical,
  ListRestart,
  LoaderCircle,
  Move,
  MoonStar,
  Notebook,
  RotateCcw,
  SunMedium,
  Trash2,
  Upload,
} from "lucide-react";

import { EnterKeyPresetRow } from "@/multi-panel/components/EnterKeyPresetRow";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FilePickerButton } from "@/shared/components/FilePickerButton";
import { InfoBadge } from "@/shared/components/InfoBadge";
import { Kbd } from "@/shared/components/Kbd";
import { Modal } from "@/shared/components/Modal";
import { ALT_KEY_LABEL, META_KEY_LABEL, PRIMARY_MODIFIER_LABEL } from "@/shared/lib/platform";
import { Select } from "@/shared/components/Select";
import { SettingItem } from "@/shared/components/SettingItem";
import { Switch } from "@/shared/components/Switch";
import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import type { SettingsTab } from "@/multi-panel/types";
import type { Provider, ProviderId } from "@/shared/lib/providers";
import {
  ENTER_KEY_PRESETS,
  applyEnterKeyPreset,
  type ComposerDefaultPosition,
  type EnterKeyBehavior,
  type ExtensionSettings,
  type GoogleProviderMode,
  type SourceUrlPlacement,
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
  onClearPromptLibrary: () => void | Promise<void>;
  onClose: () => void;
  onExportPromptLibrary: () => void | Promise<void>;
  onExportSettings: () => void | Promise<void>;
  onExportWorkspaceData: () => void | Promise<void>;
  onImportDefaultPromptLibrary: () => void | Promise<void>;
  onImportPromptFile: (file: File | null) => void | Promise<void>;
  onImportSettingsFile: (file: File | null) => void | Promise<void>;
  onOpenPromptLibrary: () => void;
  onReorderProvider: (providerId: ProviderId, targetProviderId: ProviderId) => void | Promise<void>;
  onResetAllSettings: () => void | Promise<void>;
  onResetComposer: () => void;
  onResetLayout: () => void;
  onRunVersionCheck: () => void | Promise<unknown>;
  onSetDefaultComposerPosition: (position: ComposerDefaultPosition) => void;
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
  onClearPromptLibrary,
  onClose,
  onExportPromptLibrary,
  onExportSettings,
  onExportWorkspaceData,
  onImportDefaultPromptLibrary,
  onImportPromptFile,
  onImportSettingsFile,
  onOpenPromptLibrary,
  onReorderProvider,
  onResetAllSettings,
  onResetComposer,
  onResetLayout,
  onRunVersionCheck,
  onSetDefaultComposerPosition,
  onSetGoogleMode,
  onSettingsTabChange,
  onToggleProvider,
  onUpdateSetting,
}: SettingsModalProps) {
  const [draggedProviderId, setDraggedProviderId] = useState<ProviderId | null>(null);
  const [providerDropTargetId, setProviderDropTargetId] = useState<ProviderId | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    confirmLabel: string;
    message: string;
    onConfirm: () => void;
    title: string;
  } | null>(null);
  const { resolvedTheme } = useSettingsContext();

  function clearProviderDragState() {
    setDraggedProviderId(null);
    setProviderDropTargetId(null);
  }

  function getProviderDragSource(event: DragEvent<HTMLElement>) {
    const transferId = event.dataTransfer.getData("text/plain");
    return draggedProviderId ?? providers.find((provider) => provider.id === transferId)?.id ?? null;
  }

  function handleProviderDragStart(event: DragEvent<HTMLButtonElement>, providerId: ProviderId) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", providerId);
    setDraggedProviderId(providerId);
  }

  function handleProviderDragOver(event: DragEvent<HTMLDivElement>, targetProviderId: ProviderId) {
    const sourceProviderId = getProviderDragSource(event);
    if (!sourceProviderId || sourceProviderId === targetProviderId) {
      setProviderDropTargetId(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setProviderDropTargetId((current) => (current === targetProviderId ? current : targetProviderId));
  }

  function handleProviderDrop(event: DragEvent<HTMLDivElement>, targetProviderId: ProviderId) {
    event.preventDefault();
    const sourceProviderId = getProviderDragSource(event);

    clearProviderDragState();

    if (!sourceProviderId || sourceProviderId === targetProviderId) {
      return;
    }

    void onReorderProvider(sourceProviderId, targetProviderId);
  }

  return (
    <Modal
      bodyClassName="overflow-hidden"
      description="All controls now live inside the workspace instead of a separate options page."
      onClose={onClose}
      open={open}
      size="xl"
      stableHeight
      title="Settings"
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2 self-start">
          {SETTINGS_TABS.map(({ value, label }) => (
            <button
              key={value}
              className={`w-full squircle rounded-[54px] px-4 py-3 text-left text-sm font-medium transition ${settingsTab === value
                ? "bg-[hsl(var(--surface-popover))] text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--tint-ring)/0.10)]"
                : "bg-transparent text-[hsl(var(--foreground-soft))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--foreground))]"
                }`}
              onClick={() => onSettingsTabChange(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={
            settingsTab === "providers"
              ? "min-h-0"
              : "minimal-scrollbar min-h-0 space-y-4 overflow-y-auto pr-2"
          }
        >
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
                description="Where the floating composer should sit by default. Drag to move it anywhere. Double click the composer bar will snap it back to this default position."
                title="Default composer position"
                trailing={
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => onSetDefaultComposerPosition("middle")}
                      variant={
                        settings.defaultComposerPosition === "middle" ? "primary" : "secondary"
                      }
                    >
                      Middle
                    </Button>
                    <Button
                      onClick={() => onSetDefaultComposerPosition("lower")}
                      variant={
                        settings.defaultComposerPosition === "lower" ? "primary" : "secondary"
                      }
                    >
                      Lower
                    </Button>
                    <Button
                      onClick={() => onSetDefaultComposerPosition("bottom")}
                      variant={
                        settings.defaultComposerPosition === "bottom" ? "primary" : "secondary"
                      }
                    >
                      Bottom
                    </Button>
                  </div>
                }
              />

              <SettingItem
                description="Choose which locale the extension UI should prefer."
                title="Language"
                trailing={
                  <Select
                    aria-label="Choose language"
                    onValueChange={(nextValue) =>
                      void onUpdateSetting(
                        "language",
                        nextValue === "auto" ? null : nextValue,
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
                }
              />

              <SettingItem
                description={"Show the experimental animated links between the floating composer and provider prompts.\n(Turn off this may improve performance on some devices, so feel free to disable it if you notice any lag or just reduce motions.)"}
                title="Fancy connector lines"
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

            </>
          ) : null}

          {settingsTab === "providers" ? (
            <div className="minimal-scrollbar h-full min-h-0 space-y-4 overflow-y-auto pr-2">
              <SettingItem
                description={"Auto-switch Gemini to 'Pro' to prevent the page from falling back to 'Fast'. Toggle off if you want to use Fast mode.\n(temporarily fix for the known bug in the gemini web interface)"}
                title="Keep Gemini on Pro"
                trailing={
                  <Switch
                    aria-label={
                      settings.geminiAutoProEnabled
                        ? "Disable Gemini auto-Pro"
                        : "Enable Gemini auto-Pro"
                    }
                    checked={settings.geminiAutoProEnabled}
                    onChange={(event) =>
                      void onUpdateSetting("geminiAutoProEnabled", event.target.checked)
                    }
                    title={
                      settings.geminiAutoProEnabled
                        ? "Disable Gemini auto-Pro"
                        : "Enable Gemini auto-Pro"
                    }
                  />
                }
              />

              <div className="space-y-3">
                {providers.map((provider) => {
                  const enabled = settings.enabledProviders.includes(provider.id);
                  const isDraggedProvider = draggedProviderId === provider.id;
                  const isDropTarget = providerDropTargetId === provider.id;
                  return (
                    <div
                      key={provider.id}
                      className={`relative flex items-center justify-between gap-4 squircle rounded-[54px] border border-[hsl(var(--border-muted)/0.08)] bg-[hsl(var(--surface-panel))] p-4 shadow-[0_20px_70px_-48px_hsl(var(--shadow-ambient)/0.75)] transition ${isDraggedProvider ? "opacity-45" : ""
                        } ${isDropTarget ? "bg-[hsl(var(--surface-elevated))] ring-1 ring-[hsl(var(--tint-ring)/0.14)]" : ""
                        }`}
                      onDragOver={(event) => handleProviderDragOver(event, provider.id)}
                      onDrop={(event) => handleProviderDrop(event, provider.id)}
                    >
                      {isDropTarget ? (
                        <>
                          <div className="pointer-events-none absolute inset-0 z-[1] rounded-[24px] bg-[hsl(var(--accent-cool)/0.12)]" />
                          <div className="pointer-events-none absolute inset-0 z-[2] rounded-[24px] bg-[linear-gradient(180deg,hsl(var(--accent-cool)/0.18),hsl(var(--accent-cool)/0.07))] shadow-[inset_0_0_0_1px_hsl(var(--accent-cool)/0.48),inset_0_0_0_2px_hsl(var(--accent-cool)/0.22),inset_0_0_34px_hsl(var(--accent-cool)/0.10)]" />
                        </>
                      ) : null}
                      <div className="relative z-[3] flex min-w-0 items-center gap-3">
                        <button
                          aria-label={`Drag ${provider.name} to reorder`}
                          className={`inline-flex h-9 w-5 shrink-0 cursor-grab items-center justify-center text-[hsl(var(--foreground)/0.45)] transition hover:text-[hsl(var(--foreground))] active:cursor-grabbing ${isDraggedProvider ? "cursor-grabbing text-[hsl(var(--foreground))]" : ""
                            }`}
                          data-tooltip={`Drag ${provider.name} to reorder`}
                          draggable
                          onDragEnd={clearProviderDragState}
                          onDragStart={(event) => handleProviderDragStart(event, provider.id)}
                          title={`Drag ${provider.name} to reorder`}
                          type="button"
                        >
                          <GripVertical size={17} strokeWidth={2.1} />
                        </button>
                        <img
                          alt=""
                          className="h-10 w-10 rounded-2xl bg-[hsl(var(--surface-popover))] p-2 ring-1 ring-[hsl(var(--tint-ring)/0.10)]"
                          src={assetUrl(resolvedTheme === "light" ? provider.icon : provider.iconDark)}
                        />
                        <div>
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{provider.name}</p>
                          <p className="text-sm text-[hsl(var(--foreground-muted))]">
                            {provider.url}
                          </p>
                        </div>
                      </div>
                      <div className="relative z-[3] flex items-center gap-3">
                        {provider.id === "google" ? (
                          <div className="w-30">
                            <Select
                              aria-label="Choose Google mode"
                              onValueChange={(nextValue) =>
                                void onSetGoogleMode(nextValue === "search" ? "search" : "ai")
                              }
                              title="Choose Google mode"
                              value={settings.googleProviderMode}
                            >
                              <option value="ai">AI Mode</option>
                              <option value="search">Search</option>
                            </Select>
                          </div>
                        ) : null}
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
            </div>
          ) : null}

          {settingsTab === "keyboard" ? (
            <>
              <SettingItem
                description={
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Kbd>{PRIMARY_MODIFIER_LABEL}</Kbd>
                      <span>+</span>
                      <Kbd>Shift</Kbd>
                      <span>+</span>
                      <Kbd>E</Kbd>
                      <span className="ml-1">Opens a new Parallel AI workspace.</span>
                    </div>
                    <p>
                      To change or disable this shortcut, type{" "}
                      <code className="rounded-md border border-[hsl(var(--border-muted)/0.20)] bg-[hsl(var(--surface-panel))] px-1.5 py-0.5 font-mono text-[12px] text-[hsl(var(--foreground))]">
                        chrome://extensions/shortcuts
                      </code>{" "}
                      on a new tab in Chrome or use the button on the right to open Chrome's
                      keyboard shortcuts page and edit the entry for Parallel AI.
                    </p>
                  </div>
                }
                title="Keyboard shortcut"
                trailing={
                  <Button
                    onClick={() => {
                      void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
                    }}
                    title="Open Chrome's keyboard shortcuts page"
                  >
                    <ExternalLink size={16} />
                    Chrome shortcuts
                  </Button>
                }
              />

              <SettingItem
                description="Tune how Enter behaves when the extension fills provider inputs."
                title="Enter key behavior"
                trailing={
                  <div className="w-[420px]">
                    <Select
                      aria-label="Choose Enter key behavior"
                      onValueChange={(nextValue) =>
                        void onUpdateSetting(
                          "enterKeyBehavior",
                          applyEnterKeyPreset(
                            nextValue as EnterKeyBehavior["preset"],
                            settings.enterKeyBehavior,
                          ),
                        )
                      }
                      options={ENTER_KEY_PRESETS}
                      renderOption={(option) => <EnterKeyPresetRow preset={option} />}
                      renderTrigger={(option) =>
                        option ? <EnterKeyPresetRow preset={option} /> : null
                      }
                      title="Choose Enter key behavior"
                      value={settings.enterKeyBehavior.preset}
                    />
                  </div>
                }
              >
                {settings.enterKeyBehavior.preset === "custom" ? (
                  <div className="space-y-3">
                    {(
                      [
                        { key: "newlineModifiers", title: "Insert Newline" },
                        { key: "sendModifiers", title: "Send Message" },
                      ] as const
                    ).map((section) => (
                      <div
                        key={section.key}
                        className="rounded-2xl border border-[hsl(var(--border-muted)/0.10)] bg-[hsl(var(--surface-elevated)/0.40)] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                            {section.title}
                          </span>
                          <div className="flex items-center gap-3">
                            {(
                              [
                                { label: "Shift", modKey: "shift" },
                                { label: "Ctrl", modKey: "ctrl" },
                                { label: ALT_KEY_LABEL, modKey: "alt" },
                                { label: META_KEY_LABEL, modKey: "meta" },
                              ] as const
                            ).map((modifier) => (
                              <label
                                key={modifier.modKey}
                                className="inline-flex cursor-pointer items-center gap-2 text-xs text-[hsl(var(--foreground-soft))]"
                              >
                                <input
                                  checked={
                                    settings.enterKeyBehavior[section.key][modifier.modKey]
                                  }
                                  className="accent-[hsl(var(--foreground))]"
                                  onChange={(event) =>
                                    void onUpdateSetting("enterKeyBehavior", {
                                      ...settings.enterKeyBehavior,
                                      [section.key]: {
                                        ...settings.enterKeyBehavior[section.key],
                                        [modifier.modKey]: event.target.checked,
                                      },
                                    })
                                  }
                                  type="checkbox"
                                />
                                <Kbd>{modifier.label}</Kbd>
                              </label>
                            ))}
                            <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--foreground-muted))]">
                              <span>+</span>
                              <Kbd>Enter</Kbd>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </SettingItem>

              <SettingItem
                description={
                  <>
                    When enabled, prompts with line breaks (more than one line) require{" "}
                    <Kbd>{PRIMARY_MODIFIER_LABEL}</Kbd> + <Kbd>Enter</Kbd> to send.
                  </>
                }
                title={`Require ${PRIMARY_MODIFIER_LABEL} + Enter for multiline prompts`}
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
                trailing={
                  <Select
                    aria-label="Choose source URL placement"
                    onValueChange={(nextValue) =>
                      void onUpdateSetting(
                        "sourceUrlPlacement",
                        nextValue as SourceUrlPlacement,
                      )
                    }
                    title="Choose source URL placement"
                    value={settings.sourceUrlPlacement}
                  >
                    <option value="none">Do not include source URL</option>
                    <option value="beginning">Place URL at the beginning</option>
                    <option value="end">Place URL at the end</option>
                  </Select>
                }
              />
            </>
          ) : null}

          {settingsTab === "library" ? (
            <>
              <SettingItem
                description="Your saved prompt library is stored locally in IndexedDB for quick reuse."
                title="Library overview"
                trailing={
                  <div className="flex flex-wrap items-center gap-3">
                    <InfoBadge>
                      {promptCount} saved prompt{promptCount === 1 ? "" : "s"}
                    </InfoBadge>
                    <Button onClick={onOpenPromptLibrary} variant="primary">
                      <Notebook size={16} />
                      Open library
                    </Button>
                  </div>
                }
              />

              <SettingItem
                description="Bring in starter prompts or exchange libraries as JSON files."
                title="Import and export"
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void onImportDefaultPromptLibrary()} variant="secondary">
                    <ListRestart size={16} />
                    Import defaults
                  </Button>
                  <FilePickerButton
                    accept="application/json"
                    onPick={(file) => void onImportPromptFile(file)}
                    title="Import prompt library JSON"
                    variant="secondary"
                  >
                    <Download size={16} />
                    Import JSON
                  </FilePickerButton>
                  <Button onClick={() => void onExportPromptLibrary()} variant="secondary">
                    <Upload size={16} />
                    Export JSON
                  </Button>
                  <Button
                    onClick={() =>
                      setPendingConfirm({
                        confirmLabel: "Clear library",
                        message:
                          "This permanently deletes every saved prompt in your library.\nYou can't undo this.",
                        onConfirm: () => void onClearPromptLibrary(),
                        title: "Clear prompt library?",
                      })
                    }
                    variant="danger"
                  >
                    <Trash2 size={16} />
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
                    <Upload size={16} />
                    Export settings
                  </Button>
                  <Button onClick={() => void onExportWorkspaceData()} variant="secondary">
                    <Upload size={16} />
                    Export workspace
                  </Button>
                  <FilePickerButton
                    accept="application/json"
                    onPick={(file) => void onImportSettingsFile(file)}
                    title="Import settings JSON"
                    variant="secondary"
                  >
                    <Download size={16} />
                    Import JSON
                  </FilePickerButton>
                </div>
              </SettingItem>

              <SettingItem
                description="Snap individual workspace pieces back to their defaults, or reset the entire extension."
                title="Workspace actions"
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={onResetLayout} variant="secondary">
                    <Grid2x2X size={16} />
                    Reset layout
                  </Button>
                  <Button onClick={onResetComposer} variant="secondary">
                    <Move size={16} />
                    Reset composer position/size
                  </Button>
                  <Button
                    onClick={() =>
                      setPendingConfirm({
                        confirmLabel: "Reset settings",
                        message:
                          "This restores every setting (theme, providers, layout, shortcuts, composer) to its default.\nYour saved prompts are NOT affected.",
                        onConfirm: () => void onResetAllSettings(),
                        title: "Reset all settings?",
                      })
                    }
                    variant="danger"
                  >
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
                  <InfoBadge>
                    Manifest version:{" "}
                    <span className="text-[hsl(var(--foreground))]">{versionInfo?.manifestVersion ?? "0.1.0"}</span>
                  </InfoBadge>
                  <InfoBadge>
                    Build date: <span className="text-[hsl(var(--foreground))]">{versionInfo?.buildDate ?? "Unknown"}</span>
                  </InfoBadge>
                  <InfoBadge>
                    Commit: <span className="text-[hsl(var(--foreground))]">{versionInfo?.commitHash ?? "Unknown"}</span>
                  </InfoBadge>
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
                    <InfoBadge>
                      {updateStatus.error
                        ? updateStatus.error
                        : updateStatus.updateAvailable
                          ? `Newer metadata version available: ${updateStatus.latestVersion}`
                          : `You are on ${updateStatus.currentVersion}.`}
                    </InfoBadge>
                  ) : null}
                </div>
              </SettingItem>
            </>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        confirmLabel={pendingConfirm?.confirmLabel ?? "Confirm"}
        destructive
        message={pendingConfirm?.message ?? ""}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => pendingConfirm?.onConfirm()}
        open={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ""}
      />
    </Modal>
  );
}
