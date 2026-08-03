export type ProviderId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "grok"
  | "deepseek"
  | "kimi"
  | "qwen"
  | "meta"
  | "thinkingmachines"
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
    icon: "icons/providers/chatgpt.svg",
    iconDark: "icons/providers/dark/chatgpt.svg",
    enabled: true,
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    icon: "icons/providers/claude.svg",
    iconDark: "icons/providers/dark/claude.svg",
    enabled: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com",
    icon: "icons/providers/gemini.svg",
    iconDark: "icons/providers/dark/gemini.svg",
    enabled: true,
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com",
    icon: "icons/providers/grok.svg",
    iconDark: "icons/providers/dark/grok.svg",
    enabled: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    icon: "icons/providers/deepseek.svg",
    iconDark: "icons/providers/dark/deepseek.svg",
    enabled: true,
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://www.kimi.com",
    icon: "icons/providers/kimi.svg",
    iconDark: "icons/providers/dark/kimi.svg",
    enabled: true,
  },
  {
    id: "qwen",
    name: "Qwen",
    url: "https://chat.qwen.ai/",
    icon: "icons/providers/qwen.svg",
    iconDark: "icons/providers/dark/qwen.svg",
    enabled: true,
  },
  {
    id: "meta",
    name: "Meta AI",
    url: "https://www.meta.ai/",
    icon: "icons/providers/meta.svg",
    iconDark: "icons/providers/dark/meta.svg",
    enabled: true,
  },
  {
    id: "thinkingmachines",
    name: "Thinking Machines",
    url: "https://tinker.thinkingmachines.ai/playground",
    icon: "icons/providers/thinkingmachines.svg",
    iconDark: "icons/providers/dark/thinkingmachines.svg",
    enabled: true,
  },
  {
    id: "google",
    name: "Google",
    url: "https://www.google.com/search?udm=50",
    icon: "icons/providers/google.svg",
    iconDark: "icons/providers/dark/google.svg",
    enabled: true,
  },
] as const satisfies readonly Provider[];

/** A provider's brand accent, tuned per theme. */
export interface ProviderColor {
  /** Accent for light surfaces (the provider's primary brand color). */
  light: string;
  /**
   * Accent for dark surfaces. Equal to `light` for colored brands; lightened
   * for near-black brands (ChatGPT, Grok) so they stay visible on dark UI.
   */
  dark: string;
}

/**
 * Per-provider brand accent colors. Used to give each pane / usage bar its own
 * identity instead of the generic `--accent-cool`. Where a brand has no strong
 * color of its own, a distinct hue is chosen so no two providers collide.
 */
export const PROVIDER_COLORS = {
  claude: { light: "#D97757", dark: "#D97757" }, // Anthropic clay orange
  chatgpt: { light: "#202123", dark: "#ECECEC" }, // OpenAI charcoal / near-white on dark
  gemini: { light: "#8E75E8", dark: "#A990FF" }, // Gemini blue-violet gradient
  grok: { light: "#1A1A1A", dark: "#E5E5E5" }, // xAI black / near-white on dark
  deepseek: { light: "#4D6BFE", dark: "#6D85FF" }, // DeepSeek blue
  kimi: { light: "#6E5BFF", dark: "#8E7CFF" }, // Moonshot indigo
  qwen: { light: "#615CED", dark: "#8481FF" }, // Alibaba Qwen purple
  meta: { light: "#0866FF", dark: "#4C8DFF" }, // Meta blue
  thinkingmachines: { light: "#0EA5A5", dark: "#2DD4BF" }, // teal (no strong brand color)
  google: { light: "#4285F4", dark: "#6BA1FF" }, // Google blue
} as const satisfies Record<ProviderId, ProviderColor>;

/** Brand accent for a provider, defaulting to the light variant. */
export function getProviderColor(
  providerId: ProviderId,
  theme: "light" | "dark" = "light",
): string {
  return PROVIDER_COLORS[providerId][theme];
}

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
