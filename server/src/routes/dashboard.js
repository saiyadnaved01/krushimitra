import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { wrap } from "../middleware/error.js";
import { monthShort } from "../lib/helpers.js";
import { getWeather, resolveLocation, DEFAULT_LOCATION } from "../services/weather.js";

const router = Router();

const query = z.object({ months: z.coerce.number().int().min(1).max(12).default(6) });

router.get(
  "/",
  validate(query, "query"),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const { user } = req;

    const fields = new Set(db.tasks.openForUser(user.id).map((t) => t.crop));
    const stats = user.farmStats ?? {
      estimatedYield: 0,
      yieldChange: null,
      estimatedRevenue: 0,
      revenueChange: null,
    };
    const yields = db.yields
      .forUser(user.id, req.query.months)
      .map((y) => ({ month: monthShort(y.month), actual: y.actual, expected: y.expected }));

    const weather = await getWeather(resolveLocation(user.location) ?? DEFAULT_LOCATION);

    res.json({
      stats: { area: user.land, activeFields: fields.size, ...stats },
      yields,
      weather: {
        location: weather.location,
        source: weather.source,
        current: weather.current,
        advice: weather.advice.field,
      },
    });
  }),
);

export default router;
