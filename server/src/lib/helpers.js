import { inferState } from "./geo.js";

export function publicUser(u) {
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, farmStats, tokenVersion, ...rest } = u;
  // Profiles created before the state field existed: use a state named in their location text.
  return { ...rest, state: rest.state ?? inferState(rest.location) ?? null };
}

export const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);

/** "2026-10" for a Date. */
export const monthKey = (d) => d.toISOString().slice(0, 7);

/** The last `n` month keys ending with the current month, oldest first. */
export function lastMonths(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(monthKey(d));
  }
  return out;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const monthShort = (key) => MONTH_NAMES[Number(key.slice(5, 7)) - 1];
export const monthLabel = (key) => `${MONTH_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** Percentage growth of `now` over `before`, rounded to 1 dp; null when there is no baseline. */
export function growth(now, before) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

/** First day of the current month as an ISO date. */
export const startOfMonthISO = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

export const MARKETS = ["Pune APMC", "Nashik APMC", "Nagpur APMC", "Kolhapur APMC", "Solapur APMC"];

/** Farmer record as shown to administrators (no secrets, plus whether they can sign in). */
export function adminFarmerView(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    location: u.location,
    land: u.land,
    soil: u.soil,
    status: u.status,
    joined: u.joined,
    canSignIn: Boolean(u.passwordHash),
  };
}
