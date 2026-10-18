import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { wrap } from "../middleware/error.js";
import {
  DEFAULT_LOCATION,
  WEATHER_LOCATIONS,
  getWeather,
  resolveLocation,
} from "../services/weather.js";

const router = Router();

router.get("/locations", (_req, res) => res.json({ locations: Object.keys(WEATHER_LOCATIONS) }));

const query = z.object({ location: z.string().trim().optional() });

router.get(
  "/",
  validate(query, "query"),
  wrap(async (req, res) => {
    const location =
      req.query.location && WEATHER_LOCATIONS[req.query.location]
        ? req.query.location
        : (resolveLocation(req.user.location) ?? DEFAULT_LOCATION);
    res.json(await getWeather(location));
  }),
);

export default router;
