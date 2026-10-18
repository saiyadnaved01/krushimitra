# KrushiMitra — Smart Farming Management

A full-stack farming platform: a **React 19 + TypeScript** client (Vite, Tailwind CSS 4, React Router,
TanStack Query, Recharts, i18next) and a **Node.js + Express** REST API backed by **SQLite**, with JWT
authentication and role-based access (farmer / administrator).

## Quick start (development)

Requires **Node.js 22.13+** (the API uses the built-in `node:sqlite`).

```sh
npm install
npm run dev        # API on :4000, client on :5173
```

Open <http://localhost:5173>. In development the demo accounts exist and the sign-in pages show them:

| Role   | Email                       | Password    |
| ------ | --------------------------- | ----------- |
| Farmer | `rajesh.patil@example.com`  | `farmer123` |
| Admin  | `admin@krushimitra.example` | `admin123`  |

## Features

- **12 languages** — English, Hindi, Marathi, Gujarati, Punjabi, Bengali, Tamil, Telugu, Kannada,
  Malayalam, Odia, Assamese. Selector in the top bar, sign-in page and profile; saved on the device and
  on the user's account; numbers, dates, currency and months follow the language via `Intl`.
  See **Translations** for exact coverage.
- **Crop recommendations** — 10 crops ranked for each farm from soil type, soil pH, soil moisture, water
  availability, state, season and observed local temperature/rainfall; every score is explained, and each
  crop has sowing, irrigation, fertilizer and harvest guidance. See **How recommendations work**.
- Fertilizer guidance scaled to the farm area, farming schedule, market prices, notifications, live weather,
  disease-detection screen (sample result), saved crop plans.
- Admin: analytics, farmer management, recommendation records, market prices, CSV reports.

## How recommendations work

Each crop gets a 0–100 match from up to seven factors. A factor without data is **left out, not guessed**;
`confidence` shows how much of the total weight had data.

| Factor      | Weight | Input |
| ----------- | -----: | ----- |
| Soil type   | 25 | profile |
| Temperature | 20 | observed monthly mean over the months the crop would be growing (Open-Meteo history) |
| Water       | 20 | observed rainfall in those months + the farmer's irrigation (rainfed / limited / assured) |
| Soil pH     | 15 | profile (optional) |
| Season      | 10 | is the sowing window open now? |
| Region      |  5 | is it a major crop in the farmer's state? |
| Soil moisture | 5 | profile (optional) |

Ranges, calendars and fertilizer doses live in `server/src/data/crops.js` with their sources
(FAO EcoCrop, FAO water-requirement papers, ICAR / state package-of-practices). Values that vary too much
between states or varieties (e.g. cotton and sugarcane fertilizer, several seed rates) are deliberately
**left empty**, and the UI tells the farmer to follow the state recommendation.

> **Review required.** That file was assembled without live access to the cited sources, so every crop is
> marked `reviewed: false` and the UI carries a "confirm with your local agriculture office / KVK" notice.
> Have an agronomist check it against your state's package of practices before relying on it.
> The soil-suitability ratings and the factor weights are documented rules of thumb, not measured data.

Local climate comes from Open-Meteo (free, no key). If it can't be reached, the climate and water-rainfall
factors are skipped and the response says so.

## Translations

Files: `client/src/i18n/locales/*.json` (English is the source of truth, 592 strings).
Missing strings fall back to English, so nothing breaks.

```sh
npm run i18n:check -w client            # coverage per language; fails on unknown keys / bad placeholders
npm run i18n:check -w client -- --strict   # also fail if any language is incomplete
```

| Language | Coverage |
| -------- | -------- |
| English, Hindi, Marathi | complete |
| Gujarati, Punjabi, Bengali, Tamil, Telugu, Kannada, Malayalam, Odia, Assamese | 184 / 592 (navigation, sign-in, errors, all labels, crop names, page titles, dashboard greeting); the rest shows English |

All translations are machine-assisted drafts and **have not been reviewed by native speakers** —
agricultural wording in particular should be checked before launch. Proper nouns (state names, market
names, farmer-entered text such as task names) are shown as stored.

## Production

```sh
npm run build
JWT_SECRET=<long-random-string> \
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=<long-password> \
NODE_ENV=production npm start
```

Express serves the built client and the API on one port (`PORT`, default 4000). Docker:
`JWT_SECRET=… ADMIN_EMAIL=… ADMIN_PASSWORD=… docker compose up --build` (data in a named volume; runs as a
non-root user with a health check).

Production behaves differently on purpose:

- **No demo data.** An empty database is *not* seeded; demo sign-in is off. Create the first administrator with
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` (created once; an existing account is never modified).
- `JWT_SECRET` is required; tokens are HS256-only and are revoked when a password changes.
- Set `TRUST_PROXY=1` behind a reverse proxy so rate limiting sees real client IPs. Use HTTPS.
- API responses are `no-store`; the API is rate-limited (stricter on sign-in).

All settings: `server/.env.example`.

## Database

SQLite at `server/data/krushimitra.db` (WAL mode, foreign keys with cascading deletes, case-insensitive unique
emails, CHECK constraints). **Existing data is never reset.** Schema changes are versioned, additive
migrations (`PRAGMA user_version`); before the first migration of a database that has data, a copy is
written next to it (`krushimitra.db.pre-v2-backup`). All SQL is in `server/src/db/` — to move to MySQL or
PostgreSQL, re-implement `database.js` and `repositories.js`.

`npm run reseed -w server -- --force` replaces everything with the demo data. It refuses to run in production
or without `--force`, and backs up first. Back up in normal use by copying the `.db` file (stop the server or
use `sqlite3 krushimitra.db ".backup copy.db"`).

## Tests

```sh
npm test            # 60 API tests + i18n completeness check + i18n runtime test
npm run lint:types  # TypeScript check of the client
npm run build       # i18n check + typecheck + production build
```

## API overview

All routes are under `/api`; everything except `/auth/*` and `/health` needs `Authorization: Bearer <token>`.
Errors look like `{ "error": { "code": "invalid_credentials", "message": "…" } }`; the client translates `code`.

| Area    | Endpoints |
| ------- | --------- |
| Auth    | `POST /auth/register` · `/auth/login` · `/auth/change-password` · `GET /auth/me` · (dev) `/auth/demo` |
| Profile | `GET/PUT /profile` · `PATCH /profile/language` |
| Farmer  | `/dashboard` · `/crops` · `/saved-crops` · `/weather` · `/fertilizer/plan` · `/disease/analyze` · `/tasks` |
| Shared  | `/notifications` · `GET /prices` (admin: `POST/PUT/DELETE`) |
| Admin   | `/admin/stats` · `/admin/farmers` · `/admin/records` · `/admin/reports/:type` |

## Still sample data / not built

- **Disease detection** validates and discards the image and shows a fixed, labelled sample result —
  no model or AI service is connected.
- **Market prices** are seeded sample prices that admins can edit; no live mandi feed.
- No "forgot password" by email (admins can reset a farmer's password), no email/SMS alerts.
- The JWT is kept in `localStorage` (simple, but readable by any script on the page). Moving to httpOnly
  cookies needs CSRF protection.
