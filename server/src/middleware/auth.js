import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "./error.js";

export function signToken(user) {
  // `tv` ties the token to the user's current token version, so a password change signs out old sessions.
  return jwt.sign({ role: user.role, tv: user.tokenVersion ?? 0 }, config.jwtSecret, {
    algorithm: "HS256",
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
  });
}

/** Requires a valid Bearer token and loads the (active) user onto req.user. */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, "Please sign in to continue.", undefined, "unauthorized"));
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    const user = req.app.locals.db.users.findById(Number(payload.sub));
    if (!user || (payload.tv ?? 0) !== user.tokenVersion) {
      return next(new HttpError(401, "Your session is no longer valid.", undefined, "session_expired"));
    }
    if (user.status !== "Active") return next(new HttpError(403, "This account is inactive.", undefined, "inactive"));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, "Your session has expired. Please sign in again.", undefined, "session_expired"));
  }
}

export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, "You don't have access to this resource.", undefined, "forbidden"));
