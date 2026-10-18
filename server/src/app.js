import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { authenticate, requireRole } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import { cropsRouter, savedCropsRouter } from "./routes/crops.js";
import weatherRoutes from "./routes/weather.js";
import fertilizerRoutes from "./routes/fertilizer.js";
import diseaseRoutes from "./routes/disease.js";
import priceRoutes from "./routes/prices.js";
import taskRoutes from "./routes/tasks.js";
import notificationRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";

export function createApp(db) {
  const app = express();
  app.locals.db = db;

  app.disable("x-powered-by");
  if (config.trustProxy) {
    app.set("trust proxy", /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
  }
  app.use(
    helmet({
      // The Vite build uses inline styles for charts; keep CSP simple but on.
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:", "blob:"],
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "script-src": ["'self'"],
          "connect-src": ["'self'"],
          "upgrade-insecure-requests": null, // keep plain-http localhost previews working
        },
      },
    }),
  );
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: "100kb" }));

  // API responses contain personal data: never let browsers or proxies cache them.
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.apiRateLimit,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: "too_many_requests", message: "Too many requests. Please slow down." } },
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);

  // Everything below needs a signed-in user.
  const api = express.Router();
  api.use(authenticate);
  api.use("/profile", profileRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/prices", priceRoutes);

  const farmerOnly = requireRole("farmer");
  api.use("/dashboard", farmerOnly, dashboardRoutes);
  api.use("/crops", farmerOnly, cropsRouter);
  api.use("/saved-crops", farmerOnly, savedCropsRouter);
  api.use("/weather", farmerOnly, weatherRoutes);
  api.use("/fertilizer", farmerOnly, fertilizerRoutes);
  api.use("/disease", farmerOnly, diseaseRoutes);
  api.use("/tasks", farmerOnly, taskRoutes);
  api.use("/admin", requireRole("admin"), adminRoutes);
  app.use("/api", api);
  app.use("/api", notFound);

  // In production the Express server also serves the built React app.
  if (fs.existsSync(path.join(config.clientDist, "index.html"))) {
    app.use(express.static(config.clientDist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (_req, res) =>
      res.sendFile(path.join(config.clientDist, "index.html")),
    );
  }

  app.use(errorHandler);
  return app;
}
