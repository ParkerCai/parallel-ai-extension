import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  PromptEditorModal,
  PromptLibraryModal,
  VariableInputModal,
} from "@/multi-panel/components/PromptLibraryModal";
import { ConnectorOverlay } from "@/multi-panel/components/ConnectorOverlay";
import { FloatingComposer } from "@/multi-panel/components/FloatingComposer";
import { LayoutModal } from "@/multi-panel/components/LayoutModal";
import { PanelWorkspace } from "@/multi-panel/components/PanelWorkspace";
import { SettingsModal } from "@/multi-panel/components/SettingsModal";
import { useComposerDraftController } from "@/multi-panel/hooks/useComposerDraftController";
import { useComposerFrameController } from "@/multi-panel/hooks/useComposerFrameController";
import { useConnectorController } from "@/multi-panel/hooks/useConnectorController";
import { usePanelLayoutController } from "@/multi-panel/hooks/usePanelLayoutController";
import { usePendingActionController } from "@/multi-panel/hooks/usePendingActionController";
import { usePromptLibraryController } from "@/multi-panel/hooks/usePromptLibraryController";
import { useProviderActionsController } from "@/multi-panel/hooks/useProviderActionsController";
import { useProviderFramesController } from "@/multi-panel/hooks/useProviderFramesController";
import { useVersionCheck } from "@/multi-panel/hooks/useVersionCheck";
import { useWorkspaceDataController } from "@/multi-panel/hooks/useWorkspaceDataController";
import { useProviderContext } from "@/shared/contexts/ProviderContext";
import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import { useI18n } from "@/shared/hooks/useI18n";
import {
  resizePanelProviders,
} from "@/multi-panel/lib/panel-layout";
import { runtimeAsset } from "@/multi-panel/lib/runtime";
import type {
  SettingsTab,
} from "@/multi-panel/types";

const CONNECTOR_MASK_ID = "composer-connector-mask";

export function App() {
  const { enabledProviders, moveProvider, providers, setGoogleMode, toggleProvider } =
    useProviderContext();
  const { loaded, resetAllSettings, settings, updateSetting, updateSettings } = useSettingsContext();
  const { checking, runCheck, updateStatus, versionInfo } = useVersionCheck();
  const { supportedLanguages } = useI18n(settings.language);

  const [isHydrated, setIsHydrated] = useState(false);
  const [layoutModalOpen, setLayoutModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [temporaryChatEnabled, setTemporaryChatEnabled] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");

  const statusTimeoutRef = useRef<number | null>(null);
  const frameRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const mainCanvasRef = useRef<HTMLElement | null>(null);

  function showStatus(message: string) {
    setStatusMessage(message);

    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }

    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage("Ready.");
    }, 3200);
  }

  const {
    attachments,
    handleComposerDrop,
    handleComposerPaste,
    handleFilesSelected,
    hasDraftContent,
    prompt,
    setAttachments,
    setPrompt,
  } = useComposerDraftController({ showStatus });

  const {
    beginComposerDrag,
    beginComposerDragFromHeader,
    beginComposerResize,
    composerDragging,
    composerHeight,
    composerInputRef,
    composerOffset,
    composerRef,
    composerShellRef,
    composerWidth,
    focusComposerInput,
    hydrateComposerFrame,
    resetComposerPosition,
    resetComposerSize,
  } = useComposerFrameController({
    attachmentCount: attachments.length,
    isHydrated,
    prompt,
    settings,
    showStatus,
    updateSetting,
    updateSettings,
  });

  const {
    filteredPromptLibraryItems,
    handleApplyPromptVariables,
    handleClearPromptLibrary,
    handleDeletePrompt,
    handleExportPromptLibrary,
    handleImportDefaultPromptLibrary,
    handleImportPromptFile,
    handleSavePromptEditor,
    handleToggleFavorite,
    handleUsePrompt,
    closePromptEditor,
    openPromptEditor,
    promptCategories,
    promptEditorOpen,
    promptEditorState,
    refreshPromptLibrary,
    promptLibraryCategory,
    promptLibraryFilter,
    promptLibraryItems,
    promptLibraryOpen,
    promptLibrarySearch,
    setPromptEditorState,
    setPromptLibraryCategory,
    setPromptLibraryFilter,
    setPromptLibraryOpen,
    setPromptLibrarySearch,
    setVariablePrompt,
    setVariableValues,
    variablePrompt,
    variableValues,
  } = usePromptLibraryController({
    assetUrl: runtimeAsset,
    loaded,
    setPrompt,
    showStatus,
  });
  const {
    handleExportSettings,
    handleExportWorkspaceData,
    handleImportSettingsFile,
  } = useWorkspaceDataController({
    refreshPromptLibrary,
    showStatus,
  });
  const {
    addPanel,
    beginPanelDrag,
    hydratePanelLayout,
    horizontalPanelGroupRefs,
    layout,
    panelDragSourceIndex,
    panelDragTargetIndex,
    panelProviders,
    panelSlotRefs,
    removePanel,
    resetHorizontalPanelLayout,
    resetVerticalPanelLayout,
    setLayout,
    setPanelProviders,
    slotProviders,
    switchPanelProvider,
    verticalPanelGroupRef,
  } = usePanelLayoutController({
    enabledProviders: settings.enabledProviders,
    isHydrated,
    showStatus,
    updateSetting,
  });
  const {
    armConnectorDispatch,
    connectorOccluderModels,
    connectorPathModels,
    queueConnectorLayoutRefresh,
    resetConnectorVisuals,
  } = useConnectorController({
    attachments,
    composerRef,
    composerShellRef,
    connectorOverlayEnabled: settings.connectorOverlayEnabled,
    frameRefs,
    googleProviderMode: settings.googleProviderMode,
    layout,
    panelProviders,
    panelSlotRefs,
    prompt,
    scrollSyncEnabled: settings.scrollSyncEnabled,
    slotProviders,
    temporaryChatEnabled,
  });
  const {
    loadingProviders,
    postToProvider,
    refreshProvider,
    registerFrameHost,
    requestProviderInputAnchor,
  } = useProviderFramesController({
    frameRefs,
    googleProviderMode: settings.googleProviderMode,
    isHydrated,
    panelProviders,
    queueConnectorLayoutRefresh,
    temporaryChatEnabled,
  });
  const {
    clearPanels,
    dispatchPrompt,
    openNewChatEverywhere,
    toggleScrollSync,
    toggleTemporaryChat,
  } = useProviderActionsController({
    armConnectorDispatch,
    attachments,
    panelProviders,
    postToProvider,
    prompt,
    requestProviderInputAnchor,
    resetConnectorVisuals,
    scrollSyncEnabled: settings.scrollSyncEnabled,
    setAttachments,
    setPrompt,
    setTemporaryChatEnabled,
    showStatus,
    temporaryChatEnabled,
    updateSetting,
  });
  usePendingActionController({
    dispatchPrompt,
    isHydrated,
    panelProviders,
    setPrompt,
    setPromptLibraryOpen,
    showStatus,
  });

  useEffect(() => {
    if (!loaded || isHydrated) {
      return;
    }

    hydratePanelLayout(settings.currentLayout, settings.panelProviders, settings.enabledProviders);
    hydrateComposerFrame();
    setIsHydrated(true);
  }, [
    hydrateComposerFrame,
    isHydrated,
    loaded,
    settings.composerSize,
    settings.currentLayout,
    settings.enabledProviders,
    settings.panelProviders,
    hydratePanelLayout,
  ]);

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
    const hasSendModifier = event.ctrlKey || event.metaKey;
    const isMultilinePrompt =
      settings.requireModifierForMultilineSend && event.currentTarget.value.includes("\n");

    if (isMultilinePrompt) {
      if (!hasSendModifier) {
        return;
      }

      event.preventDefault();
      void dispatchPrompt(undefined, true);
      return;
    }

    const useSwappedEnterBehavior = settings.enterKeyBehavior.preset === "swapped";
    const shouldSend =
      !hasModifier &&
      (settings.enterKeyBehavior.enabled
        ? useSwappedEnterBehavior
          ? event.shiftKey
          : !event.shiftKey
        : !event.shiftKey);

    if (!shouldSend) {
      return;
    }

    event.preventDefault();
    void dispatchPrompt(undefined, true);
  }

  const composerStatus = statusMessage !== "Ready." ? statusMessage : null;
  return (
    <div className="parallel-ai-app relative h-full overflow-hidden">
      <PanelWorkspace
        googleMode={settings.googleProviderMode}
        horizontalPanelGroupRefs={horizontalPanelGroupRefs}
        layout={layout}
        loadingProviders={loadingProviders}
        mainCanvasRef={mainCanvasRef}
        onBeginPanelDrag={beginPanelDrag}
        onRefreshProvider={refreshProvider}
        onRegisterFrameHost={registerFrameHost}
        onRemovePanel={removePanel}
        onResetHorizontalPanelLayout={resetHorizontalPanelLayout}
        onResetVerticalPanelLayout={resetVerticalPanelLayout}
        onSwitchPanelProvider={switchPanelProvider}
        panelDragSourceIndex={panelDragSourceIndex}
        panelDragTargetIndex={panelDragTargetIndex}
        panelSlotRefs={panelSlotRefs}
        providerOptions={providers}
        slotProviders={slotProviders}
        temporaryChatEnabled={temporaryChatEnabled}
        verticalPanelGroupRef={verticalPanelGroupRef}
      />
      <div className="pointer-events-none absolute inset-0 z-20">
        <ConnectorOverlay
          maskId={CONNECTOR_MASK_ID}
          occluders={connectorOccluderModels}
          paths={connectorPathModels}
        />

        <FloatingComposer
          attachments={attachments}
          composerDragging={composerDragging}
          composerHeight={composerHeight}
          composerInputRef={composerInputRef}
          composerOffset={composerOffset}
          composerRef={composerRef}
          composerShellRef={composerShellRef}
          composerStatus={composerStatus}
          composerWidth={composerWidth}
          hasDraftContent={hasDraftContent}
          onAddPanel={addPanel}
          onBeginComposerDrag={beginComposerDrag}
          onBeginComposerDragFromHeader={beginComposerDragFromHeader}
          onBeginComposerResize={beginComposerResize}
          onClearPanels={clearPanels}
          onDispatchPrompt={dispatchPrompt}
          onDrop={handleComposerDrop}
          onFilesSelected={handleFilesSelected}
          onKeyDown={handleComposerKeyDown}
          onOpenLayoutModal={() => setLayoutModalOpen(true)}
          onOpenNewChats={openNewChatEverywhere}
          onOpenPromptLibrary={() => setPromptLibraryOpen(true)}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onPaste={handleComposerPaste}
          onPromptChange={setPrompt}
          onRemoveAttachment={(attachmentId) =>
            setAttachments((current) => current.filter((item) => item.id !== attachmentId))
          }
          onResetComposerPosition={resetComposerPosition}
          onResetComposerSize={resetComposerSize}
          onToggleScrollSync={toggleScrollSync}
          onToggleTemporaryChat={toggleTemporaryChat}
          prompt={prompt}
          promptLibraryOpen={promptLibraryOpen}
          scrollSyncEnabled={settings.scrollSyncEnabled}
          temporaryChatEnabled={temporaryChatEnabled}
        />
      </div>

      <LayoutModal
        currentLayout={layout}
        onClose={() => setLayoutModalOpen(false)}
        onSelectLayout={(nextLayout) => {
          setLayout(nextLayout);
          setPanelProviders((current) =>
            resizePanelProviders(current, settings.enabledProviders, nextLayout),
          );
          setLayoutModalOpen(false);
        }}
        open={layoutModalOpen}
      />

      <SettingsModal
        assetUrl={runtimeAsset}
        checking={checking}
        onClearDraft={() => {
          setPrompt("");
          setAttachments([]);
          showStatus("Workspace draft cleared.");
        }}
        onClearPromptLibrary={handleClearPromptLibrary}
        onClose={() => setSettingsModalOpen(false)}
        onExportPromptLibrary={handleExportPromptLibrary}
        onExportSettings={handleExportSettings}
        onExportWorkspaceData={handleExportWorkspaceData}
        onImportDefaultPromptLibrary={handleImportDefaultPromptLibrary}
        onImportPromptFile={handleImportPromptFile}
        onImportSettingsFile={handleImportSettingsFile}
        onMoveProvider={moveProvider}
        onOpenPromptLibrary={() => setPromptLibraryOpen(true)}
        onResetAllSettings={resetAllSettings}
        onRunVersionCheck={runCheck}
        onSetGoogleMode={setGoogleMode}
        onSettingsTabChange={setSettingsTab}
        onToggleProvider={toggleProvider}
        onUpdateSetting={updateSetting}
        open={settingsModalOpen}
        promptCount={promptLibraryItems.length}
        providers={providers}
        settings={settings}
        settingsTab={settingsTab}
        supportedLanguages={supportedLanguages}
        updateStatus={updateStatus}
        versionInfo={versionInfo}
      />
      <PromptLibraryModal
        categories={promptCategories}
        currentFilter={promptLibraryFilter}
        onCategoryChange={setPromptLibraryCategory}
        onClose={() => setPromptLibraryOpen(false)}
        onCreate={() => openPromptEditor()}
        onDelete={(promptRecord) => void handleDeletePrompt(promptRecord)}
        onEdit={(promptRecord) => openPromptEditor(promptRecord)}
        onExport={() => void handleExportPromptLibrary()}
        onFilterChange={setPromptLibraryFilter}
        onImportDefaults={() => void handleImportDefaultPromptLibrary()}
        onImportFile={(file) => void handleImportPromptFile(file)}
        onSearchChange={setPromptLibrarySearch}
        onToggleFavorite={(promptRecord) => void handleToggleFavorite(promptRecord)}
        onUse={(promptRecord) => void handleUsePrompt(promptRecord)}
        open={promptLibraryOpen}
        prompts={filteredPromptLibraryItems}
        searchQuery={promptLibrarySearch}
        selectedCategory={promptLibraryCategory}
      />

      <PromptEditorModal
        draft={promptEditorState}
        onChange={(updates) =>
          setPromptEditorState((current) => ({
            ...current,
            ...updates,
          }))
        }
        onClose={closePromptEditor}
        onSave={() => void handleSavePromptEditor()}
        open={promptEditorOpen}
      />

      <VariableInputModal
        onApply={() => void handleApplyPromptVariables()}
        onChange={(variable, value) =>
          setVariableValues((current) => ({
            ...current,
            [variable]: value,
          }))
        }
        onClose={() => {
          setVariablePrompt(null);
          setVariableValues({});
        }}
        open={Boolean(variablePrompt)}
        prompt={variablePrompt}
        values={variableValues}
      />
    </div>
  );
}
