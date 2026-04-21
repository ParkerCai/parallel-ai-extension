import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import {
  getOrderedProviders,
  type Provider,
  type ProviderId,
} from "@/shared/lib/providers";
import type { GoogleProviderMode } from "@/shared/lib/settings";

interface ProviderContextValue {
  providers: Provider[];
  enabledProviders: Provider[];
  toggleProvider: (providerId: ProviderId) => Promise<void>;
  moveProvider: (providerId: ProviderId, direction: "up" | "down") => Promise<void>;
  setGoogleMode: (mode: GoogleProviderMode) => Promise<void>;
}

const ProviderContext = createContext<ProviderContextValue | null>(null);

export function ProviderProvider({ children }: PropsWithChildren) {
  const { settings, updateSetting } = useSettingsContext();

  const providers = useMemo(
    () => getOrderedProviders(settings.providerOrder),
    [settings.providerOrder],
  );

  const enabledProviders = useMemo(
    () => providers.filter((provider) => settings.enabledProviders.includes(provider.id)),
    [providers, settings.enabledProviders],
  );

  async function toggleProvider(providerId: ProviderId) {
    const nextEnabledProviders = settings.enabledProviders.includes(providerId)
      ? settings.enabledProviders.filter((item) => item !== providerId)
      : [...settings.enabledProviders, providerId];

    await updateSetting("enabledProviders", nextEnabledProviders);
  }

  async function moveProvider(providerId: ProviderId, direction: "up" | "down") {
    const providerOrder = settings.providerOrder ?? providers.map((provider) => provider.id);
    const currentIndex = providerOrder.indexOf(providerId);
    const offset = direction === "up" ? -1 : 1;
    const nextIndex = currentIndex + offset;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= providerOrder.length) {
      return;
    }

    const nextOrder = [...providerOrder];
    const [movedProvider] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, movedProvider);

    await updateSetting("providerOrder", nextOrder);
  }

  async function setGoogleMode(mode: GoogleProviderMode) {
    await updateSetting("googleProviderMode", mode === "search" ? "search" : "ai");
  }

  const value = useMemo(
    () => ({
      providers,
      enabledProviders,
      toggleProvider,
      moveProvider,
      setGoogleMode,
    }),
    [enabledProviders, providers],
  );

  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}

export function useProviderContext() {
  const context = useContext(ProviderContext);

  if (!context) {
    throw new Error("useProviderContext must be used inside ProviderProvider");
  }

  return context;
}
