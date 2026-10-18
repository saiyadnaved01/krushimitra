/** Supported UI languages. `native` is shown in the selector so people can find their own language. */
export const LANGUAGES = [
  { code: "en", native: "English", name: "English" },
  { code: "hi", native: "हिन्दी", name: "Hindi" },
  { code: "mr", native: "मराठी", name: "Marathi" },
  { code: "gu", native: "ગુજરાતી", name: "Gujarati" },
  { code: "pa", native: "ਪੰਜਾਬੀ", name: "Punjabi" },
  { code: "bn", native: "বাংলা", name: "Bengali" },
  { code: "ta", native: "தமிழ்", name: "Tamil" },
  { code: "te", native: "తెలుగు", name: "Telugu" },
  { code: "kn", native: "ಕನ್ನಡ", name: "Kannada" },
  { code: "ml", native: "മലയാളം", name: "Malayalam" },
  { code: "or", native: "ଓଡ଼ିଆ", name: "Odia" },
  { code: "as", native: "অসমীয়া", name: "Assamese" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LanguageCode[];
export const DEFAULT_LANGUAGE: LanguageCode = "en";
export const LANGUAGE_STORAGE_KEY = "krushimitra.lang";

export const isLanguage = (v: unknown): v is LanguageCode =>
  typeof v === "string" && (LANGUAGE_CODES as string[]).includes(v);
