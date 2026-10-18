import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { currentLanguage, setLanguage } from "./index";
import type { LanguageCode } from "./languages";

/** Current language plus a setter that also saves the choice to the signed-in user's account. */
export function useLanguage() {
  const { i18n } = useTranslation(); // re-renders when the language changes
  const { user, setUser } = useAuth();
  const language = ((i18n.resolvedLanguage ?? currentLanguage()).split("-")[0] ?? "en") as LanguageCode;

  async function change(code: LanguageCode) {
    await setLanguage(code);
    if (user) {
      try {
        const { user: updated } = await api<{ user: typeof user }>("/profile/language", {
          method: "PATCH",
          body: { language: code },
        });
        setUser(updated);
      } catch {
        /* the on-device choice still applies; it will sync next time */
      }
    }
  }
  return { language, change };
}
