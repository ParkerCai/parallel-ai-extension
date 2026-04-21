export type ProviderId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "grok"
  | "deepseek"
  | "kimi"
  | "google";

export interface Provider {
  id: ProviderId;
  name: string;
  url: string;
  icon: string;
  iconDark: string;
  enabled: boolean;
}

export const PROVIDERS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    icon: "icons/providers/chatgpt.png",
    iconDark: "icons/providers/dark/chatgpt.png",
    enabled: true,
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    icon: "icons/providers/claude.png",
    iconDark: "icons/providers/dark/claude.png",
    enabled: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com",
    icon: "icons/providers/gemini.png",
    iconDark: "icons/providers/dark/gemini.png",
    enabled: true,
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com",
    icon: "icons/providers/grok.png",
    iconDark: "icons/providers/dark/grok.png",
    enabled: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    icon: "icons/providers/deepseek.png",
    iconDark: "icons/providers/dark/deepseek.png",
    enabled: true,
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://www.kimi.com",
    icon: "icons/providers/kimi.png",
    iconDark: "icons/providers/dark/kimi.png",
    enabled: true,
  },
  {
    id: "google",
    name: "Google",
    url: "https://www.google.com/search?udm=50",
    icon: "icons/providers/google.png",
    iconDark: "icons/providers/dark/google.png",
    enabled: true,
  },
] as const satisfies readonly Provider[];

export const ALL_PROVIDER_IDS = PROVIDERS.map((provider) => provider.id);

export function isProviderId(value: string): value is ProviderId {
  return ALL_PROVIDER_IDS.includes(value as ProviderId);
}

export function getProviderById(providerId: ProviderId) {
  return PROVIDERS.find((provider) => provider.id === providerId);
}

export function getOrderedProviders(order: ProviderId[] | null) {
  if (!order?.length) {
    return [...PROVIDERS];
  }

  const orderIndex = new Map(order.map((providerId, index) => [providerId, index]));

  return [...PROVIDERS].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);

    if (leftIndex === undefined && rightIndex === undefined) {
      return 0;
    }

    if (leftIndex === undefined) {
      return 1;
    }

    if (rightIndex === undefined) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

export async function getProviderByIdWithSettings(providerId: string) {
  const provider = PROVIDERS.find((candidate) => candidate.id === providerId);
  if (!provider) {
    return null;
  }

  if (provider.id !== "google") {
    return provider;
  }

  try {
    const { getSettings } = await import("@/shared/lib/settings");
    const { getGoogleProviderUrl } = await import("@/shared/lib/google-mode");
    const settings = await getSettings();

    return {
      ...provider,
      url: getGoogleProviderUrl(settings.googleProviderMode),
    } satisfies Provider;
  } catch {
    return provider;
  }
}

export async function getEnabledProviders() {
  try {
    const { getSettings } = await import("@/shared/lib/settings");
    const settings = await getSettings();
    const orderedProviders = getOrderedProviders(settings.providerOrder);
    return orderedProviders.filter((provider) => settings.enabledProviders.includes(provider.id));
  } catch {
    return [...PROVIDERS];
  }
}
