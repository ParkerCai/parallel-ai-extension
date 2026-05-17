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
import { useTranslation } from "@/shared/contexts/I18nContext";
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
  const { t } = useTranslation();

  const settingsTabs: Array<{ label: string; value: SettingsTab }> = [
    { label: t("tabAppearance", "Appearance"), value: "appearance" },
    { label: t("tabProviders", "Providers"), value: "providers" },
    { label: t("tabKeyboard", "Keyboard"), value: "keyboard" },
    { label: t("tabLibrary", "Prompt Library"), value: "library" },
    { label: t("tabData", "Data"), value: "data" },
    { label: t("tabAbout", "About"), value: "about" },
  ];

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
      description={t(
        "settingsModalDescription",
        "All controls now live inside the workspace instead of a separate options page.",
      )}
      onClose={onClose}
      open={open}
      size="xl"
      stableHeight
      title={t("settingsModalTitle", "Settings")}
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2 self-start">
          {settingsTabs.map(({ value, label }) => (
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
                description={t("themeDescription", "Light, dark, or follow your system preference.")}
                title={t("themeTitle", "Theme")}
                trailing={
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => void onUpdateSetting("theme", "light")}
                      variant={settings.theme === "light" ? "primary" : "secondary"}
                    >
                      <SunMedium size={16} />
                      {t("themeLight", "Light")}
                    </Button>
                    <Button
                      onClick={() => void onUpdateSetting("theme", "dark")}
                      variant={settings.theme === "dark" ? "primary" : "secondary"}
                    >
                      <MoonStar size={16} />
                      {t("themeDark", "Dark")}
                    </Button>
                    <Button
                      onClick={() => void onUpdateSetting("theme", "auto")}
                      variant={settings.theme === "auto" ? "primary" : "secondary"}
                    >
                      {t("themeAuto", "Auto")}
                    </Button>
                  </div>
                }
              />

              <SettingItem
                description={t(
                  "composerPositionDescription",
                  "Where the floating composer should sit by default. Drag to move it anywhere. Double click the composer bar will snap it back to this default position.",
                )}
                title={t("composerPositionTitle", "Default composer position")}
                trailing={
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => onSetDefaultComposerPosition("middle")}
                      variant={
                        settings.defaultComposerPosition === "middle" ? "primary" : "secondary"
                      }
                    >
                      {t("composerPositionMiddle", "Middle")}
                    </Button>
                    <Button
                      onClick={() => onSetDefaultComposerPosition("lower")}
                      variant={
                        settings.defaultComposerPosition === "lower" ? "primary" : "secondary"
                      }
                    >
                      {t("composerPositionLower", "Lower")}
                    </Button>
                    <Button
                      onClick={() => onSetDefaultComposerPosition("bottom")}
                      variant={
                        settings.defaultComposerPosition === "bottom" ? "primary" : "secondary"
                      }
                    >
                      {t("composerPositionBottom", "Bottom")}
                    </Button>
                  </div>
                }
              />

              <SettingItem
                description={t("languageDescription", "Choose which locale the extension UI should prefer.")}
                title={t("languageTitle", "Language")}
                trailing={
                  <Select
                    aria-label={t("languageAriaChoose", "Choose language")}
                    onValueChange={(nextValue) =>
                      void onUpdateSetting(
                        "language",
                        nextValue === "auto" ? null : nextValue,
                      )
                    }
                    title={t("languageAriaChoose", "Choose language")}
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
                description={t(
                  "connectorLinesDescription",
                  "Show the experimental animated links between the floating composer and provider prompts.\n(Turn off this may improve performance on some devices, so feel free to disable it if you notice any lag or just reduce motions.)",
                )}
                title={t("connectorLinesTitle", "Fancy connector lines")}
                trailing={
                  <Switch
                    aria-label={
                      settings.connectorOverlayEnabled
                        ? t("connectorLinesAriaDisable", "Disable connector lines")
                        : t("connectorLinesAriaEnable", "Enable connector lines")
                    }
                    checked={settings.connectorOverlayEnabled}
                    onChange={(event) =>
                      void onUpdateSetting("connectorOverlayEnabled", event.target.checked)
                    }
                    title={
                      settings.connectorOverlayEnabled
                        ? t("connectorLinesAriaDisable", "Disable connector lines")
                        : t("connectorLinesAriaEnable", "Enable connector lines")
                    }
                  />
                }
              />

            </>
          ) : null}

          {settingsTab === "providers" ? (
            <div className="minimal-scrollbar h-full min-h-0 space-y-4 overflow-y-auto pr-2">
              <SettingItem
                description={t(
                  "geminiAutoProDescription",
                  "Auto-switch Gemini to 'Pro' to prevent the page from falling back to 'Fast'. Toggle off if you want to use Fast mode.\n(temporarily fix for the known bug in the gemini web interface)",
                )}
                title={t("geminiAutoProTitle", "Keep Gemini on Pro")}
                trailing={
                  <Switch
                    aria-label={
                      settings.geminiAutoProEnabled
                        ? t("geminiAutoProAriaDisable", "Disable Gemini auto-Pro")
                        : t("geminiAutoProAriaEnable", "Enable Gemini auto-Pro")
                    }
                    checked={settings.geminiAutoProEnabled}
                    onChange={(event) =>
                      void onUpdateSetting("geminiAutoProEnabled", event.target.checked)
                    }
                    title={
                      settings.geminiAutoProEnabled
                        ? t("geminiAutoProAriaDisable", "Disable Gemini auto-Pro")
                        : t("geminiAutoProAriaEnable", "Enable Gemini auto-Pro")
                    }
                  />
                }
              />

              <div className="space-y-3">
                {providers.map((provider) => {
                  const enabled = settings.enabledProviders.includes(provider.id);
                  const isDraggedProvider = draggedProviderId === provider.id;
                  const isDropTarget = providerDropTargetId === provider.id;
                  const dragTooltip = t("providerAriaDragReorder", "Drag $1 to reorder", provider.name);
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
                          aria-label={dragTooltip}
                          className={`inline-flex h-9 w-5 shrink-0 cursor-grab items-center justify-center text-[hsl(var(--foreground)/0.45)] transition hover:text-[hsl(var(--foreground))] active:cursor-grabbing ${isDraggedProvider ? "cursor-grabbing text-[hsl(var(--foreground))]" : ""
                            }`}
                          data-tooltip={dragTooltip}
                          draggable
                          onDragEnd={clearProviderDragState}
                          onDragStart={(event) => handleProviderDragStart(event, provider.id)}
                          title={dragTooltip}
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
                              aria-label={t("googleModeAria", "Choose Google mode")}
                              onValueChange={(nextValue) =>
                                void onSetGoogleMode(nextValue === "search" ? "search" : "ai")
                              }
                              title={t("googleModeAria", "Choose Google mode")}
                              value={settings.googleProviderMode}
                            >
                              <option value="ai">{t("googleModeAi", "AI Mode")}</option>
                              <option value="search">{t("googleModeSearch", "Search")}</option>
                            </Select>
                          </div>
                        ) : null}
                        <Switch
                          aria-label={
                            enabled
                              ? t("providerAriaDisable", "Disable $1", provider.name)
                              : t("providerAriaEnable", "Enable $1", provider.name)
                          }
                          checked={enabled}
                          onChange={() => void onToggleProvider(provider.id)}
                          title={
                            enabled
                              ? t("providerAriaDisable", "Disable $1", provider.name)
                              : t("providerAriaEnable", "Enable $1", provider.name)
                          }
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
                      <span className="ml-1">{t("keyboardShortcutDescriptionShortcut", "Opens a new Parallel AI workspace.")}</span>
                    </div>
                    <p>
                      {t("keyboardShortcutDescriptionPrefix", "To change or disable this shortcut, type")}{" "}
                      <code className="rounded-md border border-[hsl(var(--border-muted)/0.20)] bg-[hsl(var(--surface-panel))] px-1.5 py-0.5 font-mono text-[12px] text-[hsl(var(--foreground))]">
                        chrome://extensions/shortcuts
                      </code>{" "}
                      {t("keyboardShortcutDescriptionSuffix", "on a new tab in Chrome or use the button on the right to open Chrome's keyboard shortcuts page and edit the entry for Parallel AI.")}
                    </p>
                  </div>
                }
                title={t("keyboardShortcutTitle", "Keyboard shortcut")}
                trailing={
                  <Button
                    onClick={() => {
                      void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
                    }}
                    title={t("keyboardShortcutOpenChromeTitle", "Open Chrome's keyboard shortcuts page")}
                  >
                    <ExternalLink size={16} />
                    {t("keyboardShortcutOpenChrome", "Chrome shortcuts")}
                  </Button>
                }
              />

              <SettingItem
                description={t(
                  "enterKeyBehaviorDescription",
                  "Tune how Enter behaves when the extension fills provider inputs.",
                )}
                title={t("enterKeyBehaviorTitle", "Enter key behavior")}
                trailing={
                  <div className="w-[420px]">
                    <Select
                      aria-label={t("enterKeyBehaviorAria", "Choose Enter key behavior")}
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
                      title={t("enterKeyBehaviorAria", "Choose Enter key behavior")}
                      value={settings.enterKeyBehavior.preset}
                    />
                  </div>
                }
              >
                {settings.enterKeyBehavior.preset === "custom" ? (
                  <div className="space-y-3">
                    {(
                      [
                        { key: "newlineModifiers", title: t("enterCustomNewline", "Insert Newline") },
                        { key: "sendModifiers", title: t("enterCustomSend", "Send Message") },
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
                    {t("multilineSendDescriptionPrefix", "When enabled, prompts with line breaks (more than one line) require")}{" "}
                    <Kbd>{PRIMARY_MODIFIER_LABEL}</Kbd> + <Kbd>Enter</Kbd> {t("multilineSendDescriptionSuffix", "to send.")}
                  </>
                }
                title={t("multilineSendTitle", "Require $1 + Enter for multiline prompts", PRIMARY_MODIFIER_LABEL)}
                trailing={
                  <Switch
                    aria-label={
                      settings.requireModifierForMultilineSend
                        ? t("multilineSendAriaDisable", "Disable modifier requirement for multiline prompts")
                        : t("multilineSendAriaEnable", "Require Ctrl or Command Enter for multiline prompts")
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
                        ? t("multilineSendAriaDisable", "Disable modifier requirement for multiline prompts")
                        : t("multilineSendAriaEnable", "Require Ctrl or Command Enter for multiline prompts")
                    }
                  />
                }
              />

              <SettingItem
                description={t(
                  "sourceUrlDescription",
                  "Control whether selected URLs are prefixed or appended when importing content.",
                )}
                title={t("sourceUrlTitle", "Source URL placement")}
                trailing={
                  <Select
                    aria-label={t("sourceUrlAria", "Choose source URL placement")}
                    onValueChange={(nextValue) =>
                      void onUpdateSetting(
                        "sourceUrlPlacement",
                        nextValue as SourceUrlPlacement,
                      )
                    }
                    title={t("sourceUrlAria", "Choose source URL placement")}
                    value={settings.sourceUrlPlacement}
                  >
                    <option value="none">{t("sourceUrlNone", "Do not include source URL")}</option>
                    <option value="beginning">{t("sourceUrlBeginning", "Place URL at the beginning")}</option>
                    <option value="end">{t("sourceUrlEnd", "Place URL at the end")}</option>
                  </Select>
                }
              />
            </>
          ) : null}

          {settingsTab === "library" ? (
            <>
              <SettingItem
                description={t(
                  "libraryOverviewDescription",
                  "Your saved prompt library is stored locally in IndexedDB for quick reuse.",
                )}
                title={t("libraryOverviewTitle", "Library overview")}
                trailing={
                  <div className="flex flex-wrap items-center gap-3">
                    <InfoBadge>
                      {promptCount === 1
                        ? t("libraryPromptCountOne", "$1 saved prompt", String(promptCount))
                        : t("libraryPromptCountMany", "$1 saved prompts", String(promptCount))}
                    </InfoBadge>
                    <Button onClick={onOpenPromptLibrary} variant="primary">
                      <Notebook size={16} />
                      {t("libraryOpen", "Open library")}
                    </Button>
                  </div>
                }
              />

              <SettingItem
                description={t(
                  "libraryImportExportDescription",
                  "Bring in starter prompts or exchange libraries as JSON files.",
                )}
                title={t("libraryImportExportTitle", "Import and export")}
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void onImportDefaultPromptLibrary()} variant="secondary">
                    <ListRestart size={16} />
                    {t("libraryImportDefaults", "Import defaults")}
                  </Button>
                  <FilePickerButton
                    accept="application/json"
                    onPick={(file) => void onImportPromptFile(file)}
                    title={t("libraryImportJsonTitle", "Import prompt library JSON")}
                    variant="secondary"
                  >
                    <Download size={16} />
                    {t("libraryImportJson", "Import JSON")}
                  </FilePickerButton>
                  <Button onClick={() => void onExportPromptLibrary()} variant="secondary">
                    <Upload size={16} />
                    {t("libraryExportJson", "Export JSON")}
                  </Button>
                  <Button
                    onClick={() =>
                      setPendingConfirm({
                        confirmLabel: t("libraryClearConfirmLabel", "Clear library"),
                        message: t(
                          "libraryClearConfirmMessage",
                          "This permanently deletes every saved prompt in your library.\nYou can't undo this.",
                        ),
                        onConfirm: () => void onClearPromptLibrary(),
                        title: t("libraryClearConfirmTitle", "Clear prompt library?"),
                      })
                    }
                    variant="danger"
                  >
                    <Trash2 size={16} />
                    {t("libraryClear", "Clear library")}
                  </Button>
                </div>
              </SettingItem>
            </>
          ) : null}

          {settingsTab === "data" ? (
            <>
              <SettingItem
                description={t(
                  "dataBackupDescription",
                  "Export your current settings or the full workspace state, including saved prompts.",
                )}
                title={t("dataBackupTitle", "Backup and restore")}
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void onExportSettings()} variant="secondary">
                    <Upload size={16} />
                    {t("dataExportSettings", "Export settings")}
                  </Button>
                  <Button onClick={() => void onExportWorkspaceData()} variant="secondary">
                    <Upload size={16} />
                    {t("dataExportWorkspace", "Export workspace")}
                  </Button>
                  <FilePickerButton
                    accept="application/json"
                    onPick={(file) => void onImportSettingsFile(file)}
                    title={t("dataImportSettingsTitle", "Import settings JSON")}
                    variant="secondary"
                  >
                    <Download size={16} />
                    {t("dataImportJson", "Import JSON")}
                  </FilePickerButton>
                </div>
              </SettingItem>

              <SettingItem
                description={t(
                  "dataWorkspaceActionsDescription",
                  "Snap individual workspace pieces back to their defaults, or reset the entire extension.",
                )}
                title={t("dataWorkspaceActionsTitle", "Workspace actions")}
              >
                <div className="flex flex-wrap gap-3">
                  <Button onClick={onResetLayout} variant="secondary">
                    <Grid2x2X size={16} />
                    {t("dataResetLayout", "Reset layout")}
                  </Button>
                  <Button onClick={onResetComposer} variant="secondary">
                    <Move size={16} />
                    {t("dataResetComposer", "Reset composer position/size")}
                  </Button>
                  <Button
                    onClick={() =>
                      setPendingConfirm({
                        confirmLabel: t("dataResetSettingsConfirmLabel", "Reset settings"),
                        message: t(
                          "dataResetSettingsConfirmMessage",
                          "This restores every setting (theme, providers, layout, shortcuts, composer) to its default.\nYour saved prompts are NOT affected.",
                        ),
                        onConfirm: () => void onResetAllSettings(),
                        title: t("dataResetSettingsConfirmTitle", "Reset all settings?"),
                      })
                    }
                    variant="danger"
                  >
                    <RotateCcw size={16} />
                    {t("dataResetSettings", "Reset settings")}
                  </Button>
                </div>
              </SettingItem>
            </>
          ) : null}

          {settingsTab === "about" ? (
            <>
              <SettingItem
                description={t(
                  "aboutVersionDescription",
                  "Build and package information for this extension bundle.",
                )}
                title={t("aboutVersionTitle", "Version info")}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoBadge>
                    {t("aboutManifestVersion", "Manifest version:")}{" "}
                    <span className="text-[hsl(var(--foreground))]">{versionInfo?.manifestVersion ?? "0.1.0"}</span>
                  </InfoBadge>
                  <InfoBadge>
                    {t("aboutBuildDate", "Build date:")} <span className="text-[hsl(var(--foreground))]">{versionInfo?.buildDate ?? t("aboutUnknown", "Unknown")}</span>
                  </InfoBadge>
                  <InfoBadge>
                    {t("aboutCommit", "Commit:")} <span className="text-[hsl(var(--foreground))]">{versionInfo?.commitHash ?? t("aboutUnknown", "Unknown")}</span>
                  </InfoBadge>
                </div>
              </SettingItem>

              <SettingItem
                description={t(
                  "aboutUpdateCheckDescription",
                  "Runs the packaged version check using the local build metadata.",
                )}
                title={t("aboutUpdateCheckTitle", "Update check")}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void onRunVersionCheck()} variant="secondary">
                    {checking ? <LoaderCircle className="animate-spin" size={16} /> : null}
                    {t("aboutCheckVersion", "Check version")}
                  </Button>
                  {updateStatus ? (
                    <InfoBadge>
                      {updateStatus.error
                        ? updateStatus.error
                        : updateStatus.updateAvailable
                          ? t("aboutUpdateAvailable", "Newer metadata version available: $1", updateStatus.latestVersion)
                          : t("aboutUpToDate", "You are on $1.", updateStatus.currentVersion)}
                    </InfoBadge>
                  ) : null}
                </div>
              </SettingItem>
            </>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        confirmLabel={pendingConfirm?.confirmLabel ?? t("confirmDefault", "Confirm")}
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
