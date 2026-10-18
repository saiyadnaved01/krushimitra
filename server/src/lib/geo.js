/** Indian states and union territories (names as used in official publications). */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];

/**
 * Find a state named in free text such as "Pune, Maharashtra". Only exact name matches count —
 * nothing is guessed — so existing profiles keep working without inventing data.
 */
export function inferState(text) {
  const lower = String(text ?? "").toLowerCase();
  // Longest names first so "Dadra and Nagar Haveli and Daman and Diu" wins over shorter matches.
  return [...INDIAN_STATES]
    .sort((a, b) => b.length - a.length)
    .find((s) => lower.includes(s.toLowerCase()));
}

export const LANGUAGES = ["en", "hi", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or", "as"];
