/**
 * Data-access layer. Routes never write SQL — they call these methods, which
 * return plain objects in the shapes the API exposes. To move to MySQL or
 * PostgreSQL, re-implement this file (and the schema in database.js).
 */

import { inferState } from "../lib/geo.js";

const flag = (v) => (v ? 1 : 0);
const like = (s) => `%${String(s).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const toUser = (r) =>
  r && {
    id: r.id,
    role: r.role,
    name: r.name,
    email: r.email,
    passwordHash: r.password_hash,
    phone: r.phone,
    location: r.location,
    land: r.land,
    soil: r.soil,
    status: r.status,
    joined: r.joined,
    prefs: { emailAlerts: !!r.email_alerts, weatherAlerts: !!r.weather_alerts },
    state: r.state ?? null,
    soilPh: r.soil_ph ?? null,
    soilMoisture: r.soil_moisture ?? null,
    waterAvailability: r.water_availability ?? null,
    language: r.language ?? null,
    tokenVersion: r.token_version ?? 0,
    farmStats:
      r.est_yield == null
        ? undefined
        : {
            estimatedYield: r.est_yield,
            yieldChange: r.yield_change,
            estimatedRevenue: r.est_revenue,
            revenueChange: r.revenue_change,
          },
  };

const toTask = (r) =>
  r && {
    id: r.id,
    title: r.title,
    crop: r.crop,
    date: r.date,
    time: r.time,
    category: r.category,
    done: !!r.done,
  };

const toNotification = (r) =>
  r && {
    id: r.id,
    title: r.title,
    text: r.text,
    type: r.type,
    read: !!r.read,
    createdAt: r.created_at,
    key: r.key ?? null,
    params: r.params ? JSON.parse(r.params) : null,
  };

const toPrice = (r) => r && { ...r };

const toRecord = (r) =>
  r && {
    id: r.id,
    userId: r.user_id,
    crop: r.crop,
    date: r.date,
    status: r.status,
    farmer: r.farmer ?? null,
    soil: r.soil ?? null,
  };

const USER_COLUMNS = {
  name: "name",
  email: "email",
  passwordHash: "password_hash",
  phone: "phone",
  location: "location",
  land: "land",
  soil: "soil",
  status: "status",
  joined: "joined",
  state: "state",
  soilPh: "soil_ph",
  soilMoisture: "soil_moisture",
  waterAvailability: "water_availability",
  language: "language",
};

export function createRepositories(sqlite) {
  const q = (sql) => sqlite.prepare(sql);

  const transaction = (fn) => {
    sqlite.exec("BEGIN");
    try {
      const result = fn();
      sqlite.exec("COMMIT");
      return result;
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  };

  /* -------------------------------- users -------------------------------- */
  const users = {
    count: () => q("SELECT COUNT(*) AS n FROM users").get().n,
    hasAdmin: () => Boolean(q("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()),
    findById: (id) => toUser(q("SELECT * FROM users WHERE id = ?").get(id)),
    findByEmail: (email) => toUser(q("SELECT * FROM users WHERE email = ?").get(email)),
    emailTaken: (email, exceptId = 0) =>
      Boolean(q("SELECT 1 FROM users WHERE email = ? AND id <> ?").get(email, exceptId)),

    create(u) {
      const info = q(
        `INSERT INTO users (role, name, email, password_hash, phone, location, land, soil, status, joined,
                            email_alerts, weather_alerts, state, language)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        u.role ?? "farmer",
        u.name,
        u.email,
        u.passwordHash ?? null,
        u.phone ?? "",
        u.location,
        u.land ?? 0,
        u.soil ?? "Loamy",
        u.status ?? "Active",
        u.joined,
        flag(u.prefs?.emailAlerts ?? true),
        flag(u.prefs?.weatherAlerts ?? true),
        u.state ?? null,
        u.language ?? null,
      );
      return users.findById(Number(info.lastInsertRowid));
    },

    /** Partial update. Accepts the keys of USER_COLUMNS plus `prefs`. */
    update(id, patch) {
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(USER_COLUMNS)) {
        if (patch[key] !== undefined) {
          sets.push(`${column} = ?`);
          values.push(patch[key]);
        }
      }
      // Changing the password signs out every other session.
      if (patch.passwordHash !== undefined) sets.push("token_version = token_version + 1");
      if (patch.prefs) {
        sets.push("email_alerts = ?", "weather_alerts = ?");
        values.push(flag(patch.prefs.emailAlerts), flag(patch.prefs.weatherAlerts));
      }
      if (sets.length) q(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
      return users.findById(id);
    },

    listFarmers({ search = "", status = "All statuses" } = {}) {
      const where = ["role = 'farmer'"];
      const params = [];
      if (search) {
        where.push(`(name || ' ' || location || ' ' || email) LIKE ? ESCAPE '\\'`);
        params.push(like(search));
      }
      if (status !== "All statuses") {
        where.push("status = ?");
        params.push(status);
      }
      return q(`SELECT * FROM users WHERE ${where.join(" AND ")} ORDER BY id`)
        .all(...params)
        .map(toUser);
    },

    insertSeed(u) {
      q(
        `INSERT INTO users (id, role, name, email, password_hash, phone, location, land, soil, status, joined,
                            email_alerts, weather_alerts, est_yield, yield_change, est_revenue, revenue_change, state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        u.id, u.role, u.name, u.email, u.passwordHash, u.phone, u.location, u.land, u.soil, u.status, u.joined,
        flag(u.prefs.emailAlerts), flag(u.prefs.weatherAlerts),
        u.farmStats?.estimatedYield ?? null, u.farmStats?.yieldChange ?? null,
        u.farmStats?.estimatedRevenue ?? null, u.farmStats?.revenueChange ?? null,
        inferState(u.location) ?? null,
      );
    },
  };

  /* -------------------------------- tasks -------------------------------- */
  const tasks = {
    forUser: (userId) =>
      q("SELECT * FROM tasks WHERE user_id = ? ORDER BY date, time, id").all(userId).map(toTask),
    openForUser: (userId) =>
      q("SELECT * FROM tasks WHERE user_id = ? AND done = 0 ORDER BY date, time, id")
        .all(userId)
        .map(toTask),
    find: (userId, id) => toTask(q("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(id, userId)),
    create(userId, t) {
      const info = q(
        "INSERT INTO tasks (user_id, title, crop, date, time, category) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(userId, t.title, t.crop, t.date, t.time, t.category);
      return tasks.find(userId, Number(info.lastInsertRowid));
    },
    update(userId, id, patch) {
      const cols = ["title", "crop", "date", "time", "category"].filter((c) => patch[c] !== undefined);
      const sets = cols.map((c) => `${c} = ?`);
      const values = cols.map((c) => patch[c]);
      if (patch.done !== undefined) {
        sets.push("done = ?");
        values.push(flag(patch.done));
      }
      if (sets.length) {
        q(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(...values, id, userId);
      }
      return tasks.find(userId, id);
    },
    remove: (userId, id) =>
      q("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id, userId).changes > 0,
    insertSeed(t) {
      q(
        "INSERT INTO tasks (id, user_id, title, crop, date, time, category, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(t.id, t.userId, t.title, t.crop, t.date, t.time, t.category, flag(t.done));
    },
  };

  /* ---------------------------- notifications ---------------------------- */
  const notifications = {
    forUser: (userId) =>
      q("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC")
        .all(userId)
        .map(toNotification),
    create(userId, n) {
      q(
        "INSERT INTO notifications (user_id, title, text, type, created_at, key, params) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        userId, n.title, n.text, n.type, n.createdAt ?? new Date().toISOString(),
        n.key ?? null, n.params ? JSON.stringify(n.params) : null,
      );
    },
    markRead(userId, id) {
      const info = q("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, userId);
      if (!info.changes) return null;
      return toNotification(q("SELECT * FROM notifications WHERE id = ?").get(id));
    },
    markAllRead: (userId) => q("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId),
    insertSeed(n) {
      q(
        "INSERT INTO notifications (id, user_id, title, text, type, read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(n.id, n.userId, n.title, n.text, n.type, flag(n.read), n.createdAt);
    },
  };

  /* -------------------------------- prices -------------------------------- */
  const prices = {
    all: () => q("SELECT * FROM prices ORDER BY id").all().map(toPrice),
    list({ search = "", market = "All markets" } = {}) {
      const where = [];
      const params = [];
      if (search) {
        where.push(`crop LIKE ? ESCAPE '\\'`);
        params.push(like(search));
      }
      if (market !== "All markets") {
        where.push("market = ?");
        params.push(market);
      }
      return q(`SELECT * FROM prices ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`)
        .all(...params)
        .map(toPrice);
    },
    markets: () => q("SELECT DISTINCT market FROM prices ORDER BY market").all().map((r) => r.market),
    count: () => q("SELECT COUNT(*) AS n FROM prices").get().n,
    find: (id) => toPrice(q("SELECT * FROM prices WHERE id = ?").get(id)),
    create(p) {
      const info = q(
        "INSERT INTO prices (crop, variety, market, price, change, date) VALUES (?, ?, ?, ?, 0, ?)",
      ).run(p.crop, p.variety, p.market, p.price, p.date);
      return prices.find(Number(info.lastInsertRowid));
    },
    update(id, patch) {
      const cols = ["crop", "variety", "market", "price", "change", "date"].filter((c) => patch[c] !== undefined);
      if (cols.length) {
        q(`UPDATE prices SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(
          ...cols.map((c) => patch[c]),
          id,
        );
      }
      return prices.find(id);
    },
    remove: (id) => q("DELETE FROM prices WHERE id = ?").run(id).changes > 0,
    insertSeed(p) {
      q("INSERT INTO prices (id, crop, variety, market, price, change, date) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        p.id, p.crop, p.variety, p.market, p.price, p.change, p.date,
      );
    },
  };

  /* ------------------------------- records ------------------------------- */
  const RECORD_SELECT = `SELECT r.id, r.user_id, r.crop, r.date, r.status, u.name AS farmer, u.soil AS soil
                         FROM records r LEFT JOIN users u ON u.id = r.user_id`;
  const records = {
    all: () => q(`${RECORD_SELECT} ORDER BY r.id`).all().map(toRecord),
    find: (id) => toRecord(q(`${RECORD_SELECT} WHERE r.id = ?`).get(id)),
    create(userId, crop, date) {
      q("INSERT INTO records (user_id, crop, date, status) VALUES (?, ?, ?, 'Pending')").run(userId, crop, date);
    },
    setStatus(id, status) {
      q("UPDATE records SET status = ? WHERE id = ?").run(status, id);
      return records.find(id);
    },
    insertSeed(r) {
      q("INSERT INTO records (id, user_id, crop, date, status) VALUES (?, ?, ?, ?, ?)").run(
        r.id, r.userId, r.crop, r.date, r.status,
      );
    },
  };

  /* ----------------------------- saved crops ----------------------------- */
  const savedCrops = {
    names: (userId) =>
      q("SELECT crop FROM saved_crops WHERE user_id = ? ORDER BY rowid").all(userId).map((r) => r.crop),
    /** Returns true when the crop was newly saved. */
    add: (userId, crop) =>
      q("INSERT OR IGNORE INTO saved_crops (user_id, crop) VALUES (?, ?)").run(userId, crop).changes > 0,
    remove: (userId, crop) =>
      q("DELETE FROM saved_crops WHERE user_id = ? AND crop = ?").run(userId, crop).changes > 0,
  };

  /* -------------------------------- yields -------------------------------- */
  const yields = {
    all: () => q("SELECT user_id AS userId, month, actual, expected FROM yields ORDER BY month").all().map((r) => ({ ...r })),
    forUser: (userId, months) =>
      q(
        `SELECT month, actual, expected FROM
           (SELECT month, actual, expected FROM yields WHERE user_id = ? ORDER BY month DESC LIMIT ?)
         ORDER BY month`,
      )
        .all(userId, months)
        .map((r) => ({ ...r })),
    insertSeed(y) {
      q("INSERT INTO yields (user_id, month, actual, expected) VALUES (?, ?, ?, ?)").run(
        y.userId, y.month, y.actual, y.expected,
      );
    },
  };

  return { transaction, users, tasks, notifications, prices, records, savedCrops, yields };
}
