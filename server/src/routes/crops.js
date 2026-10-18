import { Router } from "express";
import { z } from "zod";
import { HttpError, wrap } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { englishName, findCrop } from "../services/crops.js";
import { SOURCES } from "../data/crops.js";
import { getClimate } from "../services/climate.js";
import { missingInputs, rankCrops } from "../services/recommend.js";
import { inferState } from "../lib/geo.js";
import { todayISO } from "../lib/helpers.js";

export const cropsRouter = Router();
export const savedCropsRouter = Router();

/** Public shape of one ranked crop. Text is produced by the client from these codes/numbers. */
function present(ranked, saved) {
  const { crop, match, confidence, suitability, factors, grow } = ranked;
  return {
    key: crop.key,
    name: englishName(crop),
    imageKey: crop.key,
    season: crop.season,
    water: crop.water,
    soils: crop.soils,
    match,
    confidence,
    suitability,
    factors,
    saved: saved.has(englishName(crop)),
    growing: { months: grow.months, startMonth: grow.startMonth, monthsUntilSowing: grow.monthsUntilSowing },
    guidance: {
      sowing: { months: crop.sowMonths, ...crop.sowing },
      harvest: { months: crop.harvestMonths, durationDays: crop.durationDays, indicator: crop.harvest },
      irrigation: crop.irrigation,
      fertilizer: crop.fertilizer
        ? { n: crop.fertilizer.n, p: crop.fertilizer.p, k: crop.fertilizer.k, timing: crop.fertilizer.timing, extra: crop.fertilizer.extra }
        : null,
      temp: crop.temp,
      ph: crop.ph,
      waterMm: crop.waterMm,
      states: crop.states,
    },
  };
}

cropsRouter.get(
  "/",
  wrap(async (req, res) => {
    const { user } = req;
    const db = req.app.locals.db;
    const state = user.state ?? inferState(user.location) ?? null;
    const climate = await getClimate({ location: user.location, state });

    const ctx = {
      soil: user.soil,
      ph: user.soilPh,
      moisture: user.soilMoisture,
      waterAvailability: user.waterAvailability,
      state,
      climate,
    };
    const saved = new Set(db.savedCrops.names(user.id));
    res.json({
      profile: { soil: user.soil, ph: user.soilPh, moisture: user.soilMoisture, waterAvailability: user.waterAvailability, state, location: user.location },
      climate: climate
        ? { available: true, place: climate.place, window: climate.window }
        : { available: false },
      missing: missingInputs(ctx),
      sources: SOURCES,
      reviewed: false,
      crops: rankCrops(ctx).map((r) => present(r, saved)),
    });
  }),
);

savedCropsRouter.get("/", (req, res) => {
  res.json({ crops: req.app.locals.db.savedCrops.names(req.user.id) });
});

const body = z.object({ crop: z.string().trim().min(1) });

savedCropsRouter.post("/", validate(body), (req, res) => {
  const db = req.app.locals.db;
  const crop = findCrop(req.body.crop);
  if (!crop) throw new HttpError(404, "Unknown crop.", undefined, "not_found");
  // Saved names stay in the existing English form ("Rice") so older data keeps working.
  const name = englishName(crop);
  db.transaction(() => {
    if (db.savedCrops.add(req.user.id, name)) {
      // Surface the plan to administrators as a recommendation record.
      db.records.create(req.user.id, name, todayISO());
    }
  });
  res.status(201).json({ crops: db.savedCrops.names(req.user.id) });
});

savedCropsRouter.delete("/:crop", (req, res) => {
  const db = req.app.locals.db;
  const crop = findCrop(req.params.crop);
  db.savedCrops.remove(req.user.id, crop ? englishName(crop) : req.params.crop);
  res.json({ crops: db.savedCrops.names(req.user.id) });
});
