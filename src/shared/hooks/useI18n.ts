import { useEffect, useMemo, useState } from "react";

import { getCurrentLanguage, getSupportedLanguages, initializeLanguage, t } from "@/shared/lib/i18n";

export function useI18n(preferredLanguage: string | null) {
  const [locale, setLocale] = useState(getCurrentLanguage());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void initializeLanguage(preferredLanguage).then((nextLocale) => {
      if (cancelled) {
        return;
      }

      setLocale(nextLocale);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [preferredLanguage]);

  return useMemo(
    () => ({
      locale,
      ready,
      supportedLanguages: getSupportedLanguages(),
      t: (key: string, fallback: string, substitutions?: string | string[] | null) => {
        const translated = t(key, substitutions);
        return translated === key ? fallback : translated;
      },
    }),
    [locale, ready],
  );
}
