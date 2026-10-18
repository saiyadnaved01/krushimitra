import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";
import { MARKETS } from "../lib/helpers.js";

const router = Router();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

const listQuery = z.object({
  q: z.string().trim().default(""),
  market: z.string().trim().default("All markets"),
});

router.get("/", validate(listQuery, "query"), (req, res) => {
  const { q, market } = req.query;
  res.json({ prices: req.app.locals.db.prices.list({ search: q, market }) });
});

router.get("/markets", (req, res) => {
  const markets = [...new Set([...MARKETS, ...req.app.locals.db.prices.markets()])];
  res.json({ markets });
});

const priceSchema = z.object({
  crop: z.string().trim().min(2).max(40),
  variety: z.string().trim().min(1).max(60),
  market: z.string().trim().min(2).max(60),
  price: z.coerce.number().int().min(1).max(10_000_000),
  date: isoDate,
});

const admin = requireRole("admin");

router.post("/", admin, validate(priceSchema), (req, res) => {
  res.status(201).json({ price: req.app.locals.db.prices.create(req.body) });
});

router.put("/:id", admin, validate(priceSchema.partial()), (req, res) => {
  const { prices } = req.app.locals.db;
  const row = prices.find(Number(req.params.id));
  if (!row) throw new HttpError(404, "Price record not found.", undefined, "not_found");
  const patch = { ...req.body };
  if (patch.price !== undefined && row.price > 0 && patch.price !== row.price) {
    patch.change = Math.round(((patch.price - row.price) / row.price) * 1000) / 10;
  }
  res.json({ price: prices.update(row.id, patch) });
});

router.delete("/:id", admin, (req, res) => {
  if (!req.app.locals.db.prices.remove(Number(req.params.id))) {
    throw new HttpError(404, "Price record not found.", undefined, "not_found");
  }
  res.status(204).end();
});

export default router;
