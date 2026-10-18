import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isLanguage, type LanguageCode } from "./languages";

// Every non-English language is its own chunk, fetched the first time it is needed.
const loaders = import.meta.glob<{ default: Record<string, unknown> }>("./locales/*.json");

async function loadLanguage(code: LanguageCode) {
  if (code === "en" || i18n.hasResourceBundle(code, "translation")) return;
  const load = loaders[`./locales/${code}.json`];
  if (!load) return;
  const mod = await load();
  i18n.addResourceBundle(code, "translation", mod.default, true, true);
}

function applyDocumentLanguage(code: string) {
  document.documentElement.lang = code;
  document.documentElement.dir = "ltr"; // all supported languages are left-to-right
}

/** Change the UI language (loading its strings first) and remember the choice on this device. */
export async function setLanguage(code: LanguageCode) {
  await loadLanguage(code);
  await i18n.changeLanguage(code);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* private mode — the choice lasts for this session only */
  }
}

export function currentLanguage(): LanguageCode {
  const base = (i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LANGUAGE).split("-")[0];
  return isLanguage(base) ? base : DEFAULT_LANGUAGE;
}

export const i18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: DEFAULT_LANGUAGE, // a missing key shows English rather than a raw key
    supportedLngs: ["en", "hi", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or", "as"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: [], // we write the preference ourselves in setLanguage()
    },
    returnNull: false,
  })
  .then(async () => {
    // The detector may have picked a language whose strings aren't loaded yet.
    const code = currentLanguage();
    await loadLanguage(code);
    await i18n.changeLanguage(code);
    applyDocumentLanguage(code);
  });

i18n.on("languageChanged", (lng) => applyDocumentLanguage(lng.split("-")[0] ?? DEFAULT_LANGUAGE));

export default i18n;
