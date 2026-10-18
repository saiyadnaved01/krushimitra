/**
 * Weather service.
 *
 * By default it fetches a live 7-day forecast from Open-Meteo (free, no API
 * key). If the provider is unreachable, slow or returns something unexpected,
 * it falls back to deterministic sample data and says so via `source`
 * ("live" | "sample") so the UI can label it honestly.
 *
 * Set WEATHER_PROVIDER=sample to stay fully offline.
 */
import { config } from "../config.js";

export const WEATHER_LOCATIONS = {
  Pune: 0,
  Nashik: -2,
  Nagpur: 3,
  Kolhapur: -1,
  Solapur: 2,
  Satara: -1,
  Aurangabad: 1,
};
export const DEFAULT_LOCATION = "Pune";

export const COORDS = {
  Pune: [18.5204, 73.8567],
  Nashik: [19.9975, 73.7898],
  Nagpur: [21.1458, 79.0882],
  Kolhapur: [16.705, 74.2433],
  Solapur: [17.6599, 75.9064],
  Satara: [17.6805, 74.0183],
  Aurangabad: [19.8762, 75.3433],
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Find a supported location mentioned in a free-text profile location. */
export function resolveLocation(text) {
  const lower = String(text ?? "").toLowerCase();
  return Object.keys(WEATHER_LOCATIONS).find((name) => lower.includes(name.toLowerCase()));
}

/* ------------------------------ shared helpers ------------------------------ */

const dayLabel = (iso, i) => (i === 0 ? "Today" : DAY[new Date(`${iso}T12:00:00Z`).getUTCDay()]);

const uvCode = (uv) =>
  uv < 3 ? "low" : uv < 6 ? "moderate" : uv < 8 ? "high" : uv < 11 ? "very_high" : "extreme";

/** Language-neutral advice: the client turns these codes into translated text. */
function buildAdvice(forecast) {
  const rainyDay = forecast.find((f) => f.rain >= 60);
  const dry = forecast.slice(0, 3).every((f) => f.rain < 40);
  return {
    field: dry ? "dry" : "showers",
    rain: rainyDay ? { day: rainyDay.day === "Today" ? "today" : rainyDay.date } : null,
  };
}

/* ------------------------------ live provider ------------------------------ */

/** WMO weather code → icon type + short summary. */
export function describeCode(code) {
  if (code === 0) return { type: "sun", summary: "clear" };
  if (code === 1) return { type: "sun", summary: "mostly_sunny" };
  if (code === 2) return { type: "cloud", summary: "partly_cloudy" };
  if (code === 3) return { type: "cloud", summary: "overcast" };
  if (code === 45 || code === 48) return { type: "cloud", summary: "foggy" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { type: "rain", summary: "rain" };
  if (code >= 95) return { type: "rain", summary: "thunderstorm" };
  return { type: "cloud", summary: "cloudy" };
}

/** Convert an Open-Meteo response into our weather shape. Throws on unexpected data. */
export function fromOpenMeteo(location, data, now = new Date()) {
  const d = data?.daily;
  const c = data?.current;
  if (!d?.time?.length || !c) throw new Error("Unexpected weather response");

  const forecast = d.time.slice(0, 7).map((date, i) => ({
    day: dayLabel(date, i),
    date,
    temp: Math.round(d.temperature_2m_max[i]),
    low: Math.round(d.temperature_2m_min[i]),
    rain: Math.round(d.precipitation_probability_max?.[i] ?? 0),
    type: describeCode(d.weather_code[i]).type,
  }));
  const uv = Math.round(d.uv_index_max?.[0] ?? 0);

  return {
    location,
    source: "live",
    updatedAt: now.toISOString(),
    current: {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature ?? c.temperature_2m),
      summary: describeCode(c.weather_code).summary,
      humidity: Math.round(c.relative_humidity_2m),
      wind: Math.round(c.wind_speed_10m),
      uv,
      uvLevel: uvCode(uv),
      rainChance: forecast[0]?.rain ?? 0,
    },
    advice: buildAdvice(forecast),
    forecast,
  };
}

const CACHE_MS = 15 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60 * 1000;
const cache = new Map(); // location -> { at, value }
let lastFailure = 0;

async function fetchLive(location, fetchImpl) {
  const [lat, lon] = COORDS[location];
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max" +
    "&timezone=Asia%2FKolkata&forecast_days=7";
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Weather provider returned ${res.status}`);
  return fromOpenMeteo(location, await res.json());
}

/* ----------------------------- sample provider ----------------------------- */

const BASE_FORECAST = [
  { temp: 28, low: 21, rain: 10, type: "sun" },
  { temp: 29, low: 22, rain: 5, type: "sun" },
  { temp: 27, low: 21, rain: 30, type: "cloud" },
  { temp: 25, low: 20, rain: 70, type: "rain" },
  { temp: 26, low: 21, rain: 45, type: "rain" },
  { temp: 28, low: 22, rain: 15, type: "cloud" },
  { temp: 29, low: 22, rain: 5, type: "sun" },
];

export function sampleWeather(location, today = new Date()) {
  const adj = WEATHER_LOCATIONS[location];
  const forecast = BASE_FORECAST.map((f, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    return { day: dayLabel(date, i), date, temp: f.temp + adj, low: f.low + adj, rain: f.rain, type: f.type };
  });
  const first = forecast[0];
  return {
    location,
    source: "sample",
    updatedAt: today.toISOString(),
    current: {
      temp: first.temp,
      feelsLike: first.temp + 2,
      summary: "mostly_sunny",
      humidity: 65,
      wind: 12,
      uv: 6,
      uvLevel: "high",
      rainChance: first.rain,
    },
    advice: buildAdvice(forecast),
    forecast,
  };
}

/* --------------------------------- public API --------------------------------- */

export async function getWeather(requested, { fetchImpl = fetch, provider = config.weatherProvider } = {}) {
  const location = WEATHER_LOCATIONS[requested] !== undefined ? requested : DEFAULT_LOCATION;
  if (provider !== "open-meteo") return sampleWeather(location);

  const hit = cache.get(location);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  // After a failure, don't make every request wait for another timeout.
  if (Date.now() - lastFailure < FAILURE_BACKOFF_MS) return sampleWeather(location);

  try {
    const value = await fetchLive(location, fetchImpl);
    cache.set(location, { at: Date.now(), value });
    return value;
  } catch (err) {
    lastFailure = Date.now();
    console.warn(`[weather] live forecast unavailable (${err.message}); using sample data`);
    return sampleWeather(location);
  }
}

/** Test helper. */
export function resetWeatherCache() {
  cache.clear();
  lastFailure = 0;
}
