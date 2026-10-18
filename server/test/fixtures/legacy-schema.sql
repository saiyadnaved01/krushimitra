
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
