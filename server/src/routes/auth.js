import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { HttpError, wrap } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { authenticate, signToken } from "../middleware/auth.js";
import { publicUser, todayISO } from "../lib/helpers.js";
import { LANGUAGES, inferState } from "../lib/geo.js";
import { DEMO_ADMIN_EMAIL, DEMO_FARMER_EMAIL } from "../db/seed.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 30 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many attempts. Please try again in a few minutes." } },
});

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(120);
const password = z.string().min(8, "Password must be at least 8 characters").max(72);

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email,
  password,
  location: z.string().trim().min(2).max(120).optional(),
  language: z.enum(LANGUAGES).optional(),
});
const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72),
  portal: z.enum(["farmer", "admin"]).default("farmer"),
});
const demoSchema = z.object({ role: z.enum(["farmer", "admin"]).default("farmer") });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(72),
  newPassword: password,
});

// Used to keep response time similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const session = (user) => ({ token: signToken(user), user: publicUser(user) });

router.post(
  "/register",
  limiter,
  validate(registerSchema),
  wrap(async (req, res) => {
    const { users, notifications } = req.app.locals.db;
    const { name, email, password, location, language } = req.body;
    if (users.emailTaken(email)) {
      throw new HttpError(409, "An account with this email already exists.", undefined, "email_taken");
    }
    const user = users.create({
      role: "farmer",
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      location: location ?? "India",
      state: inferState(location) ?? null,
      language: language ?? null,
      land: 1,
      joined: todayISO(),
    });
    notifications.create(user.id, {
      key: "welcome",
      title: "Welcome to KrushiMitra",
      text: "Complete your profile with your farm area and soil type to get tailored crop recommendations.",
      type: "System",
    });
    res.status(201).json(session(user));
  }),
);

router.post(
  "/login",
  limiter,
  validate(loginSchema),
  wrap(async (req, res) => {
    const { email, password, portal } = req.body;
    const user = req.app.locals.db.users.findByEmail(email);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok) {
      throw new HttpError(401, "Invalid email or password.", undefined, "invalid_credentials");
    }
    if (user.status !== "Active") throw new HttpError(403, "This account is inactive. Contact support.", undefined, "inactive");
    if (portal === "admin" && user.role !== "admin") {
      throw new HttpError(403, "This account doesn't have administrator access.", undefined, "not_admin");
    }
    if (portal === "farmer" && user.role === "admin") {
      throw new HttpError(403, "Administrators sign in through the Admin Portal.", undefined, "use_admin_portal");
    }
    res.json(session(user));
  }),
);

router.post(
  "/demo",
  limiter,
  validate(demoSchema),
  wrap(async (req, res) => {
    if (!config.allowDemoLogin) throw new HttpError(404, "Route not found", undefined, "not_found");
    const wanted = req.body.role === "admin" ? DEMO_ADMIN_EMAIL : DEMO_FARMER_EMAIL;
    const user = req.app.locals.db.users.findByEmail(wanted);
    if (!user) throw new HttpError(404, "Demo account is not available.", undefined, "not_found");
    res.json(session(user));
  }),
);

router.get("/me", authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

router.post(
  "/change-password",
  authenticate,
  limiter,
  validate(changePasswordSchema),
  wrap(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const ok = await bcrypt.compare(currentPassword, req.user.passwordHash ?? DUMMY_HASH);
    if (!ok) throw new HttpError(400, "Your current password is incorrect.", undefined, "wrong_current_password");
    if (currentPassword === newPassword) {
      throw new HttpError(400, "Choose a new password that's different from the current one.", undefined, "same_password");
    }
    // Updating the password bumps the token version, which signs out every other session.
    const updated = req.app.locals.db.users.update(req.user.id, {
      passwordHash: await bcrypt.hash(newPassword, 10),
    });
    res.json({ ok: true, token: signToken(updated) }); // keep *this* session signed in
  }),
);

export default router;
