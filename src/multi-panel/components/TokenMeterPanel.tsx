import {
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  Minus,
  PanelBottom,
  Palette,
  Plus,
  RefreshCcw,
  X,
} from "lucide-react";
import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { runtimeAsset } from "@/multi-panel/lib/runtime";
import type { MeterResizeEdge } from "@/multi-panel/hooks/useMeterFrameController";
import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import { useTranslation } from "@/shared/contexts/I18nContext";
import { getProviderColor, type Provider } from "@/shared/lib/providers";
import {
  formatShortDuration,
  isUsageStale,
  sortMetricsByConstraint,
  usedFraction,
  USAGE_CAPABLE_PROVIDERS,
  type ProviderUsageSnapshot,
  type UsageMetric,
  type UsageSnapshotMap,
} from "@/shared/lib/usage-snapshots";

const RELATIVE_TIME_TICK_MS = 30_000;
const HIGH_USAGE_FRACTION = 0.85;
const USAGE_ZOOM_MIN = 0.6;
const USAGE_ZOOM_MAX = 2.2;
const USAGE_ZOOM_STEP = 0.1;
// Columns stretch to fill the width (auto-fit + 1fr) and collapse toward one as
// the panel narrows below this; rows grow to fill the height with this floor.
const METER_MIN_COLUMN_PX = 190;
const METER_MIN_ROW_PX = 132;

const METER_CONTROL_BUTTON_CLASS =
  "pointer-events-auto inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[hsl(var(--surface-popover)/0.7)] p-0 leading-none text-[hsl(var(--foreground-soft))] backdrop-blur-sm transition-colors duration-200 hover:bg-[hsl(var(--surface-popover))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none";

// Same round-button footprint as the refresh/close controls, but it carries an
// on/off state: muted when off (matching the other controls), accent-filled
// when on. Reused for the two header toggles so they don't introduce a new
// control style.
const METER_TOGGLE_BASE_CLASS =
  "pointer-events-auto inline-flex h-7 w-7 flex-none items-center justify-center rounded-full p-0 leading-none backdrop-blur-sm transition-colors duration-200 focus-visible:outline-none";
function meterToggleClass(active: boolean) {
  return active
    ? `${METER_TOGGLE_BASE_CLASS} bg-[hsl(var(--accent-strong))] text-[hsl(var(--foreground-on-accent))] hover:bg-[hsl(var(--accent-strong)/0.9)]`
    : `${METER_TOGGLE_BASE_CLASS} bg-[hsl(var(--surface-popover)/0.7)] text-[hsl(var(--foreground-soft))] hover:bg-[hsl(var(--surface-popover))] hover:text-[hsl(var(--foreground))]`;
}

interface TokenMeterPanelProps {
  activeProviders: Provider[];
  maximized: boolean;
  meterDragging: boolean;
  meterPosition: { x: number; y: number };
  meterResizing: boolean;
  meterShellRef: RefObject<HTMLDivElement>;
  meterSize: { width: number; height: number };
  onBeginMeterDragFromHeader: (event: ReactPointerEvent<HTMLElement>) => void;
  onBeginMeterResize: (edge: MeterResizeEdge, event: ReactPointerEvent<HTMLElement>) => void;
  onCenter: () => void;
  onClose: () => void;
  onToggleMaximize: () => void;
  onRefresh: () => void;
  open: boolean;
  refreshing: boolean;
  usageByProvider: UsageSnapshotMap;
}

function UsageMetricRow({
  metric,
  now,
  barColor,
}: {
  metric: UsageMetric;
  now: number;
  barColor?: string;
}) {
  const { t } = useTranslation();
  const fraction = usedFraction(metric);
  const isHighUsage = fraction !== null && fraction >= HIGH_USAGE_FRACTION;
  const resetsAt = "resetsAt" in metric ? metric.resetsAt : undefined;

  // Providers that phrase this as "N% remaining" (e.g. ChatGPT) show the
  // remaining number and fill the bar to that remaining share, matching their
  // own page. The consumed fraction still drives ranking and the warning color.
  const showsRemaining = metric.kind === "percent" && metric.showAs === "remaining";
  let valueText: string;
  if (metric.kind === "percent") {
    // Providers phrase this two ways on their own pages: ChatGPT counts down
    // ("65% remaining"), Claude and Gemini count up ("13% used").
    valueText = showsRemaining
      ? t("usagePercentRemaining", "$1% remaining", `${Math.round(100 - metric.usedPercent)}`)
      : t("usagePercentUsed", "$1% used", `${Math.round(metric.usedPercent)}`);
  } else if (metric.kind === "count") {
    valueText = t("usageRemainingCount", "$1 left", `${metric.remaining} / ${metric.total}`);
  } else {
    valueText = metric.value;
  }
  const barFillPercent =
    fraction === null ? 0 : showsRemaining ? 100 - metric.usedPercent : fraction * 100;

  return (
    <div className="space-y-[0.4em]">
      <div className="flex items-baseline justify-between gap-[0.75em]">
        <span className="min-w-0 truncate text-[0.9em] text-[hsl(var(--foreground-soft))]">
          {metric.label}
        </span>
        <span
          className={`flex-none text-[0.9em] font-medium tabular-nums ${
            isHighUsage ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--foreground))]"
          }`}
        >
          {valueText}
        </span>
      </div>
      {fraction !== null ? (
        <div className="h-[0.6em] overflow-hidden rounded-full bg-[hsl(var(--tint-base)/0.10)]">
          <div
            className={`h-full rounded-full ${
              isHighUsage
                ? "bg-[hsl(var(--danger))]"
                : barColor
                  ? ""
                  : "bg-[hsl(var(--foreground-muted))]"
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, barFillPercent))}%`,
              ...(barColor && !isHighUsage ? { backgroundColor: barColor } : null),
            }}
          />
        </div>
      ) : null}
      {resetsAt !== undefined && resetsAt > now ? (
        <p className="text-[0.72em] text-[hsl(var(--foreground-muted))]">
          {t("usageResetsIn", "Resets in $1", formatShortDuration(resetsAt - now))}
        </p>
      ) : null}
    </div>
  );
}

function ProviderUsageSection({
  now,
  provider,
  snapshot,
  variant = "card",
}: {
  now: number;
  provider: Provider;
  snapshot: ProviderUsageSnapshot | undefined;
  variant?: "card" | "row";
}) {
  const { resolvedTheme, settings } = useSettingsContext();
  const { t } = useTranslation();

  const barColor = settings.usageColorfulBarsEnabled
    ? getProviderColor(provider.id, resolvedTheme === "light" ? "light" : "dark")
    : undefined;
  const capable = USAGE_CAPABLE_PROVIDERS.has(provider.id);
  const stale = snapshot ? isUsageStale(snapshot, now) : false;

  let stateMessage: string | null = null;
  if (!capable) {
    stateMessage = t("usageUnsupported", "No usage info from this provider");
  } else if (!snapshot) {
    stateMessage = t("usageWaiting", "Waiting for usage data");
  } else if (snapshot.status === "error") {
    stateMessage =
      snapshot.errorKind === "unauthenticated"
        ? t("usageSignInRequired", "Sign in to this provider to see usage")
        : t("usageLoadFailed", "Could not load usage");
  } else if (snapshot.metrics.length === 0) {
    stateMessage = t("usageNoLimitsReported", "No limits reported");
  }

  // The list view drops the card chrome: each provider is a plain full-width
  // block separated by a hairline, so every provider reads top to bottom as one
  // continuous list instead of a grid of boxes.
  const isRow = variant === "row";

  return (
    <section
      className={
        isRow
          ? "flex flex-col gap-[0.55em] border-b border-[hsl(var(--border-muted)/0.10)] px-[0.25em] py-[0.9em] last:border-b-0"
          : "squircle flex min-h-0 flex-col gap-[0.55em] overflow-hidden rounded-[1.7em] border border-[hsl(var(--border-muted)/0.10)] bg-[hsl(var(--surface-panel))] p-[1em]"
      }
    >
      <div className="flex items-center gap-[0.55em]">
        <img
          alt=""
          className="h-[1.4em] w-[1.4em] flex-none"
          src={runtimeAsset(resolvedTheme === "light" ? provider.icon : provider.iconDark)}
        />
        <span className="min-w-0 flex-1 truncate text-[1em] font-medium text-[hsl(var(--foreground))]">
          {provider.name}
        </span>
        {snapshot && snapshot.status === "ok" ? (
          <span className="flex-none text-[0.72em] text-[hsl(var(--foreground-muted))]">
            {t(
              "usageUpdatedAgo",
              "Updated $1 ago",
              formatShortDuration(Math.max(0, now - snapshot.fetchedAt)),
            )}
          </span>
        ) : null}
      </div>

      {stateMessage ? (
        <p className="text-[0.9em] text-[hsl(var(--foreground-muted))]">{stateMessage}</p>
      ) : snapshot ? (
        <div
          className={`space-y-[0.7em] ${
            isRow ? "" : "min-h-0 flex-1 overflow-y-auto pr-[0.25em]"
          } ${stale ? "opacity-60" : ""}`}
        >
          {sortMetricsByConstraint(snapshot.metrics).map((metric) => (
            <UsageMetricRow key={metric.id} metric={metric} now={now} barColor={barColor} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TokenMeterPanel({
  activeProviders,
  maximized,
  meterDragging,
  meterPosition,
  meterResizing,
  meterShellRef,
  meterSize,
  onBeginMeterDragFromHeader,
  onBeginMeterResize,
  onCenter,
  onClose,
  onToggleMaximize,
  onRefresh,
  open,
  refreshing,
  usageByProvider,
}: TokenMeterPanelProps) {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettingsContext();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      return;
    }
    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, RELATIVE_TIME_TICK_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  // Content scales with the panel: everything inside the scroll area is sized in
  // `em`, and this base font-size (in px) is derived from the panel's smaller
  // dimension. Small panel -> compact; large panel -> everything grows together.
  // When maximized the panel fills the viewport (CSS 100%, so `meterSize` no
  // longer reflects the real size) — measure the viewport instead and allow a
  // much larger cap so text and bars scale up a lot on the full-screen view.
  const scaleWidth = maximized && typeof window !== "undefined" ? window.innerWidth : meterSize.width;
  const scaleHeight =
    maximized && typeof window !== "undefined" ? window.innerHeight : meterSize.height;
  const scaleCap = maximized ? 2.4 : 1.7;
  const meterScale = Math.max(
    0.85,
    Math.min(scaleCap, Math.min(scaleWidth / 460, scaleHeight / 360)),
  );
  // The +/- buttons apply a durable zoom multiplier on top of the size-derived
  // scale, so users can fine-tune how big the text and bars are.
  const zoom = settings.usageContentZoom;
  const listView = settings.usageViewMode === "list";
  const meterFontPx = 15 * meterScale * zoom;
  const applyZoom = (delta: number) => {
    const next = Math.round((zoom + delta) * 10) / 10;
    const clamped = Math.min(USAGE_ZOOM_MAX, Math.max(USAGE_ZOOM_MIN, next));
    if (clamped !== zoom) {
      void updateSetting("usageContentZoom", clamped);
    }
  };

  return (
    <div
      className={`pointer-events-auto absolute flex select-none flex-col overflow-hidden bg-[hsl(var(--surface-modal))] ${
        maximized
          ? "rounded-none"
          : `squircle rounded-[40px] border border-[hsl(var(--border-muted)/0.10)] shadow-[0_30px_120px_-40px_hsl(var(--shadow-ambient)/0.95)] ${
              meterDragging ? "cursor-grabbing" : "cursor-grab"
            }`
      }`}
      ref={meterShellRef}
      onPointerDown={maximized ? undefined : onBeginMeterDragFromHeader}
      onDoubleClick={(event) => {
        // Double-click anywhere on the panel recenters it, except on the
        // controls and resize handles (all interactive elements). No-op while
        // maximized (the panel fills the viewport).
        if (
          maximized ||
          (event.target instanceof Element &&
            event.target.closest("button, input, textarea, select, label, a, [role='button']"))
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onCenter();
      }}
      style={
        maximized
          ? { left: 0, top: 0, width: "100%", height: "100%" }
          : {
              left: `${meterPosition.x}px`,
              top: `${meterPosition.y}px`,
              width: `${meterSize.width}px`,
              height: `${meterSize.height}px`,
            }
      }
    >
      <div
        className="flex flex-none items-center justify-between gap-2 px-4 pb-1 pt-3.5"
        data-tooltip={t("usagePanelDragHint", "Drag to reposition. Double-click to reset position.")}
        data-tooltip-placement="top"
      >
        <div className="flex gap-1.5">
          <button
            aria-label={
              settings.paneUsageStripEnabled
                ? t("paneUsageStripAriaDisable", "Hide usage bar on panes")
                : t("paneUsageStripAriaEnable", "Show usage bar on panes")
            }
            aria-pressed={settings.paneUsageStripEnabled}
            className={meterToggleClass(settings.paneUsageStripEnabled)}
            data-tooltip={t("paneUsageStripTitle", "Usage bar on panes")}
            data-tooltip-placement="top"
            onClick={() =>
              void updateSetting("paneUsageStripEnabled", !settings.paneUsageStripEnabled)
            }
            type="button"
          >
            <PanelBottom size={14} />
          </button>
          <button
            aria-label={
              settings.usageColorfulBarsEnabled
                ? t("usageColorfulBarsAriaDisable", "Use the default bar color")
                : t("usageColorfulBarsAriaEnable", "Color each provider's bars in its own color")
            }
            aria-pressed={settings.usageColorfulBarsEnabled}
            className={meterToggleClass(settings.usageColorfulBarsEnabled)}
            data-tooltip={t("usageColorfulBarsTitle", "Colorful progress bars")}
            data-tooltip-placement="top"
            onClick={() =>
              void updateSetting("usageColorfulBarsEnabled", !settings.usageColorfulBarsEnabled)
            }
            type="button"
          >
            <Palette size={14} />
          </button>
          <button
            aria-label={
              listView
                ? t("usageAriaViewGrid", "Show one card per provider")
                : t("usageAriaViewList", "Show all providers in one list")
            }
            aria-pressed={listView}
            className={meterToggleClass(listView)}
            data-tooltip={
              listView
                ? t("usageTooltipViewGrid", "Card view")
                : t("usageTooltipViewList", "List view")
            }
            data-tooltip-placement="top"
            onClick={() => void updateSetting("usageViewMode", listView ? "grid" : "list")}
            type="button"
          >
            {listView ? <LayoutGrid size={14} /> : <List size={14} />}
          </button>
          <button
            aria-label={t("usageAriaZoomOut", "Make usage text smaller")}
            className={`${METER_CONTROL_BUTTON_CLASS} disabled:opacity-40`}
            data-tooltip={t("usageTooltipZoomOut", "Smaller")}
            data-tooltip-placement="top"
            disabled={zoom <= USAGE_ZOOM_MIN}
            onClick={() => applyZoom(-USAGE_ZOOM_STEP)}
            type="button"
          >
            <Minus size={14} />
          </button>
          <button
            aria-label={t("usageAriaZoomIn", "Make usage text bigger")}
            className={`${METER_CONTROL_BUTTON_CLASS} disabled:opacity-40`}
            data-tooltip={t("usageTooltipZoomIn", "Bigger")}
            data-tooltip-placement="top"
            disabled={zoom >= USAGE_ZOOM_MAX}
            onClick={() => applyZoom(USAGE_ZOOM_STEP)}
            type="button"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex flex-none gap-1.5">
          <button
            aria-label={t("usageAriaRefresh", "Refresh usage")}
            className={METER_CONTROL_BUTTON_CLASS}
            data-tooltip={t("usageTooltipRefresh", "Refresh")}
            data-tooltip-placement="top"
            onClick={onRefresh}
            type="button"
          >
            <RefreshCcw className={refreshing ? "animate-spin" : ""} size={14} />
          </button>
          <button
            aria-label={
              maximized
                ? t("usageAriaRestore", "Restore usage panel size")
                : t("usageAriaMaximize", "Maximize usage panel")
            }
            className={METER_CONTROL_BUTTON_CLASS}
            data-tooltip={
              maximized
                ? t("usageTooltipRestore", "Restore")
                : t("usageTooltipMaximize", "Maximize")
            }
            data-tooltip-placement="top"
            onClick={onToggleMaximize}
            type="button"
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            aria-label={t("usageAriaClose", "Close usage panel")}
            className={METER_CONTROL_BUTTON_CLASS}
            data-tooltip={t("usageTooltipClose", "Close")}
            data-tooltip-placement="top"
            onClick={onClose}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1"
        style={{ fontSize: `${meterFontPx}px` }}
      >
        {activeProviders.length === 0 ? (
          <p className="px-1 py-2 text-[0.9em] text-[hsl(var(--foreground-muted))]">
            {t("usageNoActivePanels", "No active panels")}
          </p>
        ) : listView ? (
          <div className="flex flex-col px-[0.25em]">
            {activeProviders.map((provider) => (
              <ProviderUsageSection
                key={provider.id}
                now={now}
                provider={provider}
                snapshot={usageByProvider[provider.id]}
                variant="row"
              />
            ))}
          </div>
        ) : (
          <div
            className="grid h-full"
            style={{
              gap: "0.8em",
              gridTemplateColumns: `repeat(auto-fit, minmax(${Math.round(
                METER_MIN_COLUMN_PX * meterScale,
              )}px, 1fr))`,
              gridAutoRows: `minmax(${Math.round(METER_MIN_ROW_PX * meterScale)}px, 1fr)`,
            }}
          >
            {activeProviders.map((provider) => (
              <ProviderUsageSection
                key={provider.id}
                now={now}
                provider={provider}
                snapshot={usageByProvider[provider.id]}
              />
            ))}
          </div>
        )}
      </div>

      {!maximized && (
        <>
      {/* Edges (inset to leave room for the corner handles that sit on top). */}
      <button
        aria-label={t("usageAriaResizeBottom", "Resize usage panel height")}
        className="absolute left-4 right-4 top-0 h-3 -translate-y-1/2 cursor-ns-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("top", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
      <button
        aria-label={t("usageAriaResizeRight", "Resize usage panel width")}
        className="absolute bottom-4 right-0 top-4 w-3 translate-x-1/2 cursor-ew-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("right", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
      <button
        aria-label={t("usageAriaResizeBottom", "Resize usage panel height")}
        className="absolute bottom-0 left-4 right-4 h-3 translate-y-1/2 cursor-ns-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("bottom", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
      <button
        aria-label={t("usageAriaResizeRight", "Resize usage panel width")}
        className="absolute bottom-4 left-0 top-4 w-3 -translate-x-1/2 cursor-ew-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("left", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
      {/* Corners. */}
      <button
        aria-label={t("usageAriaResizeCorner", "Resize usage panel")}
        className="absolute left-0 top-0 h-5 w-5 -translate-x-1/4 -translate-y-1/4 cursor-nwse-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("top-left", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
      <button
        aria-label={t("usageAriaResizeCorner", "Resize usage panel")}
        className="absolute right-0 top-0 h-5 w-5 translate-x-1/4 -translate-y-1/4 cursor-nesw-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("top-right", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
      <button
        aria-label={t("usageAriaResizeCorner", "Resize usage panel")}
        className="absolute bottom-0 left-0 h-5 w-5 -translate-x-1/4 translate-y-1/4 cursor-nesw-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("bottom-left", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
      <button
        aria-label={t("usageAriaResizeCorner", "Resize usage panel")}
        className="absolute bottom-0 right-0 h-5 w-5 translate-x-1/4 translate-y-1/4 cursor-nwse-resize bg-transparent"
        onPointerDown={(event) => onBeginMeterResize("bottom-right", event)}
        style={{ touchAction: "none" }}
        type="button"
      />
        </>
      )}
    </div>
  );
}
