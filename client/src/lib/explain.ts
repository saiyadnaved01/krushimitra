import type { TFunction } from "i18next";
import type { Crop, Factor } from "@/api/types";
import { cropLabel } from "./cropLabel";
import { formatMonths, formatNumber } from "./intl";

/** "120–150" or "60" for a min/max pair. */
export const formatRange = (min: number, max: number) =>
  min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`;

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

/** Plain-language, translated sentence(s) explaining one suitability factor for one crop. */
export function explainFactor(t: TFunction, crop: Crop, f: Factor): string {
  const name = cropLabel(t, crop.key);
  const p = f.params;
  const base = { crop: name };

  switch (f.key) {
    case "soil":
      return p.rating
        ? t(`explain.soil.${String(p.rating)}`, { ...base, soil: t(`soil.${String(p.soil)}`) })
        : t("explain.soil.unknown");

    case "ph":
      return f.status === "unknown"
        ? t("explain.ph.unknown")
        : t(`explain.ph.${f.status}`, {
            ...base,
            ph: formatNumber(num(p.ph)),
            min: formatNumber(num(p.optMin)),
            max: formatNumber(num(p.optMax)),
          });

    case "temperature":
      return f.status === "unknown"
        ? t("explain.temperature.unknown")
        : t(`explain.temperature.${f.status}`, {
            ...base,
            temp: formatNumber(num(p.meanTemp)),
            min: formatNumber(num(p.optMin)),
            max: formatNumber(num(p.optMax)),
          });

    case "water": {
      if (f.status === "unknown") return t("explain.water.unknown");
      const parts = [
        t(`explain.water.${f.status}`, { ...base, min: formatNumber(num(p.needMin)), max: formatNumber(num(p.needMax)) }),
      ];
      if (p.rainMm != null) parts.push(t("explain.water.rainInfo", { rain: formatNumber(num(p.rainMm)) }));
      if (p.excess) parts.push(t("explain.water.excess"));
      return parts.join(" ");
    }

    case "season": {
      const until = num(p.monthsUntil);
      const when = until === 0 ? "now" : until <= 2 ? "soon" : "later";
      return t(`explain.season.${when}`, { ...base, window: formatMonths(p.sowMonths as number[]) });
    }

    case "region":
      return f.status === "unknown"
        ? t("explain.region.unknown")
        : t(p.major ? "explain.region.good" : "explain.region.poor", { ...base, state: String(p.state) });

    case "moisture":
      return f.status === "unknown"
        ? t("explain.moisture.unknown")
        : t(`explain.moisture.${f.status}`, { ...base, moisture: t(`moisture.${String(p.moisture)}`) });
  }
}
