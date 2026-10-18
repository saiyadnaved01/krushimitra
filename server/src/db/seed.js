import bcrypt from "bcryptjs";

export const DEMO_FARMER_EMAIL = "rajesh.patil@example.com";
export const DEMO_ADMIN_EMAIL = "admin@krushimitra.example";
export const DEMO_FARMER_PASSWORD = "farmer123";
export const DEMO_ADMIN_PASSWORD = "admin123";

const prefs = () => ({ emailAlerts: true, weatherAlerts: true });

/** Build the initial dataset. Dates are ISO (YYYY-MM-DD). */
export function buildSeed() {
  const farmer = (id, name, email, location, land, status, joined, soil = "Loamy", extra = {}) => ({
    id,
    role: "farmer",
    name,
    email,
    passwordHash: null, // only the demo farmer below can sign in out of the box
    phone: "9" + String(100000000 + id * 7919).slice(0, 9),
    location,
    land,
    soil,
    status,
    joined,
    prefs: prefs(),
    ...extra,
  });

  const users = [
    farmer(1, "Rajesh Patil", DEMO_FARMER_EMAIL, "Pune, Maharashtra", 12.5, "Active", "2026-06-12", "Clay", {
      phone: "9876543210",
      passwordHash: bcrypt.hashSync(DEMO_FARMER_PASSWORD, 10),
      farmStats: { estimatedYield: 24.8, yieldChange: 12.5, estimatedRevenue: 124500, revenueChange: 8.2 },
    }),
    farmer(2, "Sunita Deshmukh", "sunita.d@example.com", "Nashik, Maharashtra", 8, "Active", "2026-06-18"),
    farmer(3, "Amit Pawar", "amit.p@example.com", "Nagpur, Maharashtra", 16, "Active", "2026-07-02"),
    farmer(4, "Meena Shinde", "meena.s@example.com", "Pune, Maharashtra", 6.2, "Inactive", "2026-07-15", "Sandy"),
    farmer(5, "Vikram Jadhav", "vikram.j@example.com", "Kolhapur, Maharashtra", 10, "Active", "2026-08-04", "Clay"),
    farmer(6, "Pooja Kulkarni", "pooja.k@example.com", "Solapur, Maharashtra", 9.5, "Active", "2026-05-09"),
    farmer(7, "Santosh More", "santosh.m@example.com", "Satara, Maharashtra", 5, "Active", "2026-05-21", "Clay"),
    farmer(8, "Anita Gaikwad", "anita.g@example.com", "Nashik, Maharashtra", 7.4, "Active", "2026-08-19"),
    farmer(9, "Prakash Bhosale", "prakash.b@example.com", "Pune, Maharashtra", 14, "Active", "2026-09-03", "Clay"),
    farmer(10, "Kavita Salunkhe", "kavita.s@example.com", "Kolhapur, Maharashtra", 4.5, "Inactive", "2026-09-11", "Sandy"),
    farmer(11, "Dinesh Thorat", "dinesh.t@example.com", "Nagpur, Maharashtra", 18, "Active", "2026-09-24"),
    farmer(12, "Rekha Jagtap", "rekha.j@example.com", "Solapur, Maharashtra", 11, "Active", "2026-10-02", "Clay"),
    {
      id: 100,
      role: "admin",
      name: "Administrator",
      email: DEMO_ADMIN_EMAIL,
      passwordHash: bcrypt.hashSync(DEMO_ADMIN_PASSWORD, 10),
      phone: "9000000000",
      location: "KrushiMitra HQ",
      land: 0,
      soil: "Loamy",
      status: "Active",
      joined: "2026-05-01",
      prefs: prefs(),
    },
  ];

  const prices = [
    { id: 1, crop: "Rice", variety: "Indrayani", market: "Pune APMC", price: 2450, change: 5.2, date: "2026-10-10" },
    { id: 2, crop: "Wheat", variety: "Lokwan", market: "Pune APMC", price: 2275, change: 2.8, date: "2026-10-10" },
    { id: 3, crop: "Maize", variety: "Yellow", market: "Nashik APMC", price: 1950, change: -1.3, date: "2026-10-10" },
    { id: 4, crop: "Tomato", variety: "Local", market: "Pune APMC", price: 1800, change: 8.5, date: "2026-10-10" },
    { id: 5, crop: "Soybean", variety: "Yellow", market: "Nagpur APMC", price: 4320, change: 3.1, date: "2026-10-10" },
    { id: 6, crop: "Onion", variety: "Red", market: "Nashik APMC", price: 2200, change: -2.2, date: "2026-10-10" },
  ];

  const tasks = [
    { id: 1, userId: 1, title: "Irrigate rice field", crop: "Rice • Field A", date: "2026-10-11", time: "07:00", category: "Irrigation", done: false },
    { id: 2, userId: 1, title: "Apply fertilizer", crop: "Maize • Field B", date: "2026-10-12", time: "08:30", category: "Fertilizer", done: false },
    { id: 3, userId: 1, title: "Check for pests", crop: "Tomato • Field C", date: "2026-10-14", time: "09:00", category: "Inspection", done: false },
  ];

  const notifications = [
    { id: 1, userId: 1, title: "Rain expected on Tuesday", text: "Pune may receive moderate rainfall. Review your irrigation schedule.", type: "Weather", read: false, createdAt: "2026-10-10T06:30:00.000Z" },
    { id: 2, userId: 1, title: "Rice prices are up 5.2%", text: "Indrayani rice is trading at ₹2,450 per quintal at Pune APMC.", type: "Market", read: false, createdAt: "2026-10-10T06:00:00.000Z" },
    { id: 3, userId: 1, title: "Fertilizer application due", text: "Your maize field is scheduled for fertilizer application on 12 October.", type: "Schedule", read: false, createdAt: "2026-10-09T18:00:00.000Z" },
    { id: 4, userId: 1, title: "Your seasonal recommendations are ready", text: "Rice, maize, and tomato are well suited to your farm conditions.", type: "Crops", read: true, createdAt: "2026-10-08T09:00:00.000Z" },
    { id: 5, userId: 100, title: "Welcome to the admin workspace", text: "Manage farmers, market prices and recommendation records from here.", type: "System", read: false, createdAt: "2026-10-10T05:00:00.000Z" },
  ];

  const records = [
    { id: 1, userId: 1, crop: "Rice", date: "2026-10-09", status: "Reviewed" },
    { id: 2, userId: 2, crop: "Maize", date: "2026-10-08", status: "Reviewed" },
    { id: 3, userId: 3, crop: "Tomato", date: "2026-10-07", status: "Reviewed" },
    { id: 4, userId: 4, crop: "Rice", date: "2026-10-06", status: "Pending" },
    { id: 5, userId: 5, crop: "Maize", date: "2026-10-05", status: "Reviewed" },
    { id: 6, userId: 6, crop: "Wheat", date: "2026-09-28", status: "Reviewed" },
    { id: 7, userId: 7, crop: "Rice", date: "2026-09-22", status: "Reviewed" },
    { id: 8, userId: 9, crop: "Tomato", date: "2026-09-15", status: "Reviewed" },
    { id: 9, userId: 11, crop: "Onion", date: "2026-09-30", status: "Pending" },
    { id: 10, userId: 12, crop: "Rice", date: "2026-10-03", status: "Reviewed" },
  ];

  return {
    users,
    tasks,
    notifications,
    prices,
    records,
    // Monthly yield records (quintals) — drives the farmer dashboard chart and admin yield report.
    yields: [
      { userId: 1, month: "2026-05", actual: 8, expected: 10 },
      { userId: 1, month: "2026-06", actual: 12, expected: 14 },
      { userId: 1, month: "2026-07", actual: 11, expected: 16 },
      { userId: 1, month: "2026-08", actual: 19, expected: 18 },
      { userId: 1, month: "2026-09", actual: 17, expected: 21 },
      { userId: 1, month: "2026-10", actual: 25, expected: 24 },
    ],
  };
}
