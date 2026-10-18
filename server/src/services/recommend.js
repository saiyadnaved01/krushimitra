/**
 * Crop suitability engine.
 *
 * Each crop is scored 0–1 on up to seven factors using the farmer's own inputs and observed local
 * climate. A factor with no data is "unknown" and is left out — the match % is the weighted average
 * of the factors that could be evaluated, and `confidence` says how much of the total weight that
 * was, so missing data lowers confidence instead of being silently assumed.
 *
 * Weights and the soil/moisture rating tables are agronomic rules of thumb (documented in
 * data/crops.js); the ranges they are compared with are the referenced published values.
 * Every factor returns language-neutral codes + numbers; the client writes the explanation.
 */
import { SOIL_RATING_SCORE } from "../data/crops.js";
import { CROP_CATALOG } from "./crops.js";

export const WEIGHTS = { soil: 25, temperature: 20, water: 20, ph: 15, season: 10, region: 5, moisture: 5 };

/** 1 inside [optMin, optMax], falling linearly to 0 at the absolute min / max. */
export function trapezoid(x, { min, optMin, optMax, max }) {
  if (x >= optMin && x <= optMax) return 1;
  if (x <= min || x >= max) return 0;
  return x < optMin ? (x - min) / (optMin - min) : (max - x) / (max - optMax);
}

const status = (score) => (score >= 0.75 ? "good" : score >= 0.45 ? "ok" : "poor");
const round2 = (n) => Math.round(n * 100) / 100;

/** Months a crop would be in the field if sown at the next opportunity (today counts). */
export function growingMonths(crop, now = new Date()) {
  const current = now.getUTCMonth() + 1;
  let start = current;
  let offset = 0;
  while (offset < 12 && !crop.sowMonths.includes(start)) {
    start = (start % 12) + 1;
    offset += 1;
  }
  const length = Math.min(12, Math.max(1, Math.round((crop.durationDays[0] + crop.durationDays[1]) / 2 / 30)));
  const months = Array.from({ length }, (_, i) => ((start - 1 + i) % 12) + 1);
  return { months, startMonth: start, monthsUntilSowing: offset };
}

const MOISTURE_FIT = {
  High: { Moist: 1, Moderate: 0.7, Dry: 0.3 },
  Moderate: { Moderate: 1, Moist: 0.8, Dry: 0.5 },
  Low: { Dry: 1, Moderate: 0.8, Moist: 0.5 },
};
const IRRIGATION_SCORE = { Assured: 0.95, Limited: 0.6, Rainfed: 0 };

/**
 * @param crop   an entry from data/crops.js
 * @param ctx    { soil, ph, moisture, waterAvailability, state, climate, now }
 */
export function scoreCrop(crop, ctx) {
  const { soil, ph = null, moisture = null, waterAvailability = null, state = null, climate = null } = ctx;
  const now = ctx.now ?? new Date();
  const factors = [];
  const add = (key, score, params = {}) =>
    factors.push({
      key,
      weight: WEIGHTS[key],
      score: score == null ? null : round2(score),
      status: score == null ? "unknown" : status(score),
      params,
    });

  // 1. Soil type
  const rating = crop.soils[soil];
  add("soil", rating ? SOIL_RATING_SCORE[rating] : null, { soil, rating: rating ?? null });

  // 2. Soil pH (only when the farmer provided it)
  if (ph == null) add("ph", null);
  else add("ph", trapezoid(ph, crop.ph), { ph, optMin: crop.ph.optMin, optMax: crop.ph.optMax });

  // Climate over the months this crop would actually be growing
  const grow = growingMonths(crop, now);
  const observed = climate
    ? grow.months.map((m) => climate.monthly[m]).filter(Boolean)
    : [];
  const haveClimate = observed.length >= Math.ceil(grow.months.length * 0.75);
  const meanTemp = haveClimate
    ? Math.round((observed.reduce((s, o) => s + o.tempC, 0) / observed.length) * 10) / 10
    : null;
  const rainMm = haveClimate ? observed.reduce((s, o) => s + o.rainMm, 0) : null;

  // 3. Temperature
  if (meanTemp == null) add("temperature", null);
  else add("temperature", trapezoid(meanTemp, crop.temp), { meanTemp, optMin: crop.temp.optMin, optMax: crop.temp.optMax });

  // 4. Water: observed rainfall in the growing months plus irrigation the farmer has
  const [needMin, needMax] = crop.waterMm;
  let water = null;
  let excess = false;
  if (rainMm != null) {
    const coverage = Math.min(rainMm / needMin, 1);
    water = waterAvailability ? Math.max(coverage, IRRIGATION_SCORE[waterAvailability]) : coverage;
    if (rainMm > needMax * 1.5) {
      water *= 0.75;
      excess = true;
    }
  } else if (waterAvailability === "Assured") water = 0.9;
  else if (waterAvailability === "Limited") water = 0.6;
  add("water", water, { rainMm, needMin, needMax, availability: waterAvailability, need: crop.water, excess });

  // 5. Season: is it sowing time?
  const seasonScore = grow.monthsUntilSowing === 0 ? 1 : grow.monthsUntilSowing <= 2 ? 0.8 : 0.5;
  add("season", seasonScore, {
    monthsUntil: grow.monthsUntilSowing,
    sowMonths: crop.sowMonths,
    season: crop.season,
  });

  // 6. Region: is it a major crop in the farmer's state?
  if (!state) add("region", null);
  else add("region", crop.states.includes(state) ? 1 : 0.4, { state, major: crop.states.includes(state) });

  // 7. Soil moisture (only when provided)
  if (!moisture) add("moisture", null);
  else add("moisture", MOISTURE_FIT[crop.water][moisture], { moisture, need: crop.water });

  const known = factors.filter((f) => f.score != null);
  const weightKnown = known.reduce((s, f) => s + f.weight, 0);
  const match = Math.round((known.reduce((s, f) => s + f.weight * f.score, 0) / weightKnown) * 100);

  return {
    match,
    confidence: Math.round(weightKnown), // % of total factor weight that had data (weights sum to 100)
    suitability: match >= 75 ? "high" : match >= 55 ? "moderate" : "low",
    factors,
    grow,
  };
}

/** Rank every crop in the catalogue, best first. */
export function rankCrops(ctx) {
  return CROP_CATALOG.map((crop) => ({ crop, ...scoreCrop(crop, ctx) })).sort(
    (a, b) => b.match - a.match || b.confidence - a.confidence || a.crop.key.localeCompare(b.crop.key),
  );
}

/** Which optional inputs would make the ranking more accurate. */
export function missingInputs({ ph, moisture, waterAvailability, state, climate }) {
  return [
    ph == null && "ph",
    !moisture && "moisture",
    !waterAvailability && "waterAvailability",
    !state && "state",
    !climate && "climate",
  ].filter(Boolean);
}
