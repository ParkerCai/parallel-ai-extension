import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpenText,
  ChevronDown,
  Download,
  Eraser,
  LayoutGrid,
  LoaderCircle,
  MoonStar,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Sparkles,
  SunMedium,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type GroupImperativeHandle,
} from "react-resizable-panels";

import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { Select } from "@/shared/components/Select";
import { SettingItem } from "@/shared/components/SettingItem";
import { Switch } from "@/shared/components/Switch";
import {
  PromptEditorModal,
  PromptLibraryModal,
  VariableInputModal,
  editorStateToPromptDraft,
  promptToEditorState,
  type PromptListFilter,
} from "@/multi-panel/components/PromptLibraryModal";
import { useVersionCheck } from "@/multi-panel/hooks/useVersionCheck";
import {
  DEFAULT_PANEL_PROVIDERS,
  GOOGLE_PROVIDER_MODE_SEARCH,
  NORMAL_URLS,
  PENDING_MULTI_PANEL_ACTION_KEY,
  TEMP_CHAT_SUPPORTED_PROVIDERS,
  TEMP_CHAT_URLS,
} from "@/shared/lib/constants";
import {
  ALL_LAYOUTS,
  DEFAULT_LAYOUT,
  getBestLayoutForPanelCount,
  getLayoutCellCount,
  LAYOUTS,
  type LayoutId,
} from "@/shared/lib/layouts";
import {
  ALL_PROVIDER_IDS,
  getProviderById,
  type Provider,
  type ProviderId,
} from "@/shared/lib/providers";
import { useProviderContext } from "@/shared/contexts/ProviderContext";
import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import { useI18n } from "@/shared/hooks/useI18n";
import {
  clearAllPrompts,
  exportPrompts,
  getAllPrompts,
  importDefaultLibrary,
  importPrompts,
  recordPromptUsage,
  savePrompt,
  toggleFavorite,
  updatePrompt,
  deletePrompt,
  type PromptRecord,
} from "@/shared/lib/prompt-manager";
import {
  DEFAULT_COMPOSER_SIZE,
  exportSettings,
  importSettings,
  type ComposerSize,
} from "@/shared/lib/settings";

interface QueuedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

interface PendingAction {
  action: string;
  payload?: {
    selectedText?: string;
  };
}

interface WorkspaceExportPayload {
  exportedAt: string;
  prompts: Awaited<ReturnType<typeof exportPrompts>>;
  settings: Awaited<ReturnType<typeof exportSettings>>;
  version: string;
}

type ComposerResizeEdge = "top" | "right" | "bottom" | "left";
type ConnectorPhase = "idle" | "filling" | "submitting" | "settled";

interface ConnectorPoint {
  x: number;
  y: number;
}

interface PanelInputAnchor {
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
  x: number;
  y: number;
  source: "reported" | "fallback";
  updatedAt: number;
}

interface ConnectorLineState {
  autoSubmit: boolean;
  lastUpdatedAt: number;
  phase: ConnectorPhase;
  pulseKey: number;
  requestId: string | null;
}

interface ConnectorPathModel {
  path: string;
  phase: ConnectorPhase;
  providerId: ProviderId;
  pulseKey: number;
}

interface ConnectorOccluderModel {
  height: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}

const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = "multi-panel-provider-status";
const PARALLEL_AI_PROVIDER_BUSY = "PARALLEL_AI_PROVIDER_BUSY";
const PARALLEL_AI_PROVIDER_IDLE = "PARALLEL_AI_PROVIDER_IDLE";
const PARALLEL_AI_PROVIDER_INPUT_ANCHOR = "PARALLEL_AI_PROVIDER_INPUT_ANCHOR";
const PARALLEL_AI_PROVIDER_USER_INTERACTION = "PARALLEL_AI_PROVIDER_USER_INTERACTION";
const CONNECTOR_DRAFT_SEPARATOR = "\u0001";
const CONNECTOR_FILL_DURATION_MS = 1150;
const CONNECTOR_SEND_FALLBACK_SETTLE_MS = 2200;
const CONNECTOR_SOURCE_OVERDRAW_PX = 10;
const CONNECTOR_TARGET_OVERDRAW_PX = 4;
const CONNECTOR_OCCLUDER_PADDING_PX = 0;
const CONNECTOR_MASK_ID = "composer-connector-mask";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function runtimeAsset(path: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }

  return `/${path}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRowPanelId(layoutId: LayoutId, rowIndex: number) {
  return `row-${layoutId}-${rowIndex}`;
}

function getColumnPanelId(layoutId: LayoutId, rowIndex: number, columnIndex: number) {
  return `column-${layoutId}-${rowIndex}-${columnIndex}`;
}

function buildEqualGroupLayout(panelIds: string[]) {
  if (!panelIds.length) {
    return {};
  }

  const evenShare = Math.floor((100 / panelIds.length) * 1000) / 1000;
  const layout = Object.fromEntries(
    panelIds.map((panelId, index) => [
      panelId,
      index === panelIds.length - 1 ? 100 - evenShare * (panelIds.length - 1) : evenShare,
    ]),
  );

  return layout;
}

function buildDraftFingerprint(promptText: string, files: QueuedFile[]) {
  return [promptText.trim(), ...files.map((file) => `${file.id}:${file.name}:${file.size}`)].join(
    CONNECTOR_DRAFT_SEPARATOR,
  );
}

function getRectEdgePoint(rect: DOMRect, target: ConnectorPoint): ConnectorPoint {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = target.x - centerX;
  const dy = target.y - centerY;

  if (dx === 0 && dy === 0) {
    return { x: centerX, y: centerY };
  }

  const halfWidth = Math.max(rect.width / 2, 1);
  const halfHeight = Math.max(rect.height / 2, 1);
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
  const boundedScale = Number.isFinite(scale) ? Math.min(scale, 1) : 1;

  return {
    x: centerX + dx * boundedScale,
    y: centerY + dy * boundedScale,
  };
}

function getFallbackPanelAnchor(panelRect: DOMRect): ConnectorPoint {
  return {
    x: panelRect.left + panelRect.width / 2,
    y: panelRect.bottom - clamp(panelRect.height * 0.1, 52, 92),
  };
}

function buildConnectorPath(source: ConnectorPoint, target: ConnectorPoint) {
  return `M ${source.x.toFixed(2)} ${source.y.toFixed(2)} L ${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
}

function movePointToward(source: ConnectorPoint, target: ConnectorPoint, distance: number) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const totalDistance = Math.hypot(dx, dy);

  if (!totalDistance || distance === 0) {
    return source;
  }

  const ratio = Math.min(1, distance / totalDistance);
  return {
    x: source.x + dx * ratio,
    y: source.y + dy * ratio,
  };
}

function triggerJsonDownload(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function parseJsonFile<T>(file: File) {
  return new Promise<T>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as T);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function toUniqueProviderList(providerIds: ProviderId[]) {
  return [...new Set(providerIds)];
}

function getPanelUrl(
  provider: Provider,
  googleMode: "ai" | "search",
  temporaryChatEnabled: boolean,
) {
  if (provider.id === "google") {
    return googleMode === GOOGLE_PROVIDER_MODE_SEARCH
      ? "https://www.google.com/search"
      : "https://www.google.com/search?udm=50";
  }

  if (temporaryChatEnabled && TEMP_CHAT_SUPPORTED_PROVIDERS.has(provider.id)) {
    return TEMP_CHAT_URLS[provider.id] ?? provider.url;
  }

  return NORMAL_URLS[provider.id] ?? provider.url;
}

function resizePanelProviders(
  currentProviders: ProviderId[],
  enabledProviderIds: ProviderId[],
  layoutId: LayoutId,
) {
  const nextProviders = toUniqueProviderList(
    currentProviders.filter((providerId) => enabledProviderIds.includes(providerId)),
  );
  const cellCount = getLayoutCellCount(layoutId);
  const desiredCount = Math.min(cellCount, enabledProviderIds.length);

  for (const providerId of enabledProviderIds) {
    if (nextProviders.length >= desiredCount) {
      break;
    }

    if (!nextProviders.includes(providerId)) {
      nextProviders.push(providerId);
    }
  }

  return nextProviders.slice(0, desiredCount || DEFAULT_PANEL_PROVIDERS.length);
}

function LayoutPreview({ layoutId }: { layoutId: LayoutId }) {
  const rows = LAYOUTS[layoutId].rows;
  return (
    <div className="grid h-16 w-full gap-1 rounded-2xl bg-white/6 p-2">
      {rows.map((columns, rowIndex) => (
        <div
          key={`${layoutId}-${rowIndex}`}
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <span
              key={`${layoutId}-${rowIndex}-${columnIndex}`}
              className="rounded-lg bg-white/14"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface PanelFrameProps {
  dragState: "idle" | "source" | "target";
  iframeKey: string;
  loading: boolean;
  onBeginReorder: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onIframeLoad: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  onSwitchProvider: (providerId: ProviderId) => void;
  provider: Provider;
  providerOptions: Provider[];
  registerFrame: (element: HTMLIFrameElement | null) => void;
  src: string;
}

function PanelFrame({
  dragState,
  iframeKey,
  loading,
  onBeginReorder,
  onIframeLoad,
  onRefresh,
  onRemove,
  onSwitchProvider,
  provider,
  providerOptions,
  registerFrame,
  src,
}: PanelFrameProps) {
  return (
    <div
      className={`relative h-full min-h-[280px] overflow-hidden bg-[rgba(13,16,24,0.98)] transition-[opacity,transform,box-shadow] duration-150 ${
        dragState === "source" ? "scale-[0.994] opacity-72" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-4">
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-[rgba(11,14,22,0.72)] px-1.25 py-1.25 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <button
            aria-label={`Drag ${provider.name} panel to reorder`}
            className={`inline-flex h-6 min-w-[22px] items-center justify-center rounded-full bg-white/8 px-1.5 text-white/70 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-white ${
              dragState === "source" ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={onBeginReorder}
            title="Drag to swap this panel with another."
            type="button"
          >
            <span className="grid grid-cols-3 place-items-center gap-x-1 gap-y-0.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  key={index}
                  className="h-[2px] w-[2px] rounded-full bg-current opacity-85"
                />
              ))}
            </span>
          </button>

          <div className="relative">
            <select
              aria-label={`Switch ${provider.name} provider`}
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => onSwitchProvider(event.target.value as ProviderId)}
              value={provider.id}
            >
              {providerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition hover:bg-white/14">
              <ChevronDown size={13} />
            </span>
          </div>

          <button
            aria-label={`Refresh ${provider.name}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-white"
            onClick={onRefresh}
            type="button"
          >
            <RefreshCcw size={12} />
          </button>

          <button
            aria-label={`Close ${provider.name}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/88 ring-1 ring-white/10 transition hover:bg-[hsl(var(--danger))]/22 hover:text-[hsl(var(--danger-text))]"
            onClick={onRemove}
            type="button"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {dragState === "target" ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-[11] bg-[rgba(186,230,253,0.12)]" />
          <div className="pointer-events-none absolute inset-0 z-[12] bg-[linear-gradient(180deg,rgba(224,242,254,0.2),rgba(125,211,252,0.08))] shadow-[inset_0_0_0_1px_rgba(224,242,254,0.52),inset_0_0_0_2px_rgba(125,211,252,0.28),inset_0_0_48px_rgba(186,230,253,0.12)]" />
        </>
      ) : null}

      <div className="relative h-full min-h-0">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--panel))]/80 backdrop-blur-sm">
            <div className="space-y-3 text-center">
              <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-white/10" />
              <p className="text-sm text-[hsl(var(--foreground-muted))]">
                Spinning up {provider.name}
              </p>
            </div>
          </div>
        ) : null}
        <iframe
          key={iframeKey}
          className="h-full w-full bg-white"
          onLoad={onIframeLoad}
          ref={registerFrame}
          src={src}
          title={provider.name}
        />
      </div>
    </div>
  );
}

function EmptyPanelSlot() {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center border border-dashed border-white/8 bg-[rgba(13,16,24,0.98)]">
      <div className="max-w-[240px] text-center">
        <p className="text-sm font-semibold text-white">Empty slot</p>
        <p className="mt-2 text-sm text-[hsl(var(--foreground-muted))]">
          Enable another provider or switch to a denser layout to fill this space.
        </p>
      </div>
    </div>
  );
}

export function App() {
  const { enabledProviders, moveProvider, providers, setGoogleMode, toggleProvider } =
    useProviderContext();
  const { loaded, resetAllSettings, settings, updateSetting, updateSettings } = useSettingsContext();
  const { checking, runCheck, updateStatus, versionInfo } = useVersionCheck();
  const { supportedLanguages } = useI18n(settings.language);

  const [isHydrated, setIsHydrated] = useState(false);
  const [layout, setLayout] = useState<LayoutId>(DEFAULT_LAYOUT);
  const [panelProviders, setPanelProviders] = useState<ProviderId[]>(DEFAULT_PANEL_PROVIDERS);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<QueuedFile[]>([]);
  const [layoutModalOpen, setLayoutModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const [promptLibraryFilter, setPromptLibraryFilter] = useState<PromptListFilter>("recent");
  const [promptLibrarySearch, setPromptLibrarySearch] = useState("");
  const [promptLibraryCategory, setPromptLibraryCategory] = useState("");
  const [promptLibraryItems, setPromptLibraryItems] = useState<PromptRecord[]>([]);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptEditorState, setPromptEditorState] = useState(promptToEditorState());
  const [variablePrompt, setVariablePrompt] = useState<PromptRecord | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [loadingProviders, setLoadingProviders] = useState<Record<string, boolean>>({});
  const [panelInputAnchors, setPanelInputAnchors] = useState<Record<string, PanelInputAnchor>>({});
  const [connectorStates, setConnectorStates] = useState<Record<string, ConnectorLineState>>({});
  const [connectorLayoutVersion, setConnectorLayoutVersion] = useState(0);
  const [temporaryChatEnabled, setTemporaryChatEnabled] = useState(false);
  const [composerOffset, setComposerOffset] = useState(settings.composerOffset);
  const [composerSize, setComposerSize] = useState(settings.composerSize);
  const [composerDragging, setComposerDragging] = useState(false);
  const [composerResizing, setComposerResizing] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    "appearance" | "providers" | "keyboard" | "library" | "data" | "about"
  >("appearance");
  const [refreshByProvider, setRefreshByProvider] = useState<Record<string, number>>({});

  const statusTimeoutRef = useRef<number | null>(null);
  const frameRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const verticalPanelGroupRef = useRef<GroupImperativeHandle | null>(null);
  const horizontalPanelGroupRefs = useRef<Record<number, GroupImperativeHandle | null>>({});
  const composerOffsetRef = useRef(settings.composerOffset);
  const composerSizeRef = useRef(settings.composerSize);
  const panelSlotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const composerDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const composerResizeRef = useRef<{
    edge: ComposerResizeEdge;
    handle: HTMLElement;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const panelDragRef = useRef<{
    handle: HTMLButtonElement;
    pointerId: number;
    sourceIndex: number;
  } | null>(null);
  const panelDragTargetRef = useRef<number | null>(null);
  const previousPanelProvidersRef = useRef<ProviderId[]>(panelProviders);
  const connectorDraftWhitelistRef = useRef<Set<string>>(new Set([buildDraftFingerprint("", [])]));
  const connectorPulseKeyRef = useRef(0);
  const connectorLayoutRafRef = useRef<number | null>(null);
  const connectorSettleTimeoutsRef = useRef<Record<string, number>>({});
  const [panelDragSourceIndex, setPanelDragSourceIndex] = useState<number | null>(null);
  const [panelDragTargetIndex, setPanelDragTargetIndex] = useState<number | null>(null);

  function showStatus(message: string) {
    setStatusMessage(message);

    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }

    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage("Ready.");
    }, 3200);
  }

  function clearConnectorSettleTimeout(providerId: ProviderId) {
    const timeoutId = connectorSettleTimeoutsRef.current[providerId];
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      delete connectorSettleTimeoutsRef.current[providerId];
    }
  }

  function scheduleConnectorSettle(
    providerIds: ProviderId[],
    requestId: string | null,
    delay: number,
  ) {
    for (const providerId of providerIds) {
      clearConnectorSettleTimeout(providerId);
      connectorSettleTimeoutsRef.current[providerId] = window.setTimeout(() => {
        setConnectorStates((current) => {
          const nextState = current[providerId];
          if (!nextState || nextState.requestId !== requestId) {
            return current;
          }

          if (nextState.phase === "settled") {
            return current;
          }

          return {
            ...current,
            [providerId]: {
              ...nextState,
              phase: "settled",
              lastUpdatedAt: Date.now(),
            },
          };
        });
      }, delay);
    }
  }

  function resetConnectorVisuals() {
    Object.keys(connectorSettleTimeoutsRef.current).forEach((providerId) =>
      clearConnectorSettleTimeout(providerId as ProviderId),
    );
    setConnectorStates({});
  }

  function queueConnectorLayoutRefresh() {
    if (connectorLayoutRafRef.current !== null) {
      return;
    }

    connectorLayoutRafRef.current = window.requestAnimationFrame(() => {
      connectorLayoutRafRef.current = null;
      setConnectorLayoutVersion((current) => current + 1);
    });
  }

  function updateConnectorPhase(
    providerId: ProviderId,
    requestId: string | null,
    phase: ConnectorPhase,
  ) {
    if (phase === "settled") {
      clearConnectorSettleTimeout(providerId);
    }

    if (phase === "submitting") {
      clearConnectorSettleTimeout(providerId);
    }

    setConnectorStates((current) => {
      const nextState = current[providerId];
      if (!nextState) {
        return current;
      }

      if (requestId && nextState.requestId && nextState.requestId !== requestId) {
        return current;
      }

      if (nextState.phase === phase) {
        return current;
      }

      return {
        ...current,
        [providerId]: {
          ...nextState,
          phase,
          lastUpdatedAt: Date.now(),
        },
      };
    });
  }

  function armConnectorDispatch(providerIds: ProviderId[], requestId: string | null, autoSubmit: boolean) {
    if (!providerIds.length) {
      return;
    }

    connectorPulseKeyRef.current += 1;
    const pulseKey = connectorPulseKeyRef.current;
    const nextPhase: ConnectorPhase = autoSubmit ? "submitting" : "filling";
    const timestamp = Date.now();

    setConnectorStates((current) => {
      const nextState = { ...current };
      for (const providerId of providerIds) {
        clearConnectorSettleTimeout(providerId);
        nextState[providerId] = {
          autoSubmit,
          lastUpdatedAt: timestamp,
          phase: nextPhase,
          pulseKey,
          requestId,
        };
      }
      return nextState;
    });

    scheduleConnectorSettle(
      providerIds,
      requestId,
      autoSubmit ? CONNECTOR_SEND_FALLBACK_SETTLE_MS : CONNECTOR_FILL_DURATION_MS,
    );
  }

  useEffect(() => {
    if (!loaded || isHydrated) {
      return;
    }

    setLayout(settings.currentLayout);
    setPanelProviders(
      resizePanelProviders(settings.panelProviders, settings.enabledProviders, settings.currentLayout),
    );
    setComposerOffset(settings.composerOffset);
    setComposerSize(settings.composerSize);
    setIsHydrated(true);
  }, [
    isHydrated,
    loaded,
    settings.composerSize,
    settings.currentLayout,
    settings.enabledProviders,
    settings.panelProviders,
  ]);

  useEffect(() => {
    composerOffsetRef.current = composerOffset;
  }, [composerOffset]);

  useEffect(() => {
    composerSizeRef.current = composerSize;
  }, [composerSize]);

  useEffect(() => {
    Object.keys(connectorSettleTimeoutsRef.current).forEach((providerId) => {
      if (!panelProviders.includes(providerId as ProviderId)) {
        clearConnectorSettleTimeout(providerId as ProviderId);
      }
    });

    setPanelInputAnchors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([providerId]) =>
          panelProviders.includes(providerId as ProviderId),
        ),
      ) as Record<string, PanelInputAnchor>,
    );
    setConnectorStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([providerId]) =>
          panelProviders.includes(providerId as ProviderId),
        ),
      ) as Record<string, ConnectorLineState>,
    );
  }, [panelProviders]);

  useEffect(() => {
    const draftFingerprint = buildDraftFingerprint(prompt, attachments);
    if (connectorDraftWhitelistRef.current.has(draftFingerprint)) {
      return;
    }

    if (!Object.keys(connectorStates).length) {
      return;
    }

    resetConnectorVisuals();
  }, [attachments, connectorStates, prompt]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const nextPanels = resizePanelProviders(panelProviders, settings.enabledProviders, layout);

    if (nextPanels.join("|") !== panelProviders.join("|")) {
      setPanelProviders(nextPanels);
    }
  }, [isHydrated, layout, panelProviders, settings.enabledProviders]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void updateSetting("currentLayout", layout);
  }, [isHydrated, layout]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void updateSetting("panelProviders", panelProviders);
  }, [isHydrated, panelProviders]);

  useEffect(() => {
    if (!isHydrated) {
      previousPanelProvidersRef.current = panelProviders;
      return;
    }

    const previousPanels = previousPanelProvidersRef.current;
    const changedProviders = new Set<ProviderId>();
    const activeProviders = new Set(panelProviders);
    const maxLength = Math.max(previousPanels.length, panelProviders.length);

    for (let index = 0; index < maxLength; index += 1) {
      const previousProviderId = previousPanels[index];
      const nextProviderId = panelProviders[index];

      if (previousProviderId === nextProviderId) {
        continue;
      }

      if (previousProviderId && activeProviders.has(previousProviderId)) {
        changedProviders.add(previousProviderId);
      }

      if (nextProviderId) {
        changedProviders.add(nextProviderId);
      }
    }

    setLoadingProviders((current) => {
      const nextState = Object.fromEntries(
        Object.entries(current).filter(([providerId]) =>
          activeProviders.has(providerId as ProviderId),
        ),
      ) as Record<string, boolean>;

      changedProviders.forEach((providerId) => {
        nextState[providerId] = true;
      });

      return nextState;
    });

    previousPanelProvidersRef.current = panelProviders;
  }, [isHydrated, panelProviders]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setLoadingProviders((current) => ({
      ...current,
      ...Object.fromEntries(panelProviders.map((providerId) => [providerId, true])),
    }));
  }, [isHydrated, temporaryChatEnabled, settings.googleProviderMode]);

  useEffect(() => {
    if (!isHydrated || !panelProviders.length) {
      return;
    }

    const timerId = window.setTimeout(() => {
      panelProviders.forEach((providerId) => requestProviderInputAnchor(providerId));
    }, 360);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isHydrated, layout, panelProviders, refreshByProvider, settings.googleProviderMode, temporaryChatEnabled]);

  useEffect(() => {
    function handlePanelMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") {
        return;
      }

      if (event.data.context === MULTI_PANEL_PROVIDER_STATUS_CONTEXT) {
        const providerId = event.data.provider as ProviderId | undefined;
        if (!providerId || !panelProviders.includes(providerId)) {
          return;
        }

        const providerFrame = frameRefs.current[providerId];
        if (providerFrame?.contentWindow && event.source && providerFrame.contentWindow !== event.source) {
          return;
        }

        if (event.data.type === PARALLEL_AI_PROVIDER_INPUT_ANCHOR) {
          const anchor =
            event.data.anchor &&
            typeof event.data.anchor.x === "number" &&
            typeof event.data.anchor.y === "number" &&
            typeof event.data.anchor.left === "number" &&
            typeof event.data.anchor.top === "number" &&
            typeof event.data.anchor.width === "number" &&
            typeof event.data.anchor.height === "number" &&
            typeof event.data.anchor.radius === "number"
              ? {
                  height: event.data.anchor.height,
                  left: event.data.anchor.left,
                  radius: event.data.anchor.radius,
                  top: event.data.anchor.top,
                  width: event.data.anchor.width,
                  x: event.data.anchor.x,
                  y: event.data.anchor.y,
                }
              : null;

          if (!anchor) {
            return;
          }

          setPanelInputAnchors((current) => ({
            ...current,
            [providerId]: {
              source: "reported",
              updatedAt: Date.now(),
              height: anchor.height,
              left: anchor.left,
              radius: anchor.radius,
              top: anchor.top,
              width: anchor.width,
              x: anchor.x,
              y: anchor.y,
            },
          }));
          queueConnectorLayoutRefresh();
          return;
        }

        if (event.data.type === PARALLEL_AI_PROVIDER_BUSY) {
          updateConnectorPhase(providerId, event.data.requestId ?? null, "submitting");
          return;
        }

        if (
          event.data.type === PARALLEL_AI_PROVIDER_IDLE ||
          event.data.type === PARALLEL_AI_PROVIDER_USER_INTERACTION
        ) {
          updateConnectorPhase(providerId, event.data.requestId ?? null, "settled");
        }

        return;
      }

      if (!settings.scrollSyncEnabled || event.data.context !== "multi-panel") {
        return;
      }

      if (event.data.type !== "PANEL_SCROLL_PROGRESS") {
        return;
      }

      const sourceProviderId = panelProviders.find(
        (providerId) => frameRefs.current[providerId]?.contentWindow === event.source,
      );

      if (!sourceProviderId) {
        return;
      }

      for (const providerId of panelProviders) {
        if (providerId === sourceProviderId) {
          continue;
        }

        frameRefs.current[providerId]?.contentWindow?.postMessage(
          {
            type: "SYNC_SCROLL",
            context: "multi-panel",
            progress: event.data.progress,
          },
          "*",
        );
      }
    }

    window.addEventListener("message", handlePanelMessage);

    return () => {
      window.removeEventListener("message", handlePanelMessage);
    };
  }, [panelProviders, settings.scrollSyncEnabled]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let cancelled = false;

    async function consumePendingAction() {
      const pendingAction = await readPendingAction();
      if (cancelled || !pendingAction) {
        return;
      }

      await clearPendingAction();

      if (pendingAction.action === "openPromptLibrary") {
        setPromptLibraryOpen(true);
        showStatus("Prompt library opened.");
        return;
      }

      if (pendingAction.action === "sendToPanel" && pendingAction.payload?.selectedText) {
        const nextPrompt = pendingAction.payload.selectedText;
        setPrompt(nextPrompt);
        showStatus("Selected text imported. Sending to panels...");
        window.setTimeout(() => {
          void dispatchPrompt(nextPrompt, true);
        }, 1200);
      }
    }

    void consumePendingAction();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, panelProviders]);

  async function readPendingAction(): Promise<PendingAction | null> {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return null;
    }

    try {
      const result = await chrome.storage.session.get(PENDING_MULTI_PANEL_ACTION_KEY);
      if (result[PENDING_MULTI_PANEL_ACTION_KEY]) {
        return result[PENDING_MULTI_PANEL_ACTION_KEY] as PendingAction;
      }
    } catch {
      // fall back to local storage
    }

    try {
      const result = await chrome.storage.local.get(PENDING_MULTI_PANEL_ACTION_KEY);
      return (result[PENDING_MULTI_PANEL_ACTION_KEY] as PendingAction | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async function clearPendingAction() {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return;
    }

    try {
      await chrome.storage.session.remove(PENDING_MULTI_PANEL_ACTION_KEY);
    } catch {
      // ignore
    }

    try {
      await chrome.storage.local.remove(PENDING_MULTI_PANEL_ACTION_KEY);
    } catch {
      // ignore
    }
  }

  async function loadPromptLibrary() {
    try {
      setPromptLibraryItems(await getAllPrompts());
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Failed to load prompt library.",
      );
    }
  }

  useEffect(() => {
    if (!loaded) {
      return;
    }

    void loadPromptLibrary();
  }, [loaded]);

  useEffect(() => {
    if (!isHydrated || composerDragging || composerResizing) {
      return;
    }

    setComposerOffset(settings.composerOffset);
  }, [composerDragging, composerResizing, isHydrated, settings.composerOffset]);

  useEffect(() => {
    if (!isHydrated || composerResizing) {
      return;
    }

    setComposerSize(settings.composerSize);
  }, [composerResizing, isHydrated, settings.composerSize]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleComposerPointerMove);
      window.removeEventListener("pointerup", handleComposerPointerUp);
      window.removeEventListener("pointercancel", handleComposerPointerUp);
      window.removeEventListener("pointermove", handleComposerResizePointerMove);
      window.removeEventListener("pointerup", handleComposerResizePointerUp);
      window.removeEventListener("pointercancel", handleComposerResizePointerUp);
      window.removeEventListener("blur", handleComposerResizeCancel);
      window.removeEventListener("pointermove", handlePanelDragPointerMove);
      window.removeEventListener("pointerup", handlePanelDragPointerUp);
      window.removeEventListener("pointercancel", handlePanelDragPointerUp);
      window.removeEventListener("blur", handlePanelDragCancel);
      if (connectorLayoutRafRef.current !== null) {
        window.cancelAnimationFrame(connectorLayoutRafRef.current);
      }
      Object.keys(connectorSettleTimeoutsRef.current).forEach((providerId) =>
        clearConnectorSettleTimeout(providerId as ProviderId),
      );
    };
  }, []);

  useEffect(() => {
    if (!composerRef.current && !composerShellRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      queueConnectorLayoutRefresh();
    });

    if (composerShellRef.current) {
      resizeObserver.observe(composerShellRef.current);
    }

    if (composerRef.current) {
      resizeObserver.observe(composerRef.current);
    }

    Object.values(panelSlotRefs.current).forEach((element) => {
      if (element) {
        resizeObserver.observe(element);
      }
    });

    window.addEventListener("resize", queueConnectorLayoutRefresh);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", queueConnectorLayoutRefresh);
    };
  }, [layout, panelProviders]);

  function registerFrame(providerId: ProviderId, element: HTMLIFrameElement | null) {
    frameRefs.current[providerId] = element;
  }

  function setHorizontalPanelGroupRef(rowIndex: number, handle: GroupImperativeHandle | null) {
    horizontalPanelGroupRefs.current[rowIndex] = handle;
  }

  function setPanelSlotRef(slotIndex: number, element: HTMLDivElement | null) {
    panelSlotRefs.current[slotIndex] = element;
  }

  function resetVerticalPanelLayout() {
    const rowIds = LAYOUTS[layout].rows.map((_, rowIndex) => getRowPanelId(layout, rowIndex));
    verticalPanelGroupRef.current?.setLayout(buildEqualGroupLayout(rowIds));
  }

  function resetHorizontalPanelLayout(rowIndex: number, columnCount: number) {
    const panelIds = Array.from({ length: columnCount }, (_, columnIndex) =>
      getColumnPanelId(layout, rowIndex, columnIndex),
    );
    horizontalPanelGroupRefs.current[rowIndex]?.setLayout(buildEqualGroupLayout(panelIds));
  }

  function clampComposerSize(nextWidth: number, nextHeight: number): ComposerSize {
    const horizontalMargin = 16;
    const verticalMargin = 20;
    const maxWidth = Math.max(0, window.innerWidth - horizontalMargin * 2);
    const minWidth = Math.min(520, maxWidth || 520);
    const maxHeight = Math.max(0, window.innerHeight - verticalMargin * 2 - 32);
    const minHeight = Math.min(220, maxHeight || 220);

    return {
      width: Math.min(maxWidth, Math.max(minWidth, nextWidth)),
      height: Math.min(maxHeight, Math.max(minHeight, nextHeight)),
    };
  }

  function getComposerWidthStyle(width: number) {
    return `min(${width}px, calc(100vw - 32px))`;
  }

  function getComposerHeightStyle(height: number) {
    return `min(${height}px, calc(100vh - 72px))`;
  }

  function paintComposerFrame(offset: { x: number; y: number }, size: ComposerSize) {
    if (composerShellRef.current) {
      composerShellRef.current.style.transform = `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`;
      composerShellRef.current.style.width = getComposerWidthStyle(size.width);
    }

    if (composerRef.current) {
      composerRef.current.style.height = getComposerHeightStyle(size.height);
    }
  }

  function clampComposerOffset(nextX: number, nextY: number, sizeOverride?: ComposerSize) {
    const nextSize = clampComposerSize(
      sizeOverride?.width ?? composerSizeRef.current.width,
      sizeOverride?.height ?? composerSizeRef.current.height,
    );
    const composerWidth = Math.min(nextSize.width, window.innerWidth - 32);
    const composerHeight = Math.min(nextSize.height, window.innerHeight - 72);
    const horizontalMargin = 16;
    const verticalMargin = 20;

    const maxX = Math.max(0, (window.innerWidth - composerWidth) / 2 - horizontalMargin);
    const minY = -Math.max(0, window.innerHeight - composerHeight - verticalMargin * 2);
    const maxY = 0;

    return {
      x: Math.min(maxX, Math.max(-maxX, nextX)),
      y: Math.min(maxY, Math.max(minY, nextY)),
    };
  }

  function handleComposerPointerMove(event: PointerEvent) {
    if (!composerDragRef.current || composerDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const nextOffset = clampComposerOffset(
      composerDragRef.current.startOffsetX + (event.clientX - composerDragRef.current.startClientX),
      composerDragRef.current.startOffsetY + (event.clientY - composerDragRef.current.startClientY),
    );

    composerOffsetRef.current = nextOffset;
    setComposerOffset(nextOffset);
  }

  function handleComposerPointerUp(event: PointerEvent) {
    if (!composerDragRef.current || composerDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    composerDragRef.current = null;
    setComposerDragging(false);
    window.removeEventListener("pointermove", handleComposerPointerMove);
    window.removeEventListener("pointerup", handleComposerPointerUp);
    window.removeEventListener("pointercancel", handleComposerPointerUp);
    void updateSetting("composerOffset", composerOffsetRef.current);
  }

  function handleComposerResizePointerMove(event: PointerEvent) {
    if (!composerResizeRef.current || composerResizeRef.current.pointerId !== event.pointerId) {
      return;
    }

    if ((event.buttons & 1) !== 1) {
      finishComposerResize(true);
      return;
    }

    const activeResize = composerResizeRef.current;
    const deltaX = event.clientX - activeResize.startClientX;
    const deltaY = event.clientY - activeResize.startClientY;
    let nextSize = clampComposerSize(activeResize.startWidth, activeResize.startHeight);
    let nextOffset = clampComposerOffset(
      activeResize.startOffsetX,
      activeResize.startOffsetY,
      nextSize,
    );

    if (activeResize.edge === "left") {
      nextSize = clampComposerSize(activeResize.startWidth - deltaX, activeResize.startHeight);
      const appliedWidthDelta = nextSize.width - activeResize.startWidth;
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX - appliedWidthDelta / 2,
        activeResize.startOffsetY,
        nextSize,
      );
    } else if (activeResize.edge === "right") {
      nextSize = clampComposerSize(activeResize.startWidth + deltaX, activeResize.startHeight);
      const appliedWidthDelta = nextSize.width - activeResize.startWidth;
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX + appliedWidthDelta / 2,
        activeResize.startOffsetY,
        nextSize,
      );
    } else if (activeResize.edge === "top") {
      nextSize = clampComposerSize(activeResize.startWidth, activeResize.startHeight - deltaY);
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX,
        activeResize.startOffsetY,
        nextSize,
      );
    } else {
      nextSize = clampComposerSize(activeResize.startWidth, activeResize.startHeight + deltaY);
      const appliedHeightDelta = nextSize.height - activeResize.startHeight;
      nextOffset = clampComposerOffset(
        activeResize.startOffsetX,
        activeResize.startOffsetY + appliedHeightDelta,
        nextSize,
      );
    }

    composerSizeRef.current = nextSize;
    composerOffsetRef.current = nextOffset;
    paintComposerFrame(nextOffset, nextSize);
  }

  function finishComposerResize(persist: boolean) {
    const activeResize = composerResizeRef.current;
    if (!activeResize) {
      return;
    }

    if (activeResize.handle.hasPointerCapture?.(activeResize.pointerId)) {
      activeResize.handle.releasePointerCapture(activeResize.pointerId);
    }

    setComposerSize(composerSizeRef.current);
    setComposerOffset(composerOffsetRef.current);
    composerResizeRef.current = null;
    setComposerResizing(false);
    window.removeEventListener("pointermove", handleComposerResizePointerMove);
    window.removeEventListener("pointerup", handleComposerResizePointerUp);
    window.removeEventListener("pointercancel", handleComposerResizePointerUp);
    window.removeEventListener("blur", handleComposerResizeCancel);

    if (persist) {
      void updateSettings({
        composerOffset: composerOffsetRef.current,
        composerSize: composerSizeRef.current,
      });
    }
  }

  function handleComposerResizePointerUp(event: PointerEvent) {
    if (!composerResizeRef.current || composerResizeRef.current.pointerId !== event.pointerId) {
      return;
    }

    finishComposerResize(true);
  }

  function handleComposerResizeCancel() {
    finishComposerResize(true);
  }

  function updatePanelDragTarget(clientX: number, clientY: number) {
    const activeDrag = panelDragRef.current;
    if (!activeDrag) {
      return;
    }

    let nextTargetIndex: number | null = null;

    for (const [indexText, element] of Object.entries(panelSlotRefs.current)) {
      const slotIndex = Number(indexText);

      if (!element || slotIndex === activeDrag.sourceIndex || slotIndex >= panelProviders.length) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        nextTargetIndex = slotIndex;
        break;
      }
    }

    panelDragTargetRef.current = nextTargetIndex;
    setPanelDragTargetIndex((current) => (current === nextTargetIndex ? current : nextTargetIndex));
  }

  function finishPanelDrag(commit: boolean) {
    const activeDrag = panelDragRef.current;
    if (!activeDrag) {
      return;
    }

    if (activeDrag.handle.hasPointerCapture?.(activeDrag.pointerId)) {
      activeDrag.handle.releasePointerCapture(activeDrag.pointerId);
    }

    const targetIndex = panelDragTargetRef.current;
    panelDragRef.current = null;
    panelDragTargetRef.current = null;
    setPanelDragSourceIndex(null);
    setPanelDragTargetIndex(null);
    window.removeEventListener("pointermove", handlePanelDragPointerMove);
    window.removeEventListener("pointerup", handlePanelDragPointerUp);
    window.removeEventListener("pointercancel", handlePanelDragPointerUp);
    window.removeEventListener("blur", handlePanelDragCancel);

    if (
      !commit ||
      targetIndex === null ||
      targetIndex === activeDrag.sourceIndex ||
      targetIndex >= panelProviders.length ||
      activeDrag.sourceIndex >= panelProviders.length
    ) {
      return;
    }

    setPanelProviders((current) => {
      if (
        activeDrag.sourceIndex >= current.length ||
        targetIndex >= current.length ||
        activeDrag.sourceIndex === targetIndex
      ) {
        return current;
      }

      const nextPanels = [...current];
      [nextPanels[activeDrag.sourceIndex], nextPanels[targetIndex]] = [
        nextPanels[targetIndex],
        nextPanels[activeDrag.sourceIndex],
      ];
      return nextPanels;
    });
    showStatus("Panels reordered.");
  }

  function handlePanelDragPointerMove(event: PointerEvent) {
    if (!panelDragRef.current || panelDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if ((event.buttons & 1) !== 1) {
      finishPanelDrag(true);
      return;
    }

    event.preventDefault();
    updatePanelDragTarget(event.clientX, event.clientY);
  }

  function handlePanelDragPointerUp(event: PointerEvent) {
    if (!panelDragRef.current || panelDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    finishPanelDrag(true);
  }

  function handlePanelDragCancel() {
    finishPanelDrag(false);
  }

  function beginComposerDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    composerDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: composerOffsetRef.current.x,
      startOffsetY: composerOffsetRef.current.y,
    };
    setComposerDragging(true);
    window.addEventListener("pointermove", handleComposerPointerMove);
    window.addEventListener("pointerup", handleComposerPointerUp);
    window.addEventListener("pointercancel", handleComposerPointerUp);
  }

  function beginComposerDragFromHeader(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("button, input, textarea, select, label, a, [role='button']")
    ) {
      return;
    }

    beginComposerDrag(event);
  }

  function beginComposerResize(edge: ComposerResizeEdge, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture failures
    }
    composerResizeRef.current = {
      edge,
      handle: event.currentTarget,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: composerOffsetRef.current.x,
      startOffsetY: composerOffsetRef.current.y,
      startWidth:
        composerShellRef.current?.offsetWidth ??
        composerRef.current?.offsetWidth ??
        composerSizeRef.current.width,
      startHeight: composerRef.current?.offsetHeight ?? composerSizeRef.current.height,
    };
    setComposerResizing(true);
    window.addEventListener("pointermove", handleComposerResizePointerMove);
    window.addEventListener("pointerup", handleComposerResizePointerUp);
    window.addEventListener("pointercancel", handleComposerResizePointerUp);
    window.addEventListener("blur", handleComposerResizeCancel);
  }

  function beginPanelDrag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || index >= panelProviders.length) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture failures
    }

    panelDragRef.current = {
      handle: event.currentTarget,
      pointerId: event.pointerId,
      sourceIndex: index,
    };
    panelDragTargetRef.current = null;
    setPanelDragSourceIndex(index);
    setPanelDragTargetIndex(null);
    updatePanelDragTarget(event.clientX, event.clientY);
    window.addEventListener("pointermove", handlePanelDragPointerMove);
    window.addEventListener("pointerup", handlePanelDragPointerUp);
    window.addEventListener("pointercancel", handlePanelDragPointerUp);
    window.addEventListener("blur", handlePanelDragCancel);
  }

  function resetComposerPosition() {
    const nextOffset = { x: 0, y: 0 };
    setComposerOffset(nextOffset);
    composerOffsetRef.current = nextOffset;
    void updateSetting("composerOffset", nextOffset);
    showStatus("Composer position reset.");
  }

  function resetComposerSize() {
    const nextSize = clampComposerSize(DEFAULT_COMPOSER_SIZE.width, DEFAULT_COMPOSER_SIZE.height);
    const nextOffset = clampComposerOffset(
      composerOffsetRef.current.x,
      composerOffsetRef.current.y,
      nextSize,
    );
    setComposerSize(nextSize);
    composerSizeRef.current = nextSize;
    setComposerOffset(nextOffset);
    composerOffsetRef.current = nextOffset;
    void updateSettings({
      composerOffset: nextOffset,
      composerSize: nextSize,
    });
    showStatus("Composer size reset.");
  }

  function postToProvider(
    providerId: ProviderId,
    payload: Record<string, unknown>,
  ) {
    frameRefs.current[providerId]?.contentWindow?.postMessage(
      {
        ...payload,
        context: "multi-panel",
        providerMode: settings.googleProviderMode,
      },
      "*",
    );
  }

  function requestProviderInputAnchor(providerId: ProviderId, delay = 0) {
    window.setTimeout(() => {
      postToProvider(providerId, {
        type: "REQUEST_INPUT_ANCHOR",
      });
    }, delay);
  }

  async function dispatchPrompt(promptOverride?: string, autoSubmit = true) {
    const nextPrompt = (promptOverride ?? prompt).trim();
    const hasPrompt = nextPrompt.length > 0;
    const hasFiles = attachments.length > 0;

    if (!hasPrompt && !hasFiles) {
      showStatus("Add a prompt or attachments before sending.");
      return;
    }

    const requestId = `parallel-ai-${Date.now()}`;
    connectorDraftWhitelistRef.current = new Set(
      autoSubmit
        ? [buildDraftFingerprint(nextPrompt, attachments), buildDraftFingerprint("", [])]
        : [buildDraftFingerprint(nextPrompt, attachments)],
    );
    armConnectorDispatch(panelProviders, requestId, autoSubmit);

    if (hasFiles) {
      const filesPayload = attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl,
      }));

      for (const providerId of panelProviders) {
        postToProvider(providerId, {
          type: "INJECT_TEXT_WITH_IMAGES",
          text: nextPrompt,
          images: filesPayload,
          autoSubmit,
          requestId,
        });
      }
    } else if (hasPrompt) {
      for (const providerId of panelProviders) {
        postToProvider(providerId, {
          type: "INJECT_TEXT",
          text: nextPrompt,
          autoSubmit,
          requestId,
        });
      }
    }

    panelProviders.forEach((providerId) =>
      requestProviderInputAnchor(providerId, autoSubmit ? 900 : 300),
    );

    showStatus(autoSubmit ? "Sent to active panels." : "Filled active panels.");

    if (autoSubmit) {
      setPrompt("");
      setAttachments([]);
    }
  }

  function clearPanels() {
    setPrompt("");
    setAttachments([]);
    connectorDraftWhitelistRef.current = new Set([buildDraftFingerprint("", [])]);
    resetConnectorVisuals();

    for (const providerId of panelProviders) {
      postToProvider(providerId, {
        type: "CLEAR_INPUT",
        clearImages: true,
      });
      requestProviderInputAnchor(providerId, 220);
    }

    showStatus("Cleared the unified input and provider drafts.");
  }

  function openNewChatEverywhere() {
    resetConnectorVisuals();
    for (const providerId of panelProviders) {
      postToProvider(providerId, {
        type: "NEW_CHAT",
      });
      requestProviderInputAnchor(providerId, 900);
    }

    showStatus("Requested a new chat in each panel.");
  }

  function toggleTemporaryChat() {
    const nextState = !temporaryChatEnabled;
    setTemporaryChatEnabled(nextState);

    if (nextState) {
      for (const providerId of panelProviders) {
        if (TEMP_CHAT_SUPPORTED_PROVIDERS.has(providerId)) {
          postToProvider(providerId, {
            type: "ENABLE_TEMP_CHAT",
          });
        }
      }
    }

    showStatus(
      nextState
        ? "Temporary chat mode enabled where supported."
        : "Returned supported panels to normal chat URLs.",
    );
  }

  function toggleScrollSync() {
    const nextState = !settings.scrollSyncEnabled;
    void updateSetting("scrollSyncEnabled", nextState);
    showStatus(nextState ? "Scroll sync enabled." : "Scroll sync disabled.");
  }

  function addPanel() {
    const cellCount = getLayoutCellCount(layout);
    const nextProvider = settings.enabledProviders.find(
      (providerId) => !panelProviders.includes(providerId),
    );

    if (!nextProvider) {
      showStatus("No additional enabled providers are available.");
      return;
    }

    const nextCount = panelProviders.length + 1;
    if (panelProviders.length >= cellCount) {
      const nextLayout = getBestLayoutForPanelCount(nextCount, layout);
      if (nextLayout !== layout) {
        setLayout(nextLayout);
      }
    }

    setPanelProviders((current) => [...current, nextProvider]);
    showStatus("Added another provider panel.");
  }

  function removePanel(index: number) {
    if (panelProviders.length <= 1) {
      showStatus("At least one panel needs to stay open.");
      return;
    }

    const nextCount = panelProviders.length - 1;
    const nextLayout = getBestLayoutForPanelCount(nextCount, layout);
    if (nextLayout !== layout) {
      setLayout(nextLayout);
    }

    setPanelProviders((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function switchPanelProvider(index: number, nextProviderId: ProviderId) {
    setPanelProviders((current) => {
      const nextPanels = [...current];
      const existingIndex = nextPanels.indexOf(nextProviderId);

      if (existingIndex !== -1) {
        [nextPanels[index], nextPanels[existingIndex]] = [
          nextPanels[existingIndex],
          nextPanels[index],
        ];
        return nextPanels;
      }

      nextPanels[index] = nextProviderId;
      return nextPanels;
    });
  }

  function refreshProvider(providerId: ProviderId) {
    setRefreshByProvider((current) => ({
      ...current,
      [providerId]: Date.now(),
    }));
    setLoadingProviders((current) => ({
      ...current,
      [providerId]: true,
    }));
  }

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

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
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

  function openPromptEditor(promptRecord?: PromptRecord | null) {
    setPromptEditorState(promptToEditorState(promptRecord));
    setPromptEditorOpen(true);
  }

  async function handleSavePromptEditor() {
    try {
      const nextDraft = editorStateToPromptDraft(promptEditorState);
      if (promptEditorState.id) {
        await updatePrompt(promptEditorState.id, nextDraft);
        showStatus("Prompt updated.");
      } else {
        await savePrompt(nextDraft);
        showStatus("Prompt saved.");
      }

      setPromptEditorOpen(false);
      setPromptEditorState(promptToEditorState());
      await loadPromptLibrary();
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to save prompt.");
    }
  }

  async function handleDeletePrompt(promptRecord: PromptRecord) {
    if (!window.confirm(`Delete "${promptRecord.title}" from your prompt library?`)) {
      return;
    }

    try {
      await deletePrompt(promptRecord.id);
      await loadPromptLibrary();
      showStatus("Prompt deleted.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to delete prompt.");
    }
  }

  async function handleToggleFavorite(promptRecord: PromptRecord) {
    try {
      await toggleFavorite(promptRecord.id);
      await loadPromptLibrary();
      showStatus(
        promptRecord.isFavorite ? "Removed from favorites." : "Added to favorites.",
      );
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to update favorite.");
    }
  }

  async function applyPromptToComposer(promptRecord: PromptRecord, content: string) {
    setPrompt(content);
    await recordPromptUsage(promptRecord.id);
    await loadPromptLibrary();
    setPromptLibraryOpen(false);
    showStatus("Prompt inserted into the unified composer.");
  }

  async function handleUsePrompt(promptRecord: PromptRecord) {
    if (promptRecord.variables.length) {
      setVariablePrompt(promptRecord);
      setVariableValues(
        Object.fromEntries(promptRecord.variables.map((variable) => [variable, ""])),
      );
      return;
    }

    await applyPromptToComposer(promptRecord, promptRecord.content);
  }

  async function handleApplyPromptVariables() {
    if (!variablePrompt) {
      return;
    }

    let content = variablePrompt.content;
    for (const variable of variablePrompt.variables) {
      const value = variableValues[variable] || `{${variable}}`;
      const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      content = content.replace(new RegExp(`\\{${escapedVariable}\\}`, "g"), value);
    }

    setVariablePrompt(null);
    setVariableValues({});
    await applyPromptToComposer(variablePrompt, content);
  }

  async function handleImportDefaultPromptLibrary() {
    try {
      const response = await fetch(runtimeAsset("data/prompt-libraries/default-prompts.json"));
      if (!response.ok) {
        throw new Error("Default prompt library is unavailable.");
      }

      const payload = (await response.json()) as Array<{
        category?: string;
        content: string;
        isFavorite?: boolean;
        tags?: string[];
        title?: string;
        useCount?: number;
        variables?: string[];
      }>;
      const result = await importDefaultLibrary(payload);
      await loadPromptLibrary();
      showStatus(
        `Imported ${result.imported} default prompt${
          result.imported === 1 ? "" : "s"
        }${result.skipped ? `, skipped ${result.skipped}` : ""}.`,
      );
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "Failed to import default prompts.",
      );
    }
  }

  async function handleImportPromptFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const payload = await parseJsonFile<unknown>(file);
      const result = await importPrompts(payload as never);
      await loadPromptLibrary();
      showStatus(
        `Imported ${result.imported} prompt${
          result.imported === 1 ? "" : "s"
        }${result.skipped ? `, skipped ${result.skipped}` : ""}.`,
      );
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to import prompts.");
    }
  }

  async function handleExportPromptLibrary() {
    try {
      triggerJsonDownload("parallel-ai-prompts.json", await exportPrompts());
      showStatus("Prompt library exported.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to export prompts.");
    }
  }

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
        await loadPromptLibrary();
      }

      showStatus(
        `Imported ${result.imported.length} setting${
          result.imported.length === 1 ? "" : "s"
        }.`,
      );
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to import settings.");
    }
  }

  async function handleClearPromptLibrary() {
    if (!window.confirm("Delete every saved prompt in the library?")) {
      return;
    }

    try {
      await clearAllPrompts();
      await loadPromptLibrary();
      showStatus("Prompt library cleared.");
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Failed to clear prompt library.");
    }
  }

  const slotCount = getLayoutCellCount(layout);
  const slotProviders = Array.from({ length: slotCount }, (_, index) => panelProviders[index] ?? null);
  const hasDraftContent = prompt.trim().length > 0 || attachments.length > 0;
  const composerStatus = statusMessage !== "Ready." ? statusMessage : null;
  const composerWidth = getComposerWidthStyle(composerSize.width);
  const composerHeight = getComposerHeightStyle(composerSize.height);
  const connectorScene = (() => {
    void connectorLayoutVersion;

    const composerElement = composerRef.current;
    if (!composerElement) {
      return {
        occluders: [] as ConnectorOccluderModel[],
        paths: [] as ConnectorPathModel[],
      };
    }

    const composerRect = composerElement.getBoundingClientRect();
    if (!composerRect.width || !composerRect.height) {
      return {
        occluders: [] as ConnectorOccluderModel[],
        paths: [] as ConnectorPathModel[],
      };
    }

    const occluders: ConnectorOccluderModel[] = [];
    const paths = slotProviders.flatMap((providerId, slotIndex) => {
      if (!providerId) {
        return [];
      }

      const panelElement = panelSlotRefs.current[slotIndex];
      if (!panelElement) {
        return [];
      }

      const panelRect = panelElement.getBoundingClientRect();
      if (!panelRect.width || !panelRect.height) {
        return [];
      }

      const reportedAnchor = panelInputAnchors[providerId];
      const frameRect = frameRefs.current[providerId]?.getBoundingClientRect() ?? null;

      if (reportedAnchor && frameRect) {
        const occluderX = frameRect.left + clamp(reportedAnchor.left, 0, frameRect.width);
        const occluderY = frameRect.top + clamp(reportedAnchor.top, 0, frameRect.height);
        const occluderWidth = Math.min(reportedAnchor.width, frameRect.width);
        const occluderHeight = Math.min(reportedAnchor.height, frameRect.height);

        if (occluderWidth > 0 && occluderHeight > 0) {
          occluders.push({
            height: occluderHeight + CONNECTOR_OCCLUDER_PADDING_PX * 2,
            radius: Math.max(0, reportedAnchor.radius + CONNECTOR_OCCLUDER_PADDING_PX),
            width: occluderWidth + CONNECTOR_OCCLUDER_PADDING_PX * 2,
            x: occluderX - CONNECTOR_OCCLUDER_PADDING_PX,
            y: occluderY - CONNECTOR_OCCLUDER_PADDING_PX,
          });
        }
      }

      const rawTargetPoint =
        reportedAnchor && frameRect
          ? {
              x: frameRect.left + clamp(reportedAnchor.x, 0, frameRect.width),
              y: frameRect.top + clamp(reportedAnchor.y, 0, frameRect.height),
            }
          : getFallbackPanelAnchor(panelRect);
      const composerCenter = {
        x: composerRect.left + composerRect.width / 2,
        y: composerRect.top + composerRect.height / 2,
      };
      const sourcePoint = movePointToward(
        getRectEdgePoint(composerRect, rawTargetPoint),
        composerCenter,
        CONNECTOR_SOURCE_OVERDRAW_PX,
      );
      const targetPoint =
        reportedAnchor && frameRect
          ? movePointToward(
              getRectEdgePoint(
                new DOMRect(
                  frameRect.left + clamp(reportedAnchor.left, 0, frameRect.width),
                  frameRect.top + clamp(reportedAnchor.top, 0, frameRect.height),
                  Math.min(reportedAnchor.width, frameRect.width),
                  Math.min(reportedAnchor.height, frameRect.height),
                ),
                sourcePoint,
              ),
              rawTargetPoint,
              CONNECTOR_TARGET_OVERDRAW_PX,
            )
          : rawTargetPoint;
      const connectorState = connectorStates[providerId];

      return [
        {
          path: buildConnectorPath(sourcePoint, targetPoint),
          phase: connectorState?.phase ?? "idle",
          providerId,
          pulseKey: connectorState?.pulseKey ?? 0,
        },
      ];
    });

    return {
      occluders,
      paths,
    };
  })();
  const connectorOccluderModels = connectorScene.occluders;
  const connectorPathModels = connectorScene.paths;
  const promptCategories = [...new Set(promptLibraryItems.map((item) => item.category).filter(Boolean))].sort();
  const filteredPromptLibraryItems = (() => {
    let nextItems = [...promptLibraryItems];

    if (promptLibrarySearch.trim()) {
      const search = promptLibrarySearch.trim().toLowerCase();
      nextItems = nextItems.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.content.toLowerCase().includes(search) ||
          item.tags.some((tag) => tag.toLowerCase().includes(search)),
      );
    } else if (promptLibraryFilter === "favorites") {
      nextItems = nextItems.filter((item) => item.isFavorite);
    } else if (promptLibraryFilter === "recent") {
      nextItems = nextItems
        .filter((item) => item.lastUsed !== null)
        .sort((left, right) => (right.lastUsed ?? 0) - (left.lastUsed ?? 0));

      if (nextItems.length === 0) {
        nextItems = [...promptLibraryItems];
      }
    }

    if (promptLibraryCategory) {
      nextItems = nextItems.filter((item) => item.category === promptLibraryCategory);
    }

    return nextItems;
  })();
  let slotCursor = 0;

  return (
    <div className="parallel-ai-app relative h-full overflow-hidden">
      <main className="absolute inset-0 z-0">
        <PanelGroup className="h-full" groupRef={verticalPanelGroupRef} orientation="vertical">
          {LAYOUTS[layout].rows.map((columnCount, rowIndex) => (
            <Fragment key={`${layout}-${rowIndex}`}>
              <Panel
                defaultSize={100 / LAYOUTS[layout].rows.length}
                id={getRowPanelId(layout, rowIndex)}
                minSize={12}
              >
                <PanelGroup
                  className="h-full"
                  groupRef={(handle) => setHorizontalPanelGroupRef(rowIndex, handle)}
                  orientation="horizontal"
                >
                  {Array.from({ length: columnCount }).map((_, columnIndex) => {
                    const slotIndex = slotCursor;
                    const providerId = slotProviders[slotCursor++];
                    const provider = providerId ? getProviderById(providerId) : null;
                    return (
                      <Fragment key={`${layout}-${rowIndex}-${columnIndex}`}>
                        <Panel
                          defaultSize={100 / columnCount}
                          id={getColumnPanelId(layout, rowIndex, columnIndex)}
                          minSize={12}
                        >
                          <div
                            className="h-full"
                            ref={(element) => setPanelSlotRef(slotIndex, element)}
                          >
                            {provider ? (
                              <PanelFrame
                                dragState={
                                  panelDragSourceIndex === slotIndex
                                    ? "source"
                                    : panelDragTargetIndex === slotIndex
                                      ? "target"
                                      : "idle"
                                }
                                iframeKey={`${provider.id}-${temporaryChatEnabled ? "temp" : "normal"}-${settings.googleProviderMode}-${refreshByProvider[provider.id] ?? 0}`}
                                onBeginReorder={(event) => beginPanelDrag(slotIndex, event)}
                                loading={loadingProviders[provider.id] ?? true}
                                onIframeLoad={() => {
                                  setLoadingProviders((current) => ({
                                    ...current,
                                    [provider.id]: false,
                                  }));
                                  requestProviderInputAnchor(provider.id, 180);
                                  requestProviderInputAnchor(provider.id, 1200);

                                  if (
                                    temporaryChatEnabled &&
                                    TEMP_CHAT_SUPPORTED_PROVIDERS.has(provider.id)
                                  ) {
                                    window.setTimeout(() => {
                                      postToProvider(provider.id, { type: "ENABLE_TEMP_CHAT" });
                                    }, 450);
                                  }
                                }}
                                onRefresh={() => refreshProvider(provider.id)}
                                onRemove={() => removePanel(slotIndex)}
                                onSwitchProvider={(nextProviderId) =>
                                  switchPanelProvider(slotIndex, nextProviderId)
                                }
                                provider={provider}
                                providerOptions={providers}
                                registerFrame={(element) => registerFrame(provider.id, element)}
                                src={getPanelUrl(
                                  provider,
                                  settings.googleProviderMode,
                                  temporaryChatEnabled,
                                )}
                              />
                            ) : (
                              <EmptyPanelSlot />
                            )}
                          </div>
                        </Panel>
                        {columnIndex < columnCount - 1 ? (
                          <PanelResizeHandle
                            className="resize-handle resize-handle-horizontal"
                            onDoubleClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              resetHorizontalPanelLayout(rowIndex, columnCount);
                            }}
                          />
                        ) : null}
                      </Fragment>
                    );
                  })}
                </PanelGroup>
              </Panel>
              {rowIndex < LAYOUTS[layout].rows.length - 1 ? (
                <PanelResizeHandle
                  className="resize-handle resize-handle-vertical"
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    resetVerticalPanelLayout();
                  }}
                />
              ) : null}
            </Fragment>
          ))}
        </PanelGroup>
      </main>

      <div className="pointer-events-none absolute inset-0 z-20">
        {connectorPathModels.length ? (
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          >
            <defs>
              <mask
                height={window.innerHeight}
                id={CONNECTOR_MASK_ID}
                maskUnits="userSpaceOnUse"
                width={window.innerWidth}
                x={0}
                y={0}
              >
                <rect fill="white" height={window.innerHeight} width={window.innerWidth} x={0} y={0} />
                {connectorOccluderModels.map((occluder, index) => (
                  <rect
                    key={`connector-occluder-${index}`}
                    fill="black"
                    height={occluder.height}
                    rx={occluder.radius}
                    ry={occluder.radius}
                    width={occluder.width}
                    x={occluder.x}
                    y={occluder.y}
                  />
                ))}
              </mask>
            </defs>
            {connectorPathModels.map(({ path, phase, providerId, pulseKey }) => (
              <Fragment key={`connector-${providerId}`}>
                <path
                  className={`composer-connector composer-connector--rail ${
                    phase === "idle" ? "composer-connector--idle" : "composer-connector--active-rail"
                  }`}
                  d={path}
                  mask={`url(#${CONNECTOR_MASK_ID})`}
                />
                {phase !== "idle" ? (
                  <path
                    key={`connector-solid-${providerId}-${pulseKey}`}
                    className={`composer-connector composer-connector--solid composer-connector--${phase}`}
                    d={path}
                    mask={`url(#${CONNECTOR_MASK_ID})`}
                    pathLength={100}
                  />
                ) : null}
                {phase === "submitting" ? (
                  <path
                    className="composer-connector composer-connector--flow"
                    d={path}
                    mask={`url(#${CONNECTOR_MASK_ID})`}
                    pathLength={100}
                  />
                ) : null}
              </Fragment>
            ))}
          </svg>
        ) : null}

        <div
            className="absolute bottom-5 left-1/2 flex flex-col items-center gap-2"
            ref={composerShellRef}
            style={{
              transform: `translate(calc(-50% + ${composerOffset.x}px), ${composerOffset.y}px)`,
              width: composerWidth,
            }}
          >
          {composerStatus ? (
            <div className="rounded-full bg-black/35 px-3 py-1 text-xs text-[hsl(var(--foreground-soft))] backdrop-blur-md">
              {composerStatus}
            </div>
          ) : null}

          <div className="relative w-full">
            <div
              className="pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[#2d2d2d] shadow-[0_24px_80px_-42px_rgba(0,0,0,0.9)]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleComposerDrop}
              ref={composerRef}
              style={{ height: composerHeight }}
            >
              <div
                className={`relative flex items-center justify-between gap-3 px-4 pb-2 pt-4 select-none ${
                  composerDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                onPointerDown={beginComposerDragFromHeader}
              >
                <button
                  aria-label="Drag composer"
                  className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-[hsl(var(--foreground-muted))] transition hover:bg-white/6 hover:text-white ${
                    composerDragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    resetComposerPosition();
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginComposerDrag(event);
                  }}
                  title="Drag to reposition. Double-click to reset."
                  type="button"
                >
                  <span className="grid grid-cols-4 place-items-center gap-x-1.5 gap-y-1">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <span
                        key={index}
                        className="h-1 w-1 rounded-full bg-current opacity-80"
                      />
                    ))}
                  </span>
                </button>

                <div className="flex items-center gap-3 pr-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 ring-1 ring-white/10">
                    <img
                      alt="PARALLEL AI"
                      className="h-7 w-7"
                      src={runtimeAsset("graphics/app-icon.png")}
                    />
                  </div>
                  <span className="hidden text-xs font-medium uppercase tracking-[0.28em] text-[hsl(var(--foreground-soft))] sm:inline">
                    PARALLEL AI
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    className="h-[30px] w-[30px] rounded-full"
                    onClick={() => setPromptLibraryOpen(true)}
                    size="icon"
                    variant={promptLibraryOpen ? "primary" : "ghost"}
                  >
                    <BookOpenText size={15} />
                  </Button>
                  <Button
                    className="h-[30px] w-[30px] rounded-full bg-white/6"
                    onClick={addPanel}
                    size="icon"
                    variant="secondary"
                  >
                    <Plus size={14} />
                  </Button>
                  <Button
                    className="h-[30px] w-[30px] rounded-full"
                    onClick={openNewChatEverywhere}
                    size="icon"
                    variant="ghost"
                  >
                    <WandSparkles size={15} />
                  </Button>
                  <Button
                    className="h-[30px] w-[30px] rounded-full"
                    onClick={toggleTemporaryChat}
                    size="icon"
                    variant={temporaryChatEnabled ? "secondary" : "ghost"}
                  >
                    <MoonStar size={15} />
                  </Button>
                  <Button
                    className={`h-[30px] w-[30px] rounded-full ${
                      settings.scrollSyncEnabled ? "bg-white/8" : ""
                    }`}
                    onClick={toggleScrollSync}
                    size="icon"
                    title={
                      settings.scrollSyncEnabled
                        ? "Disable scroll sync"
                        : "Enable scroll sync"
                    }
                    variant={settings.scrollSyncEnabled ? "secondary" : "ghost"}
                  >
                    <ArrowUpDown size={15} />
                  </Button>
                  <Button
                    className="h-[30px] w-[30px] rounded-full"
                    onClick={() => setLayoutModalOpen(true)}
                    size="icon"
                    variant="ghost"
                  >
                    <LayoutGrid size={15} />
                  </Button>
                  <Button
                    className="h-[30px] w-[30px] rounded-full"
                    onClick={() => setSettingsModalOpen(true)}
                    size="icon"
                    variant="ghost"
                  >
                    <Settings2 size={15} />
                  </Button>
                </div>
              </div>

                {attachments.length ? (
                <div className="flex flex-wrap gap-2 px-4 pb-0.5 pt-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-[hsl(var(--foreground-soft))]"
                    >
                      <span className="max-w-[220px] truncate">{attachment.name}</span>
                      <button
                        className="rounded-full p-0.5 text-[hsl(var(--foreground-muted))] transition hover:bg-white/8 hover:text-white"
                        onClick={() =>
                          setAttachments((current) =>
                            current.filter((item) => item.id !== attachment.id),
                          )
                        }
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                className="min-h-0 flex-1 resize-none bg-transparent px-5 pb-2 pt-3 text-base text-white outline-none placeholder:text-[hsl(var(--foreground-muted))]"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                onPaste={handleComposerPaste}
                placeholder="Ask anything"
                value={prompt}
              />

              <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1.5">
                <div className="flex items-center gap-1">
                  <label className="inline-flex">
                    <input
                      accept="image/*,application/pdf,text/plain,.txt,.md,.csv,.json"
                      className="hidden"
                      multiple
                      onChange={(event) => {
                        void handleFilesSelected(event.target.files);
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[hsl(var(--foreground-soft))] transition hover:bg-white/8 hover:text-white">
                      <Plus size={16} />
                    </span>
                  </label>

                  <Button
                    className="h-8 rounded-full bg-white/8 px-3 text-[12px] font-medium text-[hsl(var(--foreground))] ring-1 ring-white/10 hover:bg-white/12"
                    onClick={() => void dispatchPrompt(undefined, false)}
                    size="sm"
                    variant="secondary"
                  >
                    Fill All
                  </Button>

                  {hasDraftContent ? (
                    <Button
                      className="h-8 w-8 rounded-full"
                      onClick={clearPanels}
                      size="icon"
                      variant="ghost"
                    >
                      <Eraser size={14} />
                    </Button>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <button
                    aria-label="Send all"
                    className="inline-flex h-8 items-center justify-center rounded-full bg-white px-4 text-[12px] font-medium text-[hsl(var(--background))] shadow-[0_10px_24px_-18px_rgba(255,255,255,0.88)] transition hover:scale-[1.02]"
                    onClick={() => void dispatchPrompt(undefined, true)}
                    type="button"
                  >
                    Send All
                  </button>
                </div>
              </div>

            </div>
            <button
              aria-label="Resize composer from top edge"
              className="pointer-events-auto absolute left-4 right-4 top-0 z-10 h-5 -translate-y-1/2 cursor-ns-resize bg-transparent"
              onDoubleClick={resetComposerSize}
              onPointerDown={(event) => beginComposerResize("top", event)}
              style={{ cursor: "ns-resize" }}
              title="Drag to resize composer. Double-click to reset size."
              type="button"
            />
            <button
              aria-label="Resize composer from right edge"
              className="pointer-events-auto absolute bottom-4 right-0 top-4 z-10 w-5 translate-x-1/2 cursor-ew-resize bg-transparent"
              onDoubleClick={resetComposerSize}
              onPointerDown={(event) => beginComposerResize("right", event)}
              style={{ cursor: "ew-resize" }}
              title="Drag to resize composer. Double-click to reset size."
              type="button"
            />
            <button
              aria-label="Resize composer from bottom edge"
              className="pointer-events-auto absolute bottom-0 left-4 right-4 z-10 h-5 translate-y-1/2 cursor-ns-resize bg-transparent"
              onDoubleClick={resetComposerSize}
              onPointerDown={(event) => beginComposerResize("bottom", event)}
              style={{ cursor: "ns-resize" }}
              title="Drag to resize composer. Double-click to reset size."
              type="button"
            />
            <button
              aria-label="Resize composer from left edge"
              className="pointer-events-auto absolute bottom-4 left-0 top-4 z-10 w-5 -translate-x-1/2 cursor-ew-resize bg-transparent"
              onDoubleClick={resetComposerSize}
              onPointerDown={(event) => beginComposerResize("left", event)}
              style={{ cursor: "ew-resize" }}
              title="Drag to resize composer. Double-click to reset size."
              type="button"
            />
          </div>
        </div>
      </div>

      <Modal
        description="Choose the overall panel arrangement. Resize handles inside the workspace fine-tune the current layout."
        onClose={() => setLayoutModalOpen(false)}
        open={layoutModalOpen}
        size="xl"
        title="Layout"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ALL_LAYOUTS.map((option) => (
            <button
              key={option.id}
              className={`rounded-[24px] border p-4 text-left transition ${
                layout === option.id
                  ? "border-[hsl(var(--accent-strong))] bg-[hsl(var(--accent-strong))]/10"
                  : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/7"
              }`}
              onClick={() => {
                setLayout(option.id);
                setPanelProviders((current) =>
                  resizePanelProviders(current, settings.enabledProviders, option.id),
                );
                setLayoutModalOpen(false);
              }}
              type="button"
            >
              <LayoutPreview layoutId={option.id} />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-base font-semibold text-white">{option.label}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--foreground-muted))]">
                  {getLayoutCellCount(option.id)} slots
                </span>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        description="All controls now live inside the workspace instead of a separate options page."
        onClose={() => setSettingsModalOpen(false)}
        open={settingsModalOpen}
        size="xl"
        title="Settings"
      >
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2">
            {[
              ["appearance", "Appearance"],
              ["providers", "Providers"],
              ["keyboard", "Keyboard"],
              ["library", "Prompt Library"],
              ["data", "Data"],
              ["about", "About"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  settingsTab === value
                    ? "bg-white/12 text-white"
                    : "bg-white/4 text-[hsl(var(--foreground-soft))] hover:bg-white/8 hover:text-white"
                }`}
                onClick={() =>
                  setSettingsTab(
                    value as
                      | "appearance"
                      | "providers"
                      | "keyboard"
                      | "library"
                      | "data"
                      | "about",
                  )
                }
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
                        onClick={() => void updateSetting("theme", "light")}
                        variant={settings.theme === "light" ? "primary" : "secondary"}
                      >
                        <SunMedium size={16} />
                        Light
                      </Button>
                      <Button
                        onClick={() => void updateSetting("theme", "dark")}
                        variant={settings.theme === "dark" ? "primary" : "secondary"}
                      >
                        <MoonStar size={16} />
                        Dark
                      </Button>
                      <Button
                        onClick={() => void updateSetting("theme", "auto")}
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
                    onChange={(event) =>
                      void updateSetting(
                        "language",
                        event.target.value === "auto" ? null : event.target.value,
                      )
                    }
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
                  description="Pick whether the Google panel should open AI mode or standard search."
                  title="Google mode"
                >
                  <Select
                    onChange={(event) =>
                      void setGoogleMode(event.target.value === "search" ? "search" : "ai")
                    }
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
                          src={runtimeAsset(provider.icon)}
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
                          disabled={index === 0}
                          onClick={() => void moveProvider(provider.id, "up")}
                          size="icon"
                          variant="ghost"
                        >
                          <ArrowUp size={15} />
                        </Button>
                        <Button
                          disabled={index === providers.length - 1}
                          onClick={() => void moveProvider(provider.id, "down")}
                          size="icon"
                          variant="ghost"
                        >
                          <ArrowDown size={15} />
                        </Button>
                        <Switch
                          checked={enabled}
                          onChange={() => void toggleProvider(provider.id)}
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
                      checked={settings.keyboardShortcutEnabled}
                      onChange={(event) =>
                        void updateSetting("keyboardShortcutEnabled", event.target.checked)
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
                      checked={settings.enterKeyBehavior.enabled}
                      onChange={(event) =>
                        void updateSetting("enterKeyBehavior", {
                          ...settings.enterKeyBehavior,
                          enabled: event.target.checked,
                        })
                      }
                    />
                    <Select
                      onChange={(event) =>
                        void updateSetting("enterKeyBehavior", {
                          ...settings.enterKeyBehavior,
                          preset: event.target.value as
                            | "default"
                            | "swapped"
                            | "slack"
                            | "discord"
                            | "custom",
                        })
                      }
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
                  description="Control whether selected URLs are prefixed or appended when importing content."
                  title="Source URL placement"
                >
                  <Select
                    onChange={(event) =>
                      void updateSetting(
                        "sourceUrlPlacement",
                        event.target.value as "none" | "beginning" | "end",
                      )
                    }
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
                      {promptLibraryItems.length} saved prompt
                      {promptLibraryItems.length === 1 ? "" : "s"}
                    </div>
                    <Button onClick={() => setPromptLibraryOpen(true)} variant="primary">
                      <BookOpenText size={16} />
                      Open library
                    </Button>
                  </div>
                </SettingItem>

                <SettingItem
                  description="Bring in starter prompts or exchange libraries as JSON files."
                  title="Import and export"
                >
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleImportDefaultPromptLibrary} variant="secondary">
                      <Sparkles size={16} />
                      Import defaults
                    </Button>
                    <label className="inline-flex">
                      <input
                        accept="application/json"
                        className="hidden"
                        onChange={(event) => {
                          void handleImportPromptFile(event.target.files?.[0] ?? null);
                          event.currentTarget.value = "";
                        }}
                        type="file"
                      />
                      <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/8 px-4 text-sm font-medium text-[hsl(var(--foreground))] ring-1 ring-white/10 transition hover:bg-white/12">
                        <Upload size={16} />
                        Import JSON
                      </span>
                    </label>
                    <Button onClick={handleExportPromptLibrary} variant="secondary">
                      <Download size={16} />
                      Export JSON
                    </Button>
                    <Button onClick={handleClearPromptLibrary} variant="danger">
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
                    <Button onClick={handleExportSettings} variant="secondary">
                      <Download size={16} />
                      Export settings
                    </Button>
                    <Button onClick={handleExportWorkspaceData} variant="secondary">
                      <Download size={16} />
                      Export workspace
                    </Button>
                    <label className="inline-flex">
                      <input
                        accept="application/json"
                        className="hidden"
                        onChange={(event) => {
                          void handleImportSettingsFile(event.target.files?.[0] ?? null);
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
                    <Button
                      onClick={() => {
                        setPrompt("");
                        setAttachments([]);
                        showStatus("Workspace draft cleared.");
                      }}
                      variant="secondary"
                    >
                      Clear draft
                    </Button>
                    <Button onClick={() => void resetAllSettings()} variant="danger">
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
                      Manifest version: <span className="text-white">{versionInfo?.manifestVersion ?? "0.1.0"}</span>
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
                    <Button onClick={() => void runCheck()} variant="secondary">
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
        onClose={() => {
          setPromptEditorOpen(false);
          setPromptEditorState(promptToEditorState());
        }}
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
