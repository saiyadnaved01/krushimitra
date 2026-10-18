// Runtime test of the i18n setup: lookup, interpolation, fallback to English for untranslated keys.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import i18next from "i18next";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n", "locales");
const load = (c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), "utf8"));
const CODES = ["en", "hi", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or", "as"];

const i18n = i18next.createInstance();
await i18n.init({
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: Object.fromEntries(CODES.map((c) => [c, { translation: load(c) }])),
});

const en = load("en");
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n += 1; };

for (const code of CODES.slice(1)) {
  const t = i18n.getFixedT(code);
  // translated, and different from English
  ok(t("nav.dashboard") !== en.nav.dashboard, `${code}: nav.dashboard is translated`);
  ok(t("auth.signIn") !== en.auth.signIn, `${code}: auth.signIn is translated`);
  // interpolation substitutes values and leaves no braces behind
  const greet = t("dashboard.greeting.morning", { name: "Asha" });
  ok(greet.includes("Asha") && !greet.includes("{{"), `${code}: greeting interpolates (${greet})`);
  ok(t("crops.matchPercent", { value: 87 }).includes("87"), `${code}: matchPercent interpolates`);
  // never returns a raw key
  ok(!t("crops.names.rice").startsWith("crops."), `${code}: no raw key shown`);
  // an untranslated long string falls back to English instead of breaking
  const long = t("irrigation.rice");
  ok(long.length > 20 && !long.startsWith("irrigation."), `${code}: long text resolves (translated or English fallback)`);
}
// Complete languages translate the long guidance text too
for (const code of ["hi", "mr"]) {
  ok(i18n.getFixedT(code)("irrigation.rice") !== en.irrigation.rice, `${code}: long guidance translated`);
}
// Unknown keys return the key (so they're obvious in review) — and defaultValue works
ok(i18n.t("does.not.exist") === "does.not.exist", "unknown key is visible");
ok(i18n.t("notificationTypes.Custom", { defaultValue: "Custom" }) === "Custom", "defaultValue honoured");
console.log(`i18n runtime: ${n} assertions passed across ${CODES.length - 1} languages`);
