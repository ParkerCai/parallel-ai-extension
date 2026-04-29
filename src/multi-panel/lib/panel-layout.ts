import {
  DEFAULT_PANEL_PROVIDERS,
  GOOGLE_PROVIDER_MODE_SEARCH,
  NORMAL_URLS,
  TEMP_CHAT_SUPPORTED_PROVIDERS,
  TEMP_CHAT_URLS,
} from "@/shared/lib/constants";
import { getLayoutCellCount, type LayoutId } from "@/shared/lib/layouts";
import type { Provider, ProviderId } from "@/shared/lib/providers";
import type { PanelProviderSlot } from "@/shared/lib/settings";

export function getRowPanelId(layoutId: LayoutId, rowIndex: number) {
  return `row-${layoutId}-${rowIndex}`;
}

export function getColumnPanelId(layoutId: LayoutId, rowIndex: number, columnIndex: number) {
  return `column-${layoutId}-${rowIndex}-${columnIndex}`;
}

export function buildEqualGroupLayout(panelIds: string[]) {
  if (!panelIds.length) {
    return {};
  }

  const evenShare = Math.floor((100 / panelIds.length) * 1000) / 1000;
  return Object.fromEntries(
    panelIds.map((panelId, index) => [
      panelId,
      index === panelIds.length - 1 ? 100 - evenShare * (panelIds.length - 1) : evenShare,
    ]),
  );
}

export function toUniqueProviderList(providerIds: ProviderId[]) {
  return [...new Set(providerIds)];
}

export function isActivePanelProvider(providerId: PanelProviderSlot): providerId is ProviderId {
  return providerId !== null;
}

export function getActivePanelProviders(panelSlots: PanelProviderSlot[]) {
  return panelSlots.filter(isActivePanelProvider);
}

export function trimTrailingEmptyPanelSlots(panelSlots: PanelProviderSlot[]) {
  const nextSlots = [...panelSlots];

  while (nextSlots.length > 0 && nextSlots[nextSlots.length - 1] === null) {
    nextSlots.pop();
  }

  return nextSlots;
}

export function getPanelUrl(
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

export function resizePanelProviders(
  currentProviders: PanelProviderSlot[],
  enabledProviderIds: ProviderId[],
  layoutId: LayoutId,
) {
  const cellCount = getLayoutCellCount(layoutId);
  const desiredCount = Math.min(cellCount, enabledProviderIds.length);
  const seenProviders = new Set<ProviderId>();
  const nextProviders = currentProviders.slice(0, cellCount).map((providerId) => {
    if (
      providerId &&
      enabledProviderIds.includes(providerId) &&
      !seenProviders.has(providerId)
    ) {
      seenProviders.add(providerId);
      return providerId;
    }

    return null;
  });
  let activeCount = getActivePanelProviders(nextProviders).length;

  for (const providerId of enabledProviderIds) {
    if (activeCount >= desiredCount) {
      break;
    }

    if (!seenProviders.has(providerId)) {
      const emptyIndex = nextProviders.findIndex((slotProviderId) => slotProviderId === null);

      if (emptyIndex === -1) {
        nextProviders.push(providerId);
      } else {
        nextProviders[emptyIndex] = providerId;
      }

      seenProviders.add(providerId);
      activeCount += 1;
    }
  }

  const trimmedProviders = trimTrailingEmptyPanelSlots(nextProviders.slice(0, cellCount));

  return trimmedProviders.some(Boolean)
    ? trimmedProviders
    : DEFAULT_PANEL_PROVIDERS.slice(0, desiredCount || DEFAULT_PANEL_PROVIDERS.length);
}
