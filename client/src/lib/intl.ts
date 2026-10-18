import i18n from "@/i18n";

/** BCP-47 tag for Intl. Indian locales so digits, grouping and calendars match local convention. */
const INTL_TAG: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN", bn: "bn-IN",
  ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", or: "or-IN", as: "as-IN",
};

export function intlLocale(): string {
  const base = (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0] ?? "en";
  return INTL_TAG[base] ?? "en-IN";
}

/** Intl can throw for a locale a browser doesn't know; fall back to English rather than crash. */
function safe<T>(make: (tag: string) => T): T {
  try {
    return make(intlLocale());
  } catch {
    return make("en-IN");
  }
}

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) =>
  safe((tag) => new Intl.NumberFormat(tag, opts).format(n));

export const formatRupees = (n: number) =>
  formatNumber(n, { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatPercent = (n: number) => `${formatNumber(n)}%`;

const toDate = (d: Date | string) => (typeof d === "string" ? new Date(`${d.slice(0, 10)}T12:00:00`) : d);

export const formatDate = (d: Date | string, opts: Intl.DateTimeFormatOptions) =>
  safe((tag) => new Intl.DateTimeFormat(tag, opts).format(toDate(d)));

/** "12 Jun 2026" */
export const formatShortDate = (d: Date | string) =>
  formatDate(d, { day: "numeric", month: "short", year: "numeric" });

/** "June 2026" */
export const formatMonthYear = (d: Date | string) => formatDate(d, { month: "long", year: "numeric" });

/** Month name from a 1–12 number. */
export const monthName = (m: number, width: "short" | "long" = "short") =>
  formatDate(new Date(2024, m - 1, 15), { month: width });

/** "Oct, Nov" / "Oct–Dec" style list for a set of month numbers. */
export function formatMonths(months: number[]): string {
  if (!months.length) return "";
  const sorted = [...months].sort((a, b) => a - b);
  return safe((tag) => new Intl.ListFormat(tag, { style: "narrow", type: "unit" }).format(sorted.map((m) => monthName(m))));
}

/** "7:00 am" from "07:00". */
export function formatClock(hhmm: string): string {
  const [h = "0", m = "0"] = hhmm.split(":");
  return formatDate(new Date(2000, 0, 1, Number(h), Number(m)), { hour: "numeric", minute: "2-digit" });
}

/** Short weekday names, Monday first (calendar header). */
export const weekdayNames = (): string[] =>
  Array.from({ length: 7 }, (_, i) => formatDate(new Date(2024, 0, 1 + i), { weekday: "short" }));

export function formatRelative(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  return safe((tag) => {
    const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
    for (const [unit, secs] of steps) {
      if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
    }
    return rtf.format(0, "second");
  });
}
