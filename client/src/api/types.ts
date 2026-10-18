export type Role = "farmer" | "admin";
export type Soil = "Clay" | "Loamy" | "Sandy";

export interface Prefs {
  emailAlerts: boolean;
  weatherAlerts: boolean;
}

export interface User {
  id: number;
  role: Role;
  name: string;
  email: string;
  phone: string;
  location: string;
  land: number;
  soil: Soil;
  status: "Active" | "Inactive";
  joined: string;
  prefs: Prefs;
  state: string | null;
  soilPh: number | null;
  soilMoisture: Moisture | null;
  waterAvailability: WaterAvailability | null;
  language: string | null;
}

export type Moisture = "Dry" | "Moderate" | "Moist";
export type WaterAvailability = "Rainfed" | "Limited" | "Assured";

export type FactorKey = "soil" | "ph" | "temperature" | "water" | "season" | "region" | "moisture";
export type FactorStatus = "good" | "ok" | "poor" | "unknown";

export interface Factor {
  key: FactorKey;
  weight: number;
  score: number | null;
  status: FactorStatus;
  params: Record<string, unknown>;
}

export interface Span {
  min: number;
  max: number;
}
export interface Spacing {
  row: number[];
  plant: number[] | null;
}
export interface CropGuidance {
  sowing: {
    months: number[];
    method: "nursery_transplant" | "drill" | "dibbling" | "setts";
    seedRate: { min: number; max: number; unit: "kg_ha" | "setts_ha" } | null;
    spacing: Spacing | null;
  };
  harvest: { months: number[]; durationDays: [number, number]; indicator: string };
  irrigation: string;
  fertilizer: { n: Span; p: Span; k: Span; timing: string; extra: string | null } | null;
  temp: { min: number; optMin: number; optMax: number; max: number };
  ph: { min: number; optMin: number; optMax: number; max: number };
  waterMm: [number, number];
  states: string[];
}

export interface Crop {
  key: string;
  name: string; // English name as stored in saved crops / records
  imageKey: string;
  season: "Kharif" | "Rabi" | "Annual" | "All seasons";
  water: "High" | "Moderate" | "Low";
  soils: Record<Soil, "ideal" | "good" | "fair" | "poor">;
  match: number;
  confidence: number;
  suitability: "high" | "moderate" | "low";
  factors: Factor[];
  saved: boolean;
  growing: { months: number[]; startMonth: number; monthsUntilSowing: number };
  guidance: CropGuidance;
}

export interface CropsResponse {
  profile: {
    soil: Soil;
    ph: number | null;
    moisture: Moisture | null;
    waterAvailability: WaterAvailability | null;
    state: string | null;
    location: string;
  };
  climate: { available: boolean; place?: string; window?: { start: string; end: string } };
  missing: ("ph" | "moisture" | "waterAvailability" | "state" | "climate")[];
  sources: Record<string, string>;
  reviewed: boolean;
  crops: Crop[];
}

export interface PriceRow {
  id: number;
  crop: string;
  variety: string;
  market: string;
  price: number;
  change: number;
  date: string;
}
export type PriceInput = Pick<PriceRow, "crop" | "variety" | "market" | "price" | "date">;

export type TaskCategory = "Irrigation" | "Fertilizer" | "Inspection" | "Harvest";
export interface Task {
  id: number;
  title: string;
  crop: string;
  date: string;
  time: string;
  category: TaskCategory;
  done: boolean;
}
export type TaskInput = Omit<Task, "id" | "done">;

export interface AppNotification {
  id: number;
  title: string;
  text: string;
  type: string;
  read: boolean;
  createdAt: string;
  key: string | null;
  params: Record<string, unknown> | null;
}

export interface WeatherDay {
  day: string;
  date: string;
  temp: number;
  low: number;
  rain: number;
  type: "sun" | "cloud" | "rain";
}
export interface WeatherCurrent {
  temp: number;
  feelsLike: number;
  summary: string; // code, e.g. "partly_cloudy"
  humidity: number;
  wind: number;
  uv: number;
  uvLevel: string; // code, e.g. "high"
  rainChance: number;
}
export interface Weather {
  location: string;
  source: string;
  current: WeatherCurrent;
  advice: {
    field: "dry" | "showers";
    rain: { day: string } | null; // "today" or an ISO date
  };
  forecast: WeatherDay[];
}

export interface YieldPoint {
  month: string;
  actual: number;
  expected: number;
}
export interface Dashboard {
  stats: {
    area: number;
    activeFields: number;
    estimatedYield: number;
    yieldChange: number | null;
    estimatedRevenue: number;
    revenueChange: number | null;
  };
  yields: YieldPoint[];
  weather: { location: string; source: string; current: WeatherCurrent; advice: string };
}

export interface FertilizerPlan {
  crop: string;
  areaAcres: number;
  nutrients: { key: "N" | "P2O5" | "K2O"; perHa: Span; total: Span }[] | null;
  timing: string;
  extra: string | null;
  source: string;
  reviewed: boolean;
}

export interface DiseaseResult {
  illustrative: boolean;
  analyzed: boolean;
  condition: string; // code, e.g. "early_blight"
}

/* ------------------------------- admin ------------------------------- */

export interface AdminFarmer {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  land: number;
  soil: Soil;
  status: "Active" | "Inactive";
  joined: string;
  canSignIn: boolean;
}
export interface AdminFarmerInput {
  name: string;
  email: string;
  location: string;
  land: number;
  soil: Soil;
  password?: string;
}

export interface Metric {
  value: number;
  change: number | null;
}
export interface AdminStats {
  registeredFarmers: Metric;
  recommendations: Metric;
  activeArea: Metric;
  marketRecords: { value: number; markets: number };
  registrations: { month: string; farmers: number }[];
  distribution: { name: string; count: number; value: number }[];
  recentFarmers: AdminFarmer[];
}

export interface RecordRow {
  id: string;
  recordId: number;
  farmer: string;
  crop: string;
  match: number;
  soil: string;
  date: string;
  status: "Pending" | "Reviewed";
}

export interface ReportPeriod {
  value: string;
  label: string;
}
export type ReportType = "farmers" | "market" | "yield";
export interface Report {
  rows: Record<string, unknown>[];
  chart?: YieldPoint[];
}
