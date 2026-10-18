import bcrypt from "bcryptjs";
import { todayISO } from "./helpers.js";

/**
 * Create the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD if that account doesn't exist.
 * Never modifies an existing account. Returns "created" | "exists" | "skipped" | "no-admin".
 */
export async function bootstrapAdmin(db, { adminEmail, adminPassword, adminName }) {
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
    if (db.users.findByEmail(adminEmail)) return "exists";
    db.users.create({
      role: "admin",
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      location: "Head office",
      joined: todayISO(),
    });
    return "created";
  }
  return db.users.hasAdmin() ? "skipped" : "no-admin";
}
