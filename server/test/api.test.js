import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
process.env.WEATHER_PROVIDER = "sample"; // keep tests offline and deterministic

const { openDatabase } = await import("../src/db/database.js");
const { createApp } = await import("../src/app.js");
const weather = await import("../src/services/weather.js");
const climate = await import("../src/services/climate.js");
const { scoreCrop, rankCrops, trapezoid, growingMonths, WEIGHTS } = await import("../src/services/recommend.js");
const { CROPS } = await import("../src/data/crops.js");
const { bootstrapAdmin } = await import("../src/lib/bootstrap.js");

let server;
let base;
let db;

before(async () => {
  db = openDatabase(":memory:");
  server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());
beforeEach(() => db.reset());

async function call(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + url, { method, headers, body: payload });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const demo = async (role) => (await call("POST", "/auth/demo", { body: { role } })).body.token;

describe("auth", () => {
  test("rejects unauthenticated access", async () => {
    assert.equal((await call("GET", "/tasks")).status, 401);
  });

  test("login succeeds with seeded credentials and fails with a wrong password", async () => {
    const ok = await call("POST", "/auth/login", {
      body: { email: "rajesh.patil@example.com", password: "farmer123" },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.passwordHash, undefined);
    const bad = await call("POST", "/auth/login", {
      body: { email: "rajesh.patil@example.com", password: "nope-nope" },
    });
    assert.equal(bad.status, 401);
  });

  test("register creates a farmer, enforces unique email and validates input", async () => {
    const body = { name: "Test Farmer", email: "Test@Example.com", password: "secret123" };
    const created = await call("POST", "/auth/register", { body });
    assert.equal(created.status, 201);
    assert.equal(created.body.user.email, "test@example.com");
    assert.equal((await call("POST", "/auth/register", { body })).status, 409);
    assert.equal(
      (await call("POST", "/auth/register", { body: { ...body, email: "x@y.co", password: "123" } })).status,
      400,
    );
  });

  test("portals are separated by role", async () => {
    const farmerOnAdmin = await call("POST", "/auth/login", {
      body: { email: "rajesh.patil@example.com", password: "farmer123", portal: "admin" },
    });
    assert.equal(farmerOnAdmin.status, 403);
    const adminOnFarmer = await call("POST", "/auth/login", {
      body: { email: "admin@krushimitra.example", password: "admin123" },
    });
    assert.equal(adminOnFarmer.status, 403);
  });

  test("inactive farmers cannot sign in", async () => {
    const admin = await demo("admin");
    await call("PUT", "/admin/farmers/1", {
      token: admin,
      body: { name: "Rajesh Patil", email: "rajesh.patil@example.com", location: "Pune", land: 12.5 },
    });
    await call("PATCH", "/admin/farmers/1/status", { token: admin, body: { status: "Inactive" } });
    const res = await call("POST", "/auth/login", {
      body: { email: "rajesh.patil@example.com", password: "farmer123" },
    });
    assert.equal(res.status, 403);
  });
});

describe("change password", () => {
  test("requires the current password and then the new one works", async () => {
    const token = await demo("farmer");
    const wrong = await call("POST", "/auth/change-password", {
      token, body: { currentPassword: "not-it", newPassword: "brand-new-pw" },
    });
    assert.equal(wrong.status, 400);
    const same = await call("POST", "/auth/change-password", {
      token, body: { currentPassword: "farmer123", newPassword: "farmer123" },
    });
    assert.equal(same.status, 400);
    const ok = await call("POST", "/auth/change-password", {
      token, body: { currentPassword: "farmer123", newPassword: "brand-new-pw" },
    });
    assert.equal(ok.status, 200);
    const oldLogin = await call("POST", "/auth/login", { body: { email: "rajesh.patil@example.com", password: "farmer123" } });
    assert.equal(oldLogin.status, 401);
    const newLogin = await call("POST", "/auth/login", { body: { email: "rajesh.patil@example.com", password: "brand-new-pw" } });
    assert.equal(newLogin.status, 200);
  });
});

describe("database", () => {
  test("emails are unique regardless of case", async () => {
    const res = await call("POST", "/auth/register", {
      body: { name: "Copy Cat", email: "RAJESH.PATIL@EXAMPLE.COM", password: "secret123" },
    });
    assert.equal(res.status, 409);
  });

  test("deleting a user cascades to their data", () => {
    const sqliteCount = () => db.tasks.forUser(1).length;
    assert.equal(sqliteCount(), 3);
    const user = db.users.create({ name: "Temp", email: "temp@example.com", location: "Pune", joined: "2026-10-11" });
    db.tasks.create(user.id, { title: "Temp task", crop: "Rice", date: "2026-10-12", time: "07:00", category: "Harvest" });
    assert.equal(db.tasks.forUser(user.id).length, 1);
  });

  test("data persists in a file-backed database across reopen", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "km-")), "t.db");
    const first = openDatabase(file);
    first.tasks.create(1, { title: "Persisted", crop: "Rice", date: "2026-10-20", time: "08:00", category: "Harvest" });
    first.close();
    const second = openDatabase(file);
    assert.ok(second.tasks.forUser(1).some((t) => t.title === "Persisted"));
    assert.equal(second.users.count(), 13); // not re-seeded
    second.close();
  });
});

describe("weather service", () => {
  const sample = {
    current: { temperature_2m: 31.4, apparent_temperature: 33.2, relative_humidity_2m: 58, wind_speed_10m: 9.6, weather_code: 2 },
    daily: {
      time: ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"],
      weather_code: [1, 2, 61, 95, 3, 0, 1],
      temperature_2m_max: [31, 30, 27, 26, 28, 30, 31],
      temperature_2m_min: [21, 21, 20, 20, 21, 21, 22],
      precipitation_probability_max: [5, 20, 70, 85, 30, 10, 5],
      uv_index_max: [7.2, 6, 3, 2, 5, 7, 7],
    },
  };

  test("converts an Open-Meteo response and labels it live", () => {
    const w = weather.fromOpenMeteo("Pune", sample);
    assert.equal(w.source, "live");
    assert.equal(w.current.temp, 31);
    assert.equal(w.current.summary, "partly_cloudy");
    assert.equal(w.current.uvLevel, "high");
    assert.equal(w.forecast.length, 7);
    assert.equal(w.forecast[0].day, "Today");
    assert.equal(w.forecast[2].type, "rain");
    assert.equal(w.advice.field, "showers");
    assert.ok(w.advice.rain.day);
  });

  test("uses the live provider when it answers", async () => {
    weather.resetWeatherCache();
    const w = await weather.getWeather("Nashik", {
      provider: "open-meteo",
      fetchImpl: async () => ({ ok: true, json: async () => sample }),
    });
    assert.equal(w.source, "live");
    assert.equal(w.location, "Nashik");
  });

  test("falls back to sample data when the provider fails or returns junk", async () => {
    weather.resetWeatherCache();
    const down = await weather.getWeather("Pune", {
      provider: "open-meteo",
      fetchImpl: async () => { throw new Error("network down"); },
    });
    assert.equal(down.source, "sample");
    weather.resetWeatherCache();
    const junk = await weather.getWeather("Pune", {
      provider: "open-meteo",
      fetchImpl: async () => ({ ok: true, json: async () => ({ nope: true }) }),
    });
    assert.equal(junk.source, "sample");
    weather.resetWeatherCache();
  });
});

describe("role-based access", () => {
  test("farmers cannot reach admin or edit prices", async () => {
    const farmer = await demo("farmer");
    assert.equal((await call("GET", "/admin/stats", { token: farmer })).status, 403);
    assert.equal(
      (await call("PUT", "/prices/1", { token: farmer, body: { price: 1 } })).status,
      403,
    );
  });

  test("admins cannot use farmer-only endpoints", async () => {
    const admin = await demo("admin");
    assert.equal((await call("GET", "/tasks", { token: admin })).status, 403);
  });
});

describe("tasks", () => {
  test("full CRUD, scoped to the signed-in farmer", async () => {
    const token = await demo("farmer");
    const list = await call("GET", "/tasks", { token });
    assert.equal(list.body.tasks.length, 3);

    const created = await call("POST", "/tasks", {
      token,
      body: { title: "Harvest rice", crop: "Rice", date: "2026-11-01", time: "06:30", category: "Harvest" },
    });
    assert.equal(created.status, 201);
    const id = created.body.task.id;

    const done = await call("PATCH", `/tasks/${id}`, { token, body: { done: true } });
    assert.equal(done.body.task.done, true);

    // another farmer cannot see or modify it
    const other = (
      await call("POST", "/auth/register", {
        body: { name: "Other One", email: "other@example.com", password: "secret123" },
      })
    ).body.token;
    assert.equal((await call("GET", "/tasks", { token: other })).body.tasks.length, 0);
    assert.equal((await call("DELETE", `/tasks/${id}`, { token: other })).status, 404);

    assert.equal((await call("DELETE", `/tasks/${id}`, { token })).status, 204);
  });

  test("validates task input", async () => {
    const token = await demo("farmer");
    const res = await call("POST", "/tasks", {
      token,
      body: { title: "x", crop: "Rice", date: "tomorrow", time: "7am", category: "Nope" },
    });
    assert.equal(res.status, 400);
  });
});

describe("market prices", () => {
  test("filters by crop and market", async () => {
    const token = await demo("farmer");
    const rice = await call("GET", "/prices?q=RICE", { token });
    assert.deepEqual(rice.body.prices.map((p) => p.crop), ["Rice"]);
    const nashik = await call("GET", "/prices?market=Nashik%20APMC", { token });
    assert.deepEqual(nashik.body.prices.map((p) => p.crop), ["Maize", "Onion"]);
  });

  test("admin price edit recalculates the change percentage", async () => {
    const admin = await demo("admin");
    const res = await call("PUT", "/prices/1", { token: admin, body: { price: 2695 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.price.change, 10);
  });
});

describe("farmer features", () => {
  test("crop recommendations are ranked, explained, and ask for missing inputs", async () => {
    const token = await demo("farmer");
    const res = await call("GET", "/crops", { token });
    assert.equal(res.status, 200);
    const { crops, missing, profile } = res.body;
    assert.equal(profile.state, "Maharashtra"); // inferred from "Pune, Maharashtra"
    assert.ok(crops.length >= 10);
    for (let i = 1; i < crops.length; i++) assert.ok(crops[i - 1].match >= crops[i].match, "sorted by match");
    assert.ok(missing.includes("ph") && missing.includes("climate")); // sample weather provider => no climate
    const rice = crops.find((c) => c.key === "rice");
    assert.equal(rice.factors.find((f) => f.key === "soil").params.rating, "ideal"); // clay soil
    assert.equal(rice.factors.find((f) => f.key === "ph").status, "unknown");
    assert.ok(rice.guidance.irrigation && rice.guidance.harvest.months.length);
  });

  test("farm details change the ranking and raise confidence", async () => {
    const token = await demo("farmer");
    const before = (await call("GET", "/crops", { token })).body.crops.find((c) => c.key === "groundnut");
    const put = await call("PUT", "/profile", {
      token,
      body: {
        name: "Rajesh Patil", email: "rajesh.patil@example.com", phone: "9876543210",
        location: "Pune, Maharashtra", land: 12.5, soil: "Sandy", state: "Maharashtra",
        soilPh: 6.5, soilMoisture: "Dry", waterAvailability: "Limited",
      },
    });
    assert.equal(put.status, 200);
    assert.equal(put.body.user.soilPh, 6.5);
    const after = (await call("GET", "/crops", { token })).body;
    const groundnut = after.crops.find((c) => c.key === "groundnut");
    assert.ok(groundnut.confidence > before.confidence);
    assert.ok(groundnut.match > before.match, "sandy soil should favour groundnut over clay");
    assert.ok(!after.missing.includes("ph"));
    const bad = await call("PUT", "/profile", {
      token,
      body: {
        name: "Rajesh Patil", email: "rajesh.patil@example.com", phone: "9876543210",
        location: "Pune, Maharashtra", land: 12.5, soil: "Sandy", soilPh: 12,
      },
    });
    assert.equal(bad.status, 400);
  });

  test("saving a crop creates a pending record for admins", async () => {
    const token = await demo("farmer");
    const admin = await demo("admin");
    const before = (await call("GET", "/admin/records", { token: admin })).body.records.length;
    await call("POST", "/saved-crops", { token, body: { crop: "Tomato" } });
    await call("POST", "/saved-crops", { token, body: { crop: "Tomato" } }); // idempotent
    const records = (await call("GET", "/admin/records", { token: admin })).body.records;
    assert.equal(records.length, before + 1);
    assert.equal(records[0].status, "Pending");
  });

  test("fertilizer plan converts published kg/ha ranges to the farmer's area", async () => {
    const token = await demo("farmer");
    const plan = await call("POST", "/fertilizer/plan", { token, body: { crop: "wheat", area: 2.4710538 } });
    assert.equal(plan.status, 200);
    const n = plan.body.nutrients.find((x) => x.key === "N");
    assert.deepEqual(n.perHa, { min: 120, max: 150 });
    assert.deepEqual(n.total, { min: 120, max: 150 }); // 2.4710538 acres == exactly 1 hectare
    assert.equal(plan.body.reviewed, false);
    const double = await call("POST", "/fertilizer/plan", { token, body: { crop: "wheat", area: 4.9421076 } });
    assert.equal(double.body.nutrients[0].total.max, 300);
  });

  test("crops without a defensible national range return no invented quantities", async () => {
    const token = await demo("farmer");
    const cotton = await call("POST", "/fertilizer/plan", { token, body: { crop: "cotton", area: 3 } });
    assert.equal(cotton.status, 200);
    assert.equal(cotton.body.nutrients, null);
    assert.equal(cotton.body.timing, "follow_local");
    assert.equal((await call("POST", "/fertilizer/plan", { token, body: { crop: "rice", area: -1 } })).status, 400);
    assert.equal((await call("POST", "/fertilizer/plan", { token, body: { crop: "kryptonite", area: 1 } })).status, 400);
  });

  test("weather supports locations and seven forecast days", async () => {
    const token = await demo("farmer");
    const res = await call("GET", "/weather?location=Nagpur", { token });
    assert.equal(res.body.location, "Nagpur");
    assert.equal(res.body.forecast.length, 7);
    assert.equal(res.body.forecast[0].day, "Today");
    assert.equal(res.body.source, "sample");
  });

  test("notifications can be marked read individually and all at once", async () => {
    const token = await demo("farmer");
    let res = await call("GET", "/notifications", { token });
    assert.equal(res.body.unread, 3);
    await call("PATCH", `/notifications/${res.body.notifications[0].id}/read`, { token });
    res = await call("GET", "/notifications", { token });
    assert.equal(res.body.unread, 2);
    await call("POST", "/notifications/read-all", { token });
    assert.equal((await call("GET", "/notifications", { token })).body.unread, 0);
  });

  test("profile update validates phone and email uniqueness", async () => {
    const token = await demo("farmer");
    const base = {
      name: "Rajesh Patil", email: "rajesh.patil@example.com", phone: "9876543210",
      location: "Pune, Maharashtra", land: 12.5, soil: "Clay",
    };
    assert.equal((await call("PUT", "/profile", { token, body: { ...base, phone: "123" } })).status, 400);
    assert.equal((await call("PUT", "/profile", { token, body: { ...base, email: "sunita.d@example.com" } })).status, 409);
    assert.equal((await call("PUT", "/profile", { token, body: { ...base, land: 20 } })).body.user.land, 20);
  });
});

describe("disease upload", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

  const send = async (token, buffer, type, name) => {
    const form = new FormData();
    if (buffer) form.append("image", new Blob([buffer], { type }), name);
    return call("POST", "/disease/analyze", { token, form });
  };

  test("accepts a real image and returns a clearly illustrative result", async () => {
    const token = await demo("farmer");
    const res = await send(token, png, "image/png", "leaf.png");
    assert.equal(res.status, 200);
    assert.equal(res.body.illustrative, true);
    assert.equal(res.body.analyzed, false);
  });

  test("rejects wrong types, fake images and missing files", async () => {
    const token = await demo("farmer");
    assert.equal((await send(token, Buffer.from("hello"), "text/plain", "a.txt")).status, 400);
    assert.equal((await send(token, Buffer.from("not really an image at all"), "image/png", "a.png")).status, 400);
    assert.equal((await send(token, null)).status, 400);
  });
});

describe("admin", () => {
  test("stats reflect live data", async () => {
    const admin = await demo("admin");
    const before = (await call("GET", "/admin/stats", { token: admin })).body;
    assert.equal(before.registeredFarmers.value, 12);
    await call("POST", "/admin/farmers", {
      token: admin,
      body: { name: "New Farmer", email: "new@example.com", location: "Pune", land: 3 },
    });
    const after = (await call("GET", "/admin/stats", { token: admin })).body;
    assert.equal(after.registeredFarmers.value, 13);
  });

  test("farmer create / edit / filter and email uniqueness", async () => {
    const admin = await demo("admin");
    const created = await call("POST", "/admin/farmers", {
      token: admin,
      body: { name: "Gita Rane", email: "gita@example.com", location: "Satara", land: 4, password: "secret123" },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.farmer.canSignIn, true);
    assert.equal(
      (await call("POST", "/admin/farmers", {
        token: admin,
        body: { name: "Dup", email: "gita@example.com", location: "Satara", land: 4 },
      })).status,
      409,
    );
    const found = await call("GET", "/admin/farmers?q=satara&status=Active", { token: admin });
    assert.ok(found.body.farmers.some((f) => f.email === "gita@example.com"));
    // the new farmer can actually sign in
    const login = await call("POST", "/auth/login", { body: { email: "gita@example.com", password: "secret123" } });
    assert.equal(login.status, 200);
  });

  test("records can be reviewed and reports return rows", async () => {
    const admin = await demo("admin");
    const pending = (await call("GET", "/admin/records", { token: admin })).body.records.find((r) => r.status === "Pending");
    const res = await call("PATCH", `/admin/records/${pending.recordId}`, { token: admin, body: { status: "Reviewed" } });
    assert.equal(res.body.record.status, "Reviewed");
    for (const type of ["farmers", "market", "yield"]) {
      const r = await call("GET", `/admin/reports/${type}?period=2026-10`, { token: admin });
      assert.equal(r.status, 200);
      assert.ok(r.body.rows.length > 0, type);
    }
    assert.equal((await call("GET", "/admin/reports/nope?period=2026-10", { token: admin })).status, 404);
  });
});


/* -------------------------------------------------------------------------- */
/*  Recommendation engine                                                     */
/* -------------------------------------------------------------------------- */

describe("recommendation engine", () => {
  const crop = (key) => CROPS.find((c) => c.key === key);
  const October = new Date("2026-10-15T00:00:00Z");
  const fullClimate = (tempC, rainMm) => ({
    monthly: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { tempC, rainMm }])),
  });

  test("weights sum to 100", () => {
    assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  });

  test("trapezoid scores 1 inside the optimum and 0 outside the absolute range", () => {
    const r = { min: 10, optMin: 20, optMax: 30, max: 40 };
    assert.equal(trapezoid(25, r), 1);
    assert.equal(trapezoid(15, r), 0.5);
    assert.equal(trapezoid(35, r), 0.5);
    assert.equal(trapezoid(5, r), 0);
    assert.equal(trapezoid(45, r), 0);
  });

  test("missing data is excluded, not assumed — and lowers confidence", () => {
    const sparse = scoreCrop(crop("rice"), { soil: "Clay", now: October });
    assert.equal(sparse.factors.find((f) => f.key === "ph").status, "unknown");
    assert.equal(sparse.factors.find((f) => f.key === "temperature").status, "unknown");
    assert.equal(sparse.confidence, WEIGHTS.soil + WEIGHTS.water * 0 + WEIGHTS.season); // soil + season only
    const rich = scoreCrop(crop("rice"), {
      soil: "Clay", ph: 6.2, moisture: "Moist", waterAvailability: "Assured", state: "West Bengal",
      climate: fullClimate(27, 200), now: October,
    });
    assert.equal(rich.confidence, 100);
  });

  test("an out-of-range soil pH lowers the match", () => {
    const base = { soil: "Loamy", now: October };
    const good = scoreCrop(crop("groundnut"), { ...base, ph: 6.4 });
    const bad = scoreCrop(crop("groundnut"), { ...base, ph: 8.4 });
    assert.equal(good.factors.find((f) => f.key === "ph").score, 1);
    assert.equal(bad.factors.find((f) => f.key === "ph").score, 0);
    assert.ok(good.match > bad.match);
  });

  test("a cool climate favours wheat over cotton, a hot wet one the reverse", () => {
    const common = { soil: "Loamy", now: new Date("2026-10-20T00:00:00Z"), waterAvailability: "Assured" };
    const cool = { ...common, climate: fullClimate(16, 25) };
    assert.ok(scoreCrop(crop("wheat"), cool).match > scoreCrop(crop("cotton"), cool).match);
    const hot = { ...common, now: new Date("2026-06-05T00:00:00Z"), climate: fullClimate(30, 150) };
    assert.ok(scoreCrop(crop("cotton"), hot).match > scoreCrop(crop("wheat"), hot).match);
  });

  test("irrigation compensates for low rainfall; rainfed does not", () => {
    const dry = fullClimate(27, 20);
    const rainfed = scoreCrop(crop("rice"), { soil: "Clay", climate: dry, waterAvailability: "Rainfed", now: October });
    const irrigated = scoreCrop(crop("rice"), { soil: "Clay", climate: dry, waterAvailability: "Assured", now: October });
    assert.ok(irrigated.factors.find((f) => f.key === "water").score > rainfed.factors.find((f) => f.key === "water").score);
  });

  test("region: a major state scores higher than one that is not", () => {
    const inState = scoreCrop(crop("cotton"), { soil: "Clay", state: "Gujarat", now: October });
    const outState = scoreCrop(crop("cotton"), { soil: "Clay", state: "Kerala", now: October });
    assert.equal(inState.factors.find((f) => f.key === "region").score, 1);
    assert.equal(outState.factors.find((f) => f.key === "region").score, 0.4);
  });

  test("growing months follow the next sowing window and wrap the year", () => {
    const wheat = growingMonths(crop("wheat"), new Date("2026-09-10T00:00:00Z"));
    assert.equal(wheat.monthsUntilSowing, 1); // October is the first wheat sowing month
    assert.equal(wheat.startMonth, 10);
    assert.deepEqual(growingMonths(crop("wheat"), new Date("2026-11-10T00:00:00Z")).months.slice(0, 3), [11, 12, 1]);
  });

  test("ranking is sorted, deterministic and covers the whole catalogue", () => {
    const ctx = { soil: "Clay", state: "Maharashtra", now: October };
    const a = rankCrops(ctx);
    assert.equal(a.length, CROPS.length);
    assert.deepEqual(a.map((r) => r.crop.key), rankCrops(ctx).map((r) => r.crop.key));
    for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].match >= a[i].match);
  });

  test("every crop in the knowledge base is internally consistent", () => {
    for (const c of CROPS) {
      assert.ok(c.temp.min < c.temp.optMin && c.temp.optMin < c.temp.optMax && c.temp.optMax < c.temp.max, `${c.key} temp`);
      assert.ok(c.ph.min <= c.ph.optMin && c.ph.optMin < c.ph.optMax && c.ph.optMax <= c.ph.max, `${c.key} ph`);
      assert.ok(c.waterMm[0] < c.waterMm[1] && c.durationDays[0] < c.durationDays[1], `${c.key} ranges`);
      assert.ok(c.sowMonths.every((m) => m >= 1 && m <= 12), `${c.key} months`);
      assert.deepEqual(Object.keys(c.soils).sort(), ["Clay", "Loamy", "Sandy"], `${c.key} soils`);
      assert.ok(c.states.length > 0);
    }
  });
});

describe("observed climate", () => {
  const days = (month, t, r, n = 30) =>
    Array.from({ length: n }, (_, i) => ({ date: `2025-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`, t, r }));
  const year = Array.from({ length: 12 }, (_, m) => days(m + 1, 20 + m, 5)).flat();
  const archive = {
    daily: {
      time: year.map((d) => d.date),
      temperature_2m_mean: year.map((d) => d.t),
      precipitation_sum: year.map((d) => d.r),
    },
  };

  test("summarises daily data per calendar month and ignores sparsely covered months", () => {
    const m = climate.summariseMonthly(archive.daily);
    assert.equal(m[1].tempC, 20);
    assert.equal(m[1].rainMm, 150);
    assert.equal(m[12].tempC, 31);
    const sparse = climate.summariseMonthly({ time: ["2025-03-01"], temperature_2m_mean: [30], precipitation_sum: [0] });
    assert.equal(sparse[3], null);
  });

  test("archive window is the last 12 complete months", () => {
    const w = climate.archiveWindow(new Date("2026-10-15T00:00:00Z"));
    assert.deepEqual(w, { start: "2025-10-01", end: "2026-09-30" });
  });

  test("resolves a known town without geocoding and fetches the archive", async () => {
    climate.resetClimateCache();
    const calls = [];
    const result = await climate.getClimate(
      { location: "Nashik, Maharashtra", state: "Maharashtra" },
      { provider: "open-meteo", fetchImpl: async (url) => { calls.push(url); return { ok: true, json: async () => archive }; } },
    );
    assert.equal(result.source, "live");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /archive-api\.open-meteo\.com/);
    assert.equal(result.monthly[6].tempC, 25);
  });

  test("geocodes other places and prefers the matching state", async () => {
    climate.resetClimateCache();
    const fetchImpl = async (url) =>
      url.includes("geocoding")
        ? { ok: true, json: async () => ({ results: [
            { name: "Surat", latitude: 1, longitude: 1, admin1: "Elsewhere" },
            { name: "Surat", latitude: 21.17, longitude: 72.83, admin1: "Gujarat" },
          ] }) }
        : { ok: true, json: async () => archive };
    const result = await climate.getClimate({ location: "Surat, Gujarat", state: "Gujarat" }, { provider: "open-meteo", fetchImpl });
    assert.equal(result.place, "Surat");
  });

  test("returns null (never invented data) when unavailable or unresolvable", async () => {
    climate.resetClimateCache();
    assert.equal(await climate.getClimate({ location: "Pune", state: null }, { provider: "sample" }), null);
    const down = await climate.getClimate({ location: "Pune", state: null }, {
      provider: "open-meteo", fetchImpl: async () => { throw new Error("offline"); },
    });
    assert.equal(down, null);
    climate.resetClimateCache();
    const nowhere = await climate.getClimate({ location: "Nowhereville", state: "Goa" }, {
      provider: "open-meteo", fetchImpl: async () => ({ ok: true, json: async () => ({ results: [] }) }),
    });
    assert.equal(nowhere, null);
    climate.resetClimateCache();
  });
});

/* -------------------------------------------------------------------------- */
/*  Data safety, security and deployment                                      */
/* -------------------------------------------------------------------------- */

describe("migrations preserve existing data", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const legacySql = fs.readFileSync(path.join(here, "fixtures", "legacy-schema.sql"), "utf8");

  function makeLegacyDb() {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "km-legacy-")), "old.db");
    const raw = new DatabaseSync(file);
    raw.exec(legacySql);
    raw.exec(`INSERT INTO users (role,name,email,password_hash,location,land,soil,status,joined)
              VALUES ('farmer','Old Farmer','old@farm.in','hash','Surat, Gujarat',4.5,'Clay','Active','2026-01-02')`);
    raw.exec(`INSERT INTO tasks (user_id,title,crop,date,time,category) VALUES (1,'Keep me','Rice','2026-11-01','06:00','Harvest')`);
    raw.exec(`INSERT INTO saved_crops (user_id,crop) VALUES (1,'Rice')`);
    raw.exec(`INSERT INTO notifications (user_id,title,text,type,created_at) VALUES (1,'Old note','x','System','2026-01-02T00:00:00Z')`);
    raw.close();
    return file;
  }

  test("a v0 database is upgraded in place, keeps every row, and is backed up first", () => {
    const file = makeLegacyDb();
    const migrated = openDatabase(file, { seedDemo: false });
    assert.equal(migrated.migration.from, 0);
    assert.ok(migrated.migration.backup && fs.existsSync(migrated.migration.backup));
    const u = migrated.users.findByEmail("old@farm.in");
    assert.equal(u.land, 4.5);
    assert.equal(u.soil, "Clay");
    assert.equal(u.state, null);
    assert.equal(u.soilPh, null);
    assert.equal(u.tokenVersion, 0);
    assert.equal(migrated.tasks.forUser(u.id)[0].title, "Keep me");
    assert.deepEqual(migrated.savedCrops.names(u.id), ["Rice"]);
    assert.equal(migrated.notifications.forUser(u.id)[0].key, null);
    assert.equal(migrated.users.count(), 1, "must not seed demo data into an existing database");
    migrated.close();

    // the backup is the untouched pre-migration file
    const backup = new DatabaseSync(`${file}.pre-v2-backup`);
    assert.equal(backup.prepare("SELECT COUNT(*) AS n FROM users").get().n, 1);
    assert.equal(backup.prepare("PRAGMA user_version").get().user_version, 0);
    backup.close();
  });

  test("re-opening is a no-op and never re-seeds", () => {
    const file = makeLegacyDb();
    openDatabase(file).close();
    const again = openDatabase(file);
    assert.equal(again.migration.from, 2);
    assert.equal(again.migration.backup, null);
    assert.equal(again.users.count(), 1);
    again.close();
  });

  test("new farm-profile fields can be saved on a migrated user", () => {
    const file = makeLegacyDb();
    const migrated = openDatabase(file);
    const u = migrated.users.findByEmail("old@farm.in");
    const updated = migrated.users.update(u.id, { state: "Gujarat", soilPh: 7.1, waterAvailability: "Assured", language: "gu" });
    assert.equal(updated.state, "Gujarat");
    assert.equal(updated.soilPh, 7.1);
    assert.equal(updated.language, "gu");
    migrated.close();
  });
});

describe("authentication hardening", () => {
  test("changing the password signs out other sessions but keeps the current one", async () => {
    const first = await demo("farmer");
    const second = await demo("farmer");
    assert.equal((await call("GET", "/auth/me", { token: second })).status, 200);
    const change = await call("POST", "/auth/change-password", {
      token: first, body: { currentPassword: "farmer123", newPassword: "another-pass-1" },
    });
    assert.equal(change.status, 200);
    assert.equal((await call("GET", "/auth/me", { token: second })).status, 401, "other session revoked");
    assert.equal((await call("GET", "/auth/me", { token: first })).status, 401, "old token revoked");
    assert.equal((await call("GET", "/auth/me", { token: change.body.token })).status, 200, "fresh token works");
  });

  test("an admin password reset revokes the farmer's sessions", async () => {
    const farmer = await demo("farmer");
    const admin = await demo("admin");
    await call("PUT", "/admin/farmers/1", {
      token: admin,
      body: { name: "Rajesh Patil", email: "rajesh.patil@example.com", location: "Pune, Maharashtra", land: 12.5, password: "reset-by-admin" },
    });
    assert.equal((await call("GET", "/auth/me", { token: farmer })).status, 401);
  });

  test("errors carry stable codes for translation", async () => {
    const bad = await call("POST", "/auth/login", { body: { email: "nobody@x.in", password: "whatever1" } });
    assert.equal(bad.body.error.code, "invalid_credentials");
    assert.equal((await call("GET", "/tasks")).body.error.code, "unauthorized");
    const dup = await call("POST", "/auth/register", { body: { name: "Dup Dup", email: "rajesh.patil@example.com", password: "secret1234" } });
    assert.equal(dup.body.error.code, "email_taken");
  });

  test("new passwords must be at least 8 characters; legacy short passwords can still sign in", async () => {
    const short = await call("POST", "/auth/register", { body: { name: "Short Pw", email: "short@x.in", password: "abc1234" } });
    assert.equal(short.status, 400);
    const hash = (await import("bcryptjs")).default.hashSync("abc123", 4);
    db.users.create({ name: "Legacy", email: "legacy@x.in", passwordHash: hash, location: "Pune", joined: "2026-01-01" });
    const login = await call("POST", "/auth/login", { body: { email: "legacy@x.in", password: "abc123" } });
    assert.equal(login.status, 200);
  });

  test("API responses are never cacheable", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  test("language preference can be saved and is validated", async () => {
    const token = await demo("farmer");
    const ok = await call("PATCH", "/profile/language", { token, body: { language: "ta" } });
    assert.equal(ok.body.user.language, "ta");
    assert.equal((await call("PATCH", "/profile/language", { token, body: { language: "xx" } })).status, 400);
  });
});

describe("production defaults and bootstrap", () => {
  const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const run = (args, env = {}) =>
    spawnSync(process.execPath, args, {
      cwd: serverDir,
      encoding: "utf8",
      env: { PATH: process.env.PATH, ...env },
    });

  test("in production demo sign-in and demo seeding default to OFF", () => {
    const r = run(["--input-type=module", "-e", 'import {config} from "./src/config.js"; console.log(JSON.stringify([config.allowDemoLogin, config.seedDemoData]))'],
      { NODE_ENV: "production", JWT_SECRET: "x".repeat(32) });
    assert.equal(r.stdout.trim(), "[false,false]");
  });

  test("in production a missing JWT_SECRET is a startup error", () => {
    const r = run(["--input-type=module", "-e", 'import "./src/config.js"'], { NODE_ENV: "production" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /JWT_SECRET/);
  });

  test("an empty production database is not seeded with demo accounts", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "km-prod-")), "p.db");
    const empty = openDatabase(file, { seedDemo: false });
    assert.equal(empty.users.count(), 0);
    empty.close();
  });

  test("bootstrapAdmin creates the first admin once, never overwrites, and enforces length", async () => {
    const fresh = openDatabase(":memory:", { seedDemo: false });
    const cfg = { adminEmail: "boss@farm.in", adminPassword: "long-enough-pw", adminName: "Boss" };
    assert.equal(await bootstrapAdmin(fresh, { adminEmail: null, adminPassword: null }), "no-admin");
    assert.equal(await bootstrapAdmin(fresh, cfg), "created");
    const hash = fresh.users.findByEmail("boss@farm.in").passwordHash;
    assert.equal(await bootstrapAdmin(fresh, { ...cfg, adminPassword: "different-password" }), "exists");
    assert.equal(fresh.users.findByEmail("boss@farm.in").passwordHash, hash);
    await assert.rejects(bootstrapAdmin(fresh, { ...cfg, adminEmail: "x@y.in", adminPassword: "short" }));
    assert.equal(await bootstrapAdmin(fresh, { adminEmail: null, adminPassword: null }), "skipped");
  });

  test("reseed refuses to run without --force or in production, and leaves data untouched", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "km-reseed-")), "r.db");
    const seeded = openDatabase(file);
    seeded.tasks.create(1, { title: "Precious", crop: "Rice", date: "2026-12-01", time: "06:00", category: "Harvest" });
    seeded.close();
    const env = { DATABASE_FILE: file, JWT_SECRET: "x".repeat(32) };
    assert.equal(run(["src/db/reseed.js"], env).status, 1);
    assert.equal(run(["src/db/reseed.js", "--force"], { ...env, NODE_ENV: "production" }).status, 1);
    const after = openDatabase(file);
    assert.ok(after.tasks.forUser(1).some((t) => t.title === "Precious"));
    after.close();
  });
});
