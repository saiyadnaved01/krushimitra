import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { CROP_NAMES } from "../services/crops.js";
import { buildPlan } from "../services/fertilizer.js";

const router = Router();

const schema = z.object({
  crop: z.string().trim().toLowerCase().refine((c) => CROP_NAMES.includes(c), "Unknown crop"),
  area: z.coerce.number().min(0.1, "Area must be at least 0.1 acres").max(10000),
});

router.post("/plan", validate(schema), (req, res) => {
  const plan = buildPlan({ crop: req.body.crop, areaAcres: req.body.area });
  if (!plan) throw new HttpError(400, "No plan available for this crop.", undefined, "invalid_input");
  res.json(plan);
});

export default router;
