// View state that belongs to a single tab: opening, closing, or maximizing the
// Token Meter in one Parallel AI tab must not affect any other tab, so it lives
// in sessionStorage (per tab, kept across reloads, cleared when the tab closes).
// Geometry is deliberately not here — size and position are shared across tabs
// and survive a restart, so they live in settings (tokenMeterOffset/Size).

export interface TokenMeterTabState {
  open: boolean;
  maximized: boolean;
}

const STORAGE_KEY = "parallel-ai:token-meter";

export const DEFAULT_TOKEN_METER_TAB_STATE: TokenMeterTabState = {
  open: false,
  maximized: false,
};

export function normalizeTokenMeterTabState(input: unknown): TokenMeterTabState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_TOKEN_METER_TAB_STATE };
  }
  const candidate = input as Record<string, unknown>;

  return { open: candidate.open === true, maximized: candidate.maximized === true };
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
