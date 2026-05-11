import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  DEFAULT_SETTINGS,
  getSettings,
  normalizeSettings,
  resetSettings,
  saveSettings,
  type ExtensionSettings,
} from "@/shared/lib/settings";
import { applyTheme, resolveTheme, watchSystemTheme, type ResolvedTheme } from "@/shared/lib/theme";

interface SettingsContextValue {
  loaded: boolean;
  resolvedTheme: ResolvedTheme;
  settings: ExtensionSettings;
  updateSetting: <Key extends keyof ExtensionSettings>(
    key: Key,
    value: ExtensionSettings[Key],
  ) => Promise<void>;
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>;
  resetAllSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const [loaded, setLoaded] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(DEFAULT_SETTINGS.theme),
  );
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let isMounted = true;

    void getSettings().then((nextSettings) => {
      if (!isMounted) {
        return;
      }

      setSettings(nextSettings);
      setLoaded(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return;
    }

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes) => {
      const updates = Object.fromEntries(
        Object.entries(changes).map(([key, change]) => [key, change.newValue]),
      ) as Partial<ExtensionSettings>;

      if (Object.keys(updates).length === 0) {
        return;
      }

      setSettings((current) =>
        normalizeSettings({
          ...current,
          ...updates,
        }),
      );
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const syncTheme = () => {
      setResolvedTheme(applyTheme(settings.theme));
    };

    syncTheme();

    if (settings.theme !== "auto") {
      return;
    }

    return watchSystemTheme(syncTheme);
  }, [loaded, settings.theme]);

  const updateSetting = useCallback(
    async <Key extends keyof ExtensionSettings>(key: Key, value: ExtensionSettings[Key]) => {
      const updates = { [key]: value } as Partial<ExtensionSettings>;
      setSettings((current) =>
        normalizeSettings({
          ...current,
          ...updates,
        }),
      );
      await saveSettings(updates);
    },
    [],
  );

  const updateSettings = useCallback(
    async (updates: Partial<ExtensionSettings>) => {
      setSettings((current) =>
        normalizeSettings({
          ...current,
          ...updates,
        }),
      );
      await saveSettings(updates);
    },
    [],
  );

  const resetAllSettings = useCallback(async () => {
    const defaults = await resetSettings();
    setSettings(defaults);
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      resolvedTheme,
      settings,
      updateSetting,
      updateSettings,
      resetAllSettings,
    }),
    [loaded, resetAllSettings, resolvedTheme, settings, updateSetting, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettingsContext must be used inside SettingsProvider");
  }

  return context;
}
