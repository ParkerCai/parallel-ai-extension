import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import {
  getCurrentLanguage,
  getSupportedLanguages,
  initializeLanguage,
  tx,
} from "@/shared/lib/i18n";

interface I18nContextValue {
  locale: string;
  ready: boolean;
  supportedLanguages: ReturnType<typeof getSupportedLanguages>;
  t: (key: string, fallback: string, substitutions?: string | string[] | null) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const { settings } = useSettingsContext();
  const [locale, setLocale] = useState(getCurrentLanguage());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void initializeLanguage(settings.language).then((nextLocale) => {
      if (cancelled) {
        return;
      }

      setLocale(nextLocale);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [settings.language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      ready,
      supportedLanguages: getSupportedLanguages(),
      t: (key, fallback, substitutions) => tx(key, fallback, substitutions),
    }),
    [locale, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useTranslation must be used inside I18nProvider");
  }

  return context;
}
