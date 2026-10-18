import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { publicUser } from "../lib/helpers.js";
import { MOISTURE_LEVELS, SOILS, WATER_AVAILABILITY } from "../services/crops.js";
import { INDIAN_STATES, LANGUAGES } from "../lib/geo.js";

const router = Router();

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Enter a 10-digit phone number")
    .or(z.literal("")),
  location: z.string().trim().min(2).max(120),
  land: z.coerce.number().min(0).max(100000),
  soil: z.enum(SOILS),
  // Optional farm details that sharpen crop recommendations. null clears a value.
  state: z.enum(INDIAN_STATES).nullable().optional(),
  soilPh: z.coerce.number().min(3.5, "pH must be between 3.5 and 9.5").max(9.5, "pH must be between 3.5 and 9.5").nullable().optional(),
  soilMoisture: z.enum(MOISTURE_LEVELS).nullable().optional(),
  waterAvailability: z.enum(WATER_AVAILABILITY).nullable().optional(),
  language: z.enum(LANGUAGES).nullable().optional(),
  prefs: z.object({ emailAlerts: z.boolean(), weatherAlerts: z.boolean() }).optional(),
});

router.get("/", (req, res) => res.json({ user: publicUser(req.user) }));

// Lightweight endpoint used by the language selector.
router.patch("/language", validate(z.object({ language: z.enum(LANGUAGES) })), (req, res) => {
  const updated = req.app.locals.db.users.update(req.user.id, { language: req.body.language });
  res.json({ user: publicUser(updated) });
});

router.put("/", validate(schema), (req, res) => {
  const { users } = req.app.locals.db;
  if (users.emailTaken(req.body.email, req.user.id)) {
    throw new HttpError(409, "Another account already uses this email.", undefined, "email_taken");
  }
  if (req.user.role === "farmer" && req.body.land <= 0) {
    throw new HttpError(400, "land: Farm area must be greater than 0", undefined, "invalid_input");
  }
  // Empty strings from a cleared form field mean "not provided".
  const body = { ...req.body };
  for (const k of ["state", "soilPh", "soilMoisture", "waterAvailability"]) {
    if (body[k] === undefined) delete body[k];
  }
  const updated = users.update(req.user.id, body);
  res.json({ user: publicUser(updated) });
});

export default router;
