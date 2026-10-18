import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";
import { useLanguage } from "@/i18n/useLanguage";

export function LanguageSelector({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const { language, change } = useLanguage();
  return (
    <label className={`language-select flex items-center gap-2 ${className}`}>
      <Globe size={15} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        value={language}
        onChange={(e) => void change(e.target.value as LanguageCode)}
        className="min-h-0! w-auto! cursor-pointer border-0! bg-transparent! py-1! pr-6! text-xs!"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
