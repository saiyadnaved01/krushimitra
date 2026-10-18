import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { HttpError, wrap } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import {
  adminFarmerView as farmerView,
  growth,
  lastMonths,
  monthLabel,
  monthShort,
  startOfMonthISO,
  todayISO,
} from "../lib/helpers.js";
import { SOILS, matchFor, findCrop } from "../services/crops.js";

const router = Router();

/* ------------------------------ analytics ------------------------------ */

router.get("/stats", (req, res) => {
  const db = req.app.locals.db;
  const monthStart = startOfMonthISO();
  const farmers = db.users.listFarmers();
  const records = db.records.all();

  const farmersBefore = farmers.filter((f) => f.joined < monthStart);
  const recordsBefore = records.filter((r) => r.date < monthStart);
  const area = (list) => list.filter((f) => f.status === "Active").reduce((s, f) => s + f.land, 0);

  const registrations = lastMonths(6).map((m) => ({
    month: monthShort(m),
    farmers: farmers.filter((f) => f.joined.startsWith(m)).length,
  }));

  const counts = new Map();
  for (const r of records) counts.set(r.crop, (counts.get(r.crop) ?? 0) + 1);
  const total = records.length || 1;
  const distribution = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name, count: n, value: Math.round((n / total) * 100) }));

  res.json({
    registeredFarmers: { value: farmers.length, change: growth(farmers.length, farmersBefore.length) },
    recommendations: { value: records.length, change: growth(records.length, recordsBefore.length) },
    activeArea: {
      value: Math.round(area(farmers) * 10) / 10,
      change: growth(area(farmers), area(farmersBefore)),
    },
    marketRecords: {
      value: db.prices.count(),
      markets: db.prices.markets().length,
    },
    registrations,
    distribution,
    recentFarmers: [...farmers].sort((a, b) => b.joined.localeCompare(a.joined) || b.id - a.id).slice(0, 5).map(farmerView),
  });
});

/* ------------------------------- farmers ------------------------------- */

const farmerQuery = z.object({
  q: z.string().trim().default(""),
  status: z.enum(["All statuses", "Active", "Inactive"]).default("All statuses"),
});

router.get("/farmers", validate(farmerQuery, "query"), (req, res) => {
  const { q, status } = req.query;
  res.json({ farmers: req.app.locals.db.users.listFarmers({ search: q, status }).map(farmerView) });
});

const farmerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  location: z.string().trim().min(2).max(120),
  land: z.coerce.number().gt(0, "Farm area must be greater than 0").max(100000),
  soil: z.enum(SOILS).optional(),
  // Optional: lets the farmer sign in. Without it the record is profile-only.
  password: z.string().min(8, "Password must be at least 8 characters").max(72).optional().or(z.literal("")),
});

router.post(
  "/farmers",
  validate(farmerSchema),
  wrap(async (req, res) => {
    const { users } = req.app.locals.db;
    const { password, ...data } = req.body;
    if (users.emailTaken(data.email)) throw new HttpError(409, "A user with this email already exists.", undefined, "email_taken");
    const farmer = users.create({
      role: "farmer",
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      joined: todayISO(),
      ...data,
    });
    res.status(201).json({ farmer: farmerView(farmer) });
  }),
);

const findFarmer = (users, id) => {
  const u = users.findById(id);
  return u && u.role === "farmer" ? u : null;
};

router.put(
  "/farmers/:id",
  validate(farmerSchema),
  wrap(async (req, res) => {
    const { users } = req.app.locals.db;
    const farmer = findFarmer(users, Number(req.params.id));
    if (!farmer) throw new HttpError(404, "Farmer not found.", undefined, "not_found");
    const { password, ...data } = req.body;
    if (users.emailTaken(data.email, farmer.id)) {
      throw new HttpError(409, "A user with this email already exists.", undefined, "email_taken");
    }
    const patch = { ...data };
    if (password) patch.passwordHash = await bcrypt.hash(password, 10);
    res.json({ farmer: farmerView(users.update(farmer.id, patch)) });
  }),
);

router.patch("/farmers/:id/status", validate(z.object({ status: z.enum(["Active", "Inactive"]) })), (req, res) => {
  const { users } = req.app.locals.db;
  const farmer = findFarmer(users, Number(req.params.id));
  if (!farmer) throw new HttpError(404, "Farmer not found.", undefined, "not_found");
  res.json({ farmer: farmerView(users.update(farmer.id, { status: req.body.status })) });
});

/* -------------------------- recommendation records -------------------------- */

const recordView = (r) => {
  const crop = findCrop(r.crop);
  const soil = r.soil ?? "Loamy";
  return {
    id: `REC-${String(r.id).padStart(3, "0")}`,
    recordId: r.id,
    farmer: r.farmer ?? "Unknown farmer",
    crop: r.crop,
    match: crop ? matchFor(crop, soil) : 0,
    soil,
    date: r.date,
    status: r.status,
  };
};

const recordQuery = z.object({
  q: z.string().trim().default(""),
  crop: z.string().trim().default("All crops"),
});

router.get("/records", validate(recordQuery, "query"), (req, res) => {
  const { q, crop } = req.query;
  const rows = req.app.locals.db.records
    .all()
    .map(recordView)
    .filter(
      (r) =>
        r.farmer.toLowerCase().includes(q.toLowerCase()) && (crop === "All crops" || r.crop === crop),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.recordId - a.recordId);
  res.json({ records: rows });
});

router.patch("/records/:id", validate(z.object({ status: z.enum(["Pending", "Reviewed"]) })), (req, res) => {
  const { records } = req.app.locals.db;
  const id = Number(req.params.id);
  if (!records.find(id)) throw new HttpError(404, "Record not found.", undefined, "not_found");
  res.json({ record: recordView(records.setStatus(id, req.body.status)) });
});

/* --------------------------------- reports --------------------------------- */

router.get("/report-periods", (_req, res) => {
  const periods = lastMonths(3)
    .reverse()
    .map((m) => ({ value: m, label: monthLabel(m) }));
  res.json({ periods });
});

const reportQuery = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Use a YYYY-MM period"),
});

router.get("/reports/:type", validate(reportQuery, "query"), (req, res) => {
  const db = req.app.locals.db;
  const { period } = req.query;
  const label = monthLabel(period);
  const tag = (rows) => rows.map((row) => ({ ...row, report_period: label }));
  // Everything up to the end of the selected month.
  const upTo = (iso) => iso.slice(0, 7) <= period;

  switch (req.params.type) {
    case "farmers":
      return res.json({
        rows: tag(
          db.users
            .listFarmers()
            .filter((f) => upTo(f.joined))
            .map(({ id, name, email, location, land, soil, status, joined }) => ({
              id, name, email, location, land_acres: land, soil, status, joined,
            })),
        ),
      });
    case "market":
      return res.json({ rows: tag(db.prices.all().filter((p) => upTo(p.date))) });
    case "yield": {
      const byMonth = new Map();
      for (const y of db.yields.all().filter((y) => upTo(y.month))) {
        const row = byMonth.get(y.month) ?? { month: y.month, actual: 0, expected: 0 };
        row.actual += y.actual;
        row.expected += y.expected;
        byMonth.set(y.month, row);
      }
      const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
      return res.json({
        rows: tag(rows),
        chart: rows.map((r) => ({ month: monthShort(r.month), actual: r.actual, expected: r.expected })),
      });
    }
    default:
      throw new HttpError(404, "Unknown report type.", undefined, "not_found");
  }
});

export default router;
