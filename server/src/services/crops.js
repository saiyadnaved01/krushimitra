/** Crop catalogue accessors. The data itself lives in ../data/crops.js. */
import { CROPS, SOIL_RATING_SCORE } from "../data/crops.js";

export const SOILS = ["Clay", "Loamy", "Sandy"];
export const SEASONS = ["Kharif", "Rabi", "Annual", "All seasons"];
export const MOISTURE_LEVELS = ["Dry", "Moderate", "Moist"];
export const WATER_AVAILABILITY = ["Rainfed", "Limited", "Assured"];

export const CROP_CATALOG = CROPS;
export const CROP_NAMES = CROPS.map((c) => c.key);

/** Look up by key ("rice") or by the English display name used in older records ("Rice"). */
export function findCrop(nameOrKey) {
  const k = String(nameOrKey ?? "").toLowerCase();
  return CROPS.find((c) => c.key === k);
}

/** English display name — used only for stored records and exports; the UI translates by key. */
export const englishName = (crop) => crop.key[0].toUpperCase() + crop.key.slice(1);

/** Soil-only suitability (0–100). Used for admin records, where only the farmer's soil is known. */
export function matchFor(crop, soil) {
  const rating = crop.soils[soil];
  return rating ? Math.round(SOIL_RATING_SCORE[rating] * 100) : 0;
}
