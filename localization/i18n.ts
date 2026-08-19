import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { de, en, es, fr } from "@/localization/resources";

const i18n = createInstance();

export const supportedLanguageCodes = ["en", "de", "fr", "es"] as const;
export type SupportedLanguageCode = (typeof supportedLanguageCodes)[number];

export function normalizeLanguageCode(
  languageCode: string | null | undefined,
): SupportedLanguageCode {
  const normalized = languageCode?.toLowerCase().split("-")[0];
  return supportedLanguageCodes.includes(normalized as SupportedLanguageCode)
    ? (normalized as SupportedLanguageCode)
    : "en";
}

export function getDeviceLanguage(): SupportedLanguageCode {
  return normalizeLanguageCode(getLocales()[0]?.languageCode);
}

void i18n.use(initReactI18next).init({
  fallbackLng: "en",
  initImmediate: false,
  interpolation: { escapeValue: false },
  keySeparator: false,
  lng: getDeviceLanguage(),
  nsSeparator: false,
  resources: {
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
  },
  returnNull: false,
  supportedLngs: supportedLanguageCodes,
});

export { i18n };
