/**
 * Crop knowledge base.
 *
 * IMPORTANT — provenance and limits
 * ---------------------------------
 * These are general, published reference ranges, not site-specific advice:
 *   temp / ph      FAO EcoCrop database (approximate optimal and absolute ranges)
 *   waterMm        FAO Irrigation & Drainage Paper 24/56 — typical total crop water need per season
 *                  (rice: IRRI/FAO, includes land preparation and percolation)
 *   calendar       Indian crop calendars from ICAR / Ministry of Agriculture & Farmers Welfare
 *                  (sowing = sowing or transplanting window in typical Indian conditions)
 *   states         states where the crop is a major crop in Ministry of Agriculture statistics
 *   fertilizer     typical ICAR / state-agricultural-university package-of-practices doses, kg/ha
 *   sowing         typical seed rates and spacing from the same packages
 *
 * A value is left OUT (null) whenever recommendations vary too widely by state or variety to state
 * one range honestly (e.g. cotton and sugarcane fertilizer, several seed rates). This file was
 * assembled without live access to those sources, so `reviewed` stays false until an agronomist
 * checks it against your state's package of practices. Soil-type ratings and water-need classes
 * are agronomic rules of thumb, not measured data.
 *
 * Months are 1–12. Fertilizer values are kg of nutrient per hectare.
 */

export const SOURCES = {
  ecocrop: "FAO EcoCrop (ecocrop.review.fao.org)",
  fao: "FAO Irrigation and Drainage Papers 24 and 56",
  calendar: "ICAR / Ministry of Agriculture & Farmers Welfare crop calendars",
  packages: "ICAR / state agricultural university packages of practices",
};

const range = (min, max = min) => ({ min, max });

export const CROPS = [
  {
    key: "rice",
    season: "Kharif",
    water: "High",
    soils: { Clay: "ideal", Loamy: "good", Sandy: "poor" },
    temp: { min: 15, optMin: 20, optMax: 30, max: 36 },
    ph: { min: 5.0, optMin: 5.5, optMax: 7.0, max: 8.0 },
    waterMm: [900, 2500],
    sowMonths: [6, 7],
    harvestMonths: [10, 11],
    durationDays: [110, 150],
    states: ["West Bengal", "Uttar Pradesh", "Punjab", "Odisha", "Andhra Pradesh", "Telangana", "Tamil Nadu", "Bihar", "Chhattisgarh", "Assam", "Karnataka", "Maharashtra", "Kerala", "Haryana", "Jharkhand"],
    sowing: { method: "nursery_transplant", seedRate: null, spacing: { row: [20], plant: [15] } },
    irrigation: "rice",
    harvest: "rice",
    fertilizer: { n: range(100, 120), p: range(50, 60), k: range(40, 50), timing: "n_three_splits", extra: null },
  },
  {
    key: "wheat",
    season: "Rabi",
    water: "Moderate",
    soils: { Loamy: "ideal", Clay: "good", Sandy: "fair" },
    temp: { min: 5, optMin: 12, optMax: 25, max: 32 },
    ph: { min: 5.5, optMin: 6.0, optMax: 7.5, max: 8.5 },
    waterMm: [450, 650],
    sowMonths: [10, 11],
    harvestMonths: [3, 4],
    durationDays: [110, 140],
    states: ["Uttar Pradesh", "Punjab", "Haryana", "Madhya Pradesh", "Rajasthan", "Bihar", "Gujarat", "Maharashtra"],
    sowing: { method: "drill", seedRate: { min: 100, max: 125, unit: "kg_ha" }, spacing: { row: [20, 22.5], plant: null } },
    irrigation: "wheat",
    harvest: "wheat",
    fertilizer: { n: range(120, 150), p: range(60), k: range(40), timing: "n_two_splits", extra: null },
  },
  {
    key: "maize",
    season: "Kharif",
    water: "Moderate",
    soils: { Loamy: "ideal", Clay: "fair", Sandy: "fair" },
    temp: { min: 10, optMin: 18, optMax: 30, max: 38 },
    ph: { min: 5.0, optMin: 5.8, optMax: 7.0, max: 8.0 },
    waterMm: [500, 800],
    sowMonths: [6, 7],
    harvestMonths: [9, 10],
    durationDays: [90, 115],
    states: ["Karnataka", "Maharashtra", "Madhya Pradesh", "Bihar", "Telangana", "Andhra Pradesh", "Tamil Nadu", "Rajasthan", "Uttar Pradesh"],
    sowing: { method: "dibbling", seedRate: { min: 20, max: 25, unit: "kg_ha" }, spacing: { row: [60, 75], plant: [20, 25] } },
    irrigation: "maize",
    harvest: "maize",
    fertilizer: { n: range(120, 150), p: range(60), k: range(40), timing: "n_three_splits", extra: null },
  },
  {
    key: "soybean",
    season: "Kharif",
    water: "Moderate",
    soils: { Loamy: "ideal", Clay: "good", Sandy: "fair" },
    temp: { min: 10, optMin: 20, optMax: 30, max: 38 },
    ph: { min: 5.5, optMin: 6.0, optMax: 7.0, max: 8.0 },
    waterMm: [450, 700],
    sowMonths: [6, 7],
    harvestMonths: [9, 10],
    durationDays: [90, 110],
    states: ["Madhya Pradesh", "Maharashtra", "Rajasthan", "Karnataka", "Telangana", "Gujarat"],
    sowing: { method: "drill", seedRate: { min: 65, max: 80, unit: "kg_ha" }, spacing: { row: [45], plant: [5] } },
    irrigation: "soybean",
    harvest: "soybean",
    fertilizer: { n: range(20, 30), p: range(60, 80), k: range(30, 40), timing: "all_basal", extra: null },
  },
  {
    key: "cotton",
    season: "Kharif",
    water: "Moderate",
    soils: { Clay: "ideal", Loamy: "good", Sandy: "fair" },
    temp: { min: 15, optMin: 21, optMax: 32, max: 40 },
    ph: { min: 5.5, optMin: 6.0, optMax: 8.0, max: 8.5 },
    waterMm: [700, 1300],
    sowMonths: [5, 6, 7],
    harvestMonths: [10, 11, 12, 1],
    durationDays: [150, 180],
    states: ["Maharashtra", "Gujarat", "Telangana", "Andhra Pradesh", "Karnataka", "Punjab", "Haryana", "Rajasthan", "Tamil Nadu", "Madhya Pradesh"],
    sowing: { method: "dibbling", seedRate: null, spacing: null },
    irrigation: "cotton",
    harvest: "cotton",
    fertilizer: null, // varies widely by state, hybrid and irrigation — follow state recommendation
  },
  {
    key: "sugarcane",
    season: "Annual",
    water: "High",
    soils: { Loamy: "ideal", Clay: "good", Sandy: "fair" },
    temp: { min: 15, optMin: 22, optMax: 32, max: 38 },
    ph: { min: 5.0, optMin: 6.0, optMax: 7.5, max: 8.5 },
    waterMm: [1500, 2500],
    sowMonths: [10, 11, 1, 2, 7, 8],
    harvestMonths: [],
    durationDays: [365, 540],
    states: ["Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Bihar", "Haryana", "Punjab", "Andhra Pradesh", "Telangana"],
    sowing: { method: "setts", seedRate: { min: 35000, max: 40000, unit: "setts_ha" }, spacing: null },
    irrigation: "sugarcane",
    harvest: "sugarcane",
    fertilizer: null,
  },
  {
    key: "chickpea",
    season: "Rabi",
    water: "Low",
    soils: { Loamy: "ideal", Clay: "good", Sandy: "fair" },
    temp: { min: 5, optMin: 15, optMax: 25, max: 35 },
    ph: { min: 5.5, optMin: 6.0, optMax: 7.5, max: 8.5 },
    waterMm: [350, 500],
    sowMonths: [10, 11],
    harvestMonths: [2, 3],
    durationDays: [95, 120],
    states: ["Madhya Pradesh", "Rajasthan", "Maharashtra", "Uttar Pradesh", "Karnataka", "Andhra Pradesh", "Gujarat", "Chhattisgarh", "Telangana"],
    sowing: { method: "drill", seedRate: { min: 60, max: 80, unit: "kg_ha" }, spacing: { row: [30], plant: [10] } },
    irrigation: "chickpea",
    harvest: "chickpea",
    fertilizer: { n: range(20, 25), p: range(40, 60), k: range(0, 20), timing: "all_basal", extra: "k_if_deficient" },
  },
  {
    key: "groundnut",
    season: "Kharif",
    water: "Moderate",
    soils: { Sandy: "ideal", Loamy: "good", Clay: "poor" },
    temp: { min: 15, optMin: 22, optMax: 30, max: 38 },
    ph: { min: 5.0, optMin: 5.8, optMax: 7.0, max: 7.5 },
    waterMm: [500, 700],
    sowMonths: [6, 7],
    harvestMonths: [10, 11],
    durationDays: [100, 130],
    states: ["Gujarat", "Rajasthan", "Tamil Nadu", "Andhra Pradesh", "Karnataka", "Maharashtra", "Telangana", "Odisha"],
    sowing: { method: "dibbling", seedRate: { min: 100, max: 125, unit: "kg_ha" }, spacing: { row: [30], plant: [10] } },
    irrigation: "groundnut",
    harvest: "groundnut",
    fertilizer: { n: range(20, 25), p: range(40, 50), k: range(40), timing: "all_basal", extra: "gypsum_flowering" },
  },
  {
    key: "onion",
    season: "Rabi",
    water: "Moderate",
    soils: { Loamy: "ideal", Sandy: "good", Clay: "poor" },
    temp: { min: 5, optMin: 13, optMax: 28, max: 35 },
    ph: { min: 5.5, optMin: 6.0, optMax: 7.0, max: 8.0 },
    waterMm: [350, 550],
    sowMonths: [10, 11, 12],
    harvestMonths: [3, 4, 5],
    durationDays: [120, 150],
    states: ["Maharashtra", "Karnataka", "Madhya Pradesh", "Gujarat", "Bihar", "Rajasthan", "Uttar Pradesh", "Odisha", "West Bengal", "Telangana"],
    sowing: { method: "nursery_transplant", seedRate: { min: 8, max: 10, unit: "kg_ha" }, spacing: { row: [15], plant: [10] } },
    irrigation: "onion",
    harvest: "onion",
    fertilizer: { n: range(100, 120), p: range(50, 60), k: range(50, 60), timing: "splits", extra: null },
  },
  {
    key: "tomato",
    season: "All seasons",
    water: "Moderate",
    soils: { Loamy: "ideal", Sandy: "good", Clay: "fair" },
    temp: { min: 10, optMin: 18, optMax: 27, max: 35 },
    ph: { min: 5.0, optMin: 6.0, optMax: 7.0, max: 7.8 },
    waterMm: [400, 800],
    sowMonths: [6, 7, 10, 11, 1, 2],
    harvestMonths: [9, 10, 11, 12, 1, 2, 3, 4, 5],
    durationDays: [90, 140],
    states: ["Andhra Pradesh", "Madhya Pradesh", "Karnataka", "Gujarat", "Odisha", "West Bengal", "Maharashtra", "Bihar", "Chhattisgarh", "Telangana"],
    sowing: { method: "nursery_transplant", seedRate: null, spacing: null },
    irrigation: "tomato",
    harvest: "tomato",
    fertilizer: { n: range(100, 120), p: range(60), k: range(60), timing: "splits", extra: null },
  },
];

export const SOIL_RATING_SCORE = { ideal: 1, good: 0.8, fair: 0.55, poor: 0.25 };
