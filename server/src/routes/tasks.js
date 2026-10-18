import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const CATEGORIES = ["Irrigation", "Fertilizer", "Inspection", "Harvest"];

const taskSchema = z.object({
  title: z.string().trim().min(2, "Enter a task name").max(120),
  crop: z.string().trim().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a HH:MM time"),
  category: z.enum(CATEGORIES),
});
const patchSchema = taskSchema.partial().extend({ done: z.boolean().optional() });

router.get("/", (req, res) => res.json({ tasks: req.app.locals.db.tasks.forUser(req.user.id) }));

router.post("/", validate(taskSchema), (req, res) => {
  res.status(201).json({ task: req.app.locals.db.tasks.create(req.user.id, req.body) });
});

router.patch("/:id", validate(patchSchema), (req, res) => {
  const { tasks } = req.app.locals.db;
  const id = Number(req.params.id);
  if (!tasks.find(req.user.id, id)) throw new HttpError(404, "Task not found.", undefined, "not_found");
  res.json({ task: tasks.update(req.user.id, id, req.body) });
});

router.delete("/:id", (req, res) => {
  if (!req.app.locals.db.tasks.remove(req.user.id, Number(req.params.id))) {
    throw new HttpError(404, "Task not found.", undefined, "not_found");
  }
  res.status(204).end();
});

export default router;
