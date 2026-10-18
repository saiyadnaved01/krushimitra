import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
dotenv.config({ path: path.join(serverRoot, ".env") });

const isProd = process.env.NODE_ENV === "production";

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    throw new Error("JWT_SECRET must be set when NODE_ENV=production");
  }
  jwtSecret = crypto.randomBytes(32).toString("hex");
  console.warn("[config] JWT_SECRET not set — using a random secret (sessions reset on restart).");
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  databaseFile: process.env.DATABASE_FILE
    ? path.resolve(process.env.DATABASE_FILE)
    : path.join(serverRoot, "data", "krushimitra.db"),
  // "open-meteo" (live, no API key) or "sample" (offline, deterministic)
  weatherProvider: process.env.WEATHER_PROVIDER ?? "open-meteo",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  clientDist: path.resolve(serverRoot, "..", "client", "dist"),
  // Demo accounts/sign-in are for local development only: both default to OFF in production.
  allowDemoLogin: (process.env.ALLOW_DEMO_LOGIN ?? (isProd ? "false" : "true")) === "true",
  seedDemoData: (process.env.SEED_DEMO_DATA ?? (isProd ? "false" : "true")) === "true",
  // Optional first administrator for an empty production database.
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || null,
  adminPassword: process.env.ADMIN_PASSWORD || null,
  adminName: process.env.ADMIN_NAME?.trim() || "Administrator",
  // Set TRUST_PROXY=1 when running behind a reverse proxy / load balancer (needed for rate limiting).
  trustProxy: process.env.TRUST_PROXY ?? null,
  apiRateLimit: Number(process.env.API_RATE_LIMIT ?? (isProd ? 600 : 5000)),
};
