import { useLocales } from "expo-localization";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";

import { i18n, normalizeLanguageCode } from "@/localization/i18n";

export function LocalizationProvider({ children }: PropsWithChildren) {
  const locales = useLocales();
  const language = normalizeLanguageCode(locales[0]?.languageCode);

  useEffect(() => {
    if (i18n.resolvedLanguage !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

