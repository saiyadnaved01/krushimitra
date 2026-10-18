/**
 * Observed local climate for crop suitability.
 *
 * Uses Open-Meteo's free historical-weather API to get the last 12 complete months of daily mean
 * temperature and rainfall for the farmer's location, summarised per calendar month. If the
 * location can't be resolved or the service is unavailable this returns null — callers must treat
 * the climate factors as "unknown" rather than guessing.
 *
 * Coordinates: the supported towns have fixed coordinates; any other place is looked up with
 * Open-Meteo's geocoding API (India only, matched against the farmer's state when known).
 */
import { config } from "../config.js";
import { COORDS } from "./weather.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const climateCache = new Map(); // "lat,lon" -> { at, value }
const geoCache = new Map(); // "name|state" -> { at, value }
const CLIMATE_TTL = 24 * DAY_MS;
const GEO_TTL = 30 * DAY_MS;
const FAILURE_BACKOFF = 5 * 60 * 1000;
let lastFailure = 0;

const clean = (s) => String(s ?? "").normalize("NFKD").replace(/[^\p{L}\s.-]/gu, " ").trim();

/** Candidate place names from "Village, Taluka, District, State": most specific first. */
function placeNames(location, state) {
  const parts = String(location ?? "")
    .split(",")
    .map(clean)
    .filter((p) => p.length >= 3 && p.toLowerCase() !== String(state ?? "").toLowerCase());
  return [...new Set(parts)].slice(0, 3);
}

export async function resolveCoordinates(location, state, fetchImpl = fetch) {
  const lower = String(location ?? "").toLowerCase();
  for (const [town, ll] of Object.entries(COORDS)) {
    if (lower.includes(town.toLowerCase())) return { lat: ll[0], lon: ll[1], place: town };
  }
  for (const name of placeNames(location, state)) {
    const key = `${name.toLowerCase()}|${state ?? ""}`;
    const hit = geoCache.get(key);
    if (hit && Date.now() - hit.at < GEO_TTL) {
      if (hit.value) return hit.value;
      continue;
    }
    const url =
      "https://geocoding-api.open-meteo.com/v1/search" +
      `?name=${encodeURIComponent(name)}&count=10&language=en&format=json&countryCode=IN`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Geocoding returned ${res.status}`);
    const results = (await res.json())?.results ?? [];
    const match =
      results.find((r) => state && r.admin1?.toLowerCase() === state.toLowerCase()) ??
      (state ? null : results[0]);
    const value = match ? { lat: match.latitude, lon: match.longitude, place: match.name } : null;
    geoCache.set(key, { at: Date.now(), value });
    if (value) return value;
  }
  return null;
}

/** Summarise daily data into per-calendar-month mean temperature and total rainfall. */
export function summariseMonthly(daily) {
  const buckets = new Map(); // month 1-12 -> { tSum, tN, rain, days }
  daily.time.forEach((date, i) => {
    const m = Number(date.slice(5, 7));
    const b = buckets.get(m) ?? { tSum: 0, tN: 0, rain: 0, days: 0 };
    const t = daily.temperature_2m_mean?.[i];
    const r = daily.precipitation_sum?.[i];
    if (typeof t === "number") {
      b.tSum += t;
      b.tN += 1;
    }
    if (typeof r === "number") b.rain += r;
    b.days += 1;
    buckets.set(m, b);
  });
  const monthly = {};
  for (let m = 1; m <= 12; m++) {
    const b = buckets.get(m);
    // Only trust months with nearly full coverage.
    monthly[m] =
      b && b.tN >= 25
        ? { tempC: Math.round((b.tSum / b.tN) * 10) / 10, rainMm: Math.round(b.rain) }
        : null;
  }
  return monthly;
}

const iso = (d) => d.toISOString().slice(0, 10);

/** The last 12 complete calendar months, ending before the current month. */
export function archiveWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: iso(start), end: iso(end) };
}

/**
 * @returns {Promise<null | {source: "live", place: string, window: {start, end}, monthly: Record<number, {tempC, rainMm}|null>}>}
 */
export async function getClimate(
  { location, state },
  { fetchImpl = fetch, provider = config.weatherProvider, now = new Date() } = {},
) {
  if (provider !== "open-meteo") return null;
  if (Date.now() - lastFailure < FAILURE_BACKOFF) return null;
  try {
    const coords = await resolveCoordinates(location, state, fetchImpl);
    if (!coords) return null;
    const key = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;
    const hit = climateCache.get(key);
    if (hit && Date.now() - hit.at < CLIMATE_TTL) return hit.value;

    const { start, end } = archiveWindow(now);
    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${start}&end_date=${end}` +
      "&daily=temperature_2m_mean,precipitation_sum&timezone=Asia%2FKolkata";
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Climate provider returned ${res.status}`);
    const daily = (await res.json())?.daily;
    if (!daily?.time?.length) throw new Error("Unexpected climate response");

    const value = {
      source: "live",
      place: coords.place,
      window: { start, end },
      monthly: summariseMonthly(daily),
    };
    climateCache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    lastFailure = Date.now();
    console.warn(`[climate] unavailable (${err.message}); climate factors will be skipped`);
    return null;
  }
}

/** Test helper. */
export function resetClimateCache() {
  climateCache.clear();
  geoCache.clear();
  lastFailure = 0;
}
