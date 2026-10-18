/**
 * Fertilizer guidance from published per-hectare recommendations (see data/crops.js).
 * Nothing here is estimated: a crop without a single defensible national range (cotton,
 * sugarcane) returns no quantities and tells the farmer to follow their state recommendation.
 * Quantities are converted from kg/ha to the farmer's area with 1 ha = 2.4710538 acres.
 */
import { SOURCES } from "../data/crops.js";
import { findCrop } from "./crops.js";

export const ACRES_PER_HECTARE = 2.4710538;
const round1 = (n) => Math.round(n * 10) / 10;

export function buildPlan({ crop: cropKey, areaAcres }) {
  const crop = findCrop(cropKey);
  if (!crop) return null;
  const hectares = areaAcres / ACRES_PER_HECTARE;
  const f = crop.fertilizer;

  const scale = (r) => ({ min: round1(r.min * hectares), max: round1(r.max * hectares) });
  return {
    crop: crop.key,
    areaAcres,
    nutrients: f
      ? [
          { key: "N", perHa: f.n, total: scale(f.n) },
          { key: "P2O5", perHa: f.p, total: scale(f.p) },
          { key: "K2O", perHa: f.k, total: scale(f.k) },
        ]
      : null,
    timing: f ? f.timing : "follow_local",
    extra: f?.extra ?? null,
    source: SOURCES.packages,
    reviewed: false,
  };
}
