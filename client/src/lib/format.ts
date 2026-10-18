import { parseISO } from "date-fns";
import { format } from "date-fns";

export { formatRupees as rupees, formatShortDate as shortDate, formatClock as clockTime } from "./intl";

/** Local calendar date as YYYY-MM-DD (an <input type="date"> value, not for display). */
export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const parseDate = parseISO;

/** Time-of-day bucket; the translated greeting is chosen by the caller. */
export function dayPart(now = new Date()): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
export const DAY_PART_EMOJI = { morning: "☀️", afternoon: "🌤️", evening: "🌙" } as const;

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
