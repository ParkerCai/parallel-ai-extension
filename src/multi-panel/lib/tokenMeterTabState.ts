import type { ComposerOffset, ComposerSize } from "@/shared/lib/settings";

// The Token Meter is a per-tab floating window: opening, moving, resizing, or
// closing it in one Parallel AI tab must not affect any other tab. So its state
// lives in sessionStorage (scoped to a single tab, kept across reloads of that
// tab, cleared when the tab closes) rather than the cross-tab synced settings.

export interface TokenMeterTabState {
  open: boolean;
  // Full-viewport maximize is a per-tab view state, like `open`: maximizing in
  // one tab must not maximize every other tab's meter.
  maximized: boolean;
  // {x:-1,y:-1} = not yet placed (opens near the top-right corner).
  offset: ComposerOffset;
  // {width:0,height:0} = not yet sized (derives width from the pane layout).
  size: ComposerSize;
}

const STORAGE_KEY = "parallel-ai:token-meter";

export const TOKEN_METER_AUTO_OFFSET: ComposerOffset = { x: -1, y: -1 };
export const TOKEN_METER_AUTO_SIZE: ComposerSize = { width: 0, height: 0 };

export const DEFAULT_TOKEN_METER_TAB_STATE: TokenMeterTabState = {
  open: false,
  maximized: false,
  offset: TOKEN_METER_AUTO_OFFSET,
  size: TOKEN_METER_AUTO_SIZE,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeTokenMeterTabState(input: unknown): TokenMeterTabState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_TOKEN_METER_TAB_STATE };
  }
  const candidate = input as Record<string, unknown>;

  const offsetRaw = candidate.offset as Partial<ComposerOffset> | undefined;
  const offset =
    offsetRaw && isFiniteNumber(offsetRaw.x) && isFiniteNumber(offsetRaw.y)
      ? { x: offsetRaw.x, y: offsetRaw.y }
      : { ...TOKEN_METER_AUTO_OFFSET };

  const sizeRaw = candidate.size as Partial<ComposerSize> | undefined;
  const size =
    sizeRaw &&
    isFiniteNumber(sizeRaw.width) &&
    isFiniteNumber(sizeRaw.height) &&
    sizeRaw.width >= 0 &&
    sizeRaw.height >= 0
      ? { width: sizeRaw.width, height: sizeRaw.height }
      : { ...TOKEN_METER_AUTO_SIZE };

  return { open: candidate.open === true, maximized: candidate.maximized === true, offset, size };
}

export function readTokenMeterTabState(): TokenMeterTabState {
  if (typeof sessionStorage === "undefined") {
    return { ...DEFAULT_TOKEN_METER_TAB_STATE };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw
      ? normalizeTokenMeterTabState(JSON.parse(raw))
      : { ...DEFAULT_TOKEN_METER_TAB_STATE };
  } catch {
    return { ...DEFAULT_TOKEN_METER_TAB_STATE };
  }
}

export function writeTokenMeterTabState(patch: Partial<TokenMeterTabState>): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const next = { ...readTokenMeterTabState(), ...patch };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage may be unavailable or over quota; the meter simply won't
    // remember its state across a reload of this tab.
  }
}
