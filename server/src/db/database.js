import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createRepositories } from "./repositories.js";
import { buildSeed } from "./seed.js";

/**
 * Relational schema (SQLite). Foreign keys cascade so deleting a user removes
 * their tasks, notifications and saved crops. Dates are ISO text (YYYY-MM-DD).
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  role           TEXT NOT NULL CHECK (role IN ('farmer','admin')),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT,
  phone          TEXT NOT NULL DEFAULT '',
  location       TEXT NOT NULL,
  land           REAL NOT NULL DEFAULT 0,
  soil           TEXT NOT NULL DEFAULT 'Loamy' CHECK (soil IN ('Clay','Loamy','Sandy')),
  status         TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  joined         TEXT NOT NULL,
  email_alerts   INTEGER NOT NULL DEFAULT 1,
  weather_alerts INTEGER NOT NULL DEFAULT 1,
  est_yield      REAL,
  yield_change   REAL,
  est_revenue    REAL,
  revenue_change REAL
);

CREATE TABLE IF NOT EXISTS tasks (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title    TEXT NOT NULL,
  crop     TEXT NOT NULL,
  date     TEXT NOT NULL,
  time     TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Irrigation','Fertilizer','Inspection','Harvest')),
  done     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date, time);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  text       TEXT NOT NULL,
  type       TEXT NOT NULL,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS prices (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  crop    TEXT NOT NULL,
  variety TEXT NOT NULL,
  market  TEXT NOT NULL,
  price   INTEGER NOT NULL CHECK (price > 0),
  change  REAL NOT NULL DEFAULT 0,
  date    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop    TEXT NOT NULL,
  date    TEXT NOT NULL,
  status  TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Reviewed'))
);

CREATE TABLE IF NOT EXISTS saved_crops (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop    TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (user_id, crop)
);

CREATE TABLE IF NOT EXISTS yields (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month    TEXT NOT NULL,
  actual   REAL NOT NULL,
  expected REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_yields_user_month ON yields(user_id, month);
`;

const TABLES = ["yields", "saved_crops", "records", "prices", "notifications", "tasks", "users"];

/**
 * Versioned, additive migrations (tracked with PRAGMA user_version). They only ever ADD columns,
 * so existing rows are never modified or removed. Each step checks the current columns first, so
 * re-running a partially applied migration is safe.
 */
const MIGRATIONS = [
  {
    version: 2,
    // Farm profile (state, soil pH/moisture, water), language preference, session revocation,
    // and translatable notifications.
    columns: {
      users: [
        ["state", "TEXT"],
        ["soil_ph", "REAL"],
        ["soil_moisture", "TEXT"],
        ["water_availability", "TEXT"],
        ["language", "TEXT"],
        ["token_version", "INTEGER NOT NULL DEFAULT 0"],
      ],
      notifications: [
        ["key", "TEXT"],
        ["params", "TEXT"],
      ],
    },
  },
];
const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

function hasColumn(sqlite, table, column) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function migrate(sqlite, file) {
  const current = sqlite.prepare("PRAGMA user_version").get().user_version;
  if (current >= LATEST_VERSION) return { from: current, backup: null };

  // An existing database with real data gets a safety copy before its first migration.
  let backup = null;
  const hasData = sqlite.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0;
  if (file !== ":memory:" && hasData) {
    sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    backup = `${file}.pre-v${LATEST_VERSION}-backup`;
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  }

  for (const step of MIGRATIONS.filter((m) => m.version > current)) {
    sqlite.exec("BEGIN");
    try {
      for (const [table, cols] of Object.entries(step.columns)) {
        for (const [name, type] of cols) {
          if (!hasColumn(sqlite, table, name)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
        }
      }
      sqlite.exec(`PRAGMA user_version = ${step.version}`);
      sqlite.exec("COMMIT");
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  }
  return { from: current, backup };
}

/**
 * Open (and if needed create, migrate and seed) the database. Pass ":memory:" for a throwaway one.
 * `seedDemo: false` leaves a brand-new database empty (used in production).
 */
export function openDatabase(file, { seedDemo = true } = {}) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  if (file !== ":memory:") sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec(SCHEMA);
  const migration = migrate(sqlite, file);

  const db = createRepositories(sqlite);
  db.migration = migration;

  db.seed = () => {
    const seed = buildSeed();
    db.transaction(() => {
      seed.users.forEach(db.users.insertSeed);
      seed.prices.forEach(db.prices.insertSeed);
      seed.tasks.forEach(db.tasks.insertSeed);
      seed.notifications.forEach(db.notifications.insertSeed);
      seed.records.forEach(db.records.insertSeed);
      seed.yields.forEach(db.yields.insertSeed);
    });
  };

  /** Wipe everything and re-seed (tests, and `npm run reseed -w server`). */
  db.reset = () => {
    db.transaction(() => {
      for (const t of TABLES) sqlite.exec(`DELETE FROM ${t}`);
      sqlite.exec("DELETE FROM sqlite_sequence");
    });
    db.seed();
  };

  db.close = () => sqlite.close();

  if (seedDemo && db.users.count() === 0) db.seed();
  return db;
}
