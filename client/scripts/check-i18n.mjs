#!/usr/bin/env node
/**
 * Translation checker.
 *   - every t("key") used in the source exists in en.json            (error)
 *   - every language file only contains keys that exist in English    (error)
 *   - {{placeholders}} match the English string exactly               (error)
 *   - no empty strings                                                (error)
 *   - reports coverage per language; missing keys fall back to English at runtime.
 * Pass --strict to also fail when any language is incomplete.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "src", "i18n", "locales");
const strict = process.argv.includes("--strict");
const CODES = ["hi", "mr", "gu", "pa", "bn", "ta", "te", "kn", "ml", "or", "as"];

const flatten = (obj, prefix = "", out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flatten(v, `${prefix}${k}.`, out);
    else out[`${prefix}${k}`] = String(v);
  }
  return out;
};
const load = (code) => {
  const file = path.join(dir, `${code}.json`);
  return fs.existsSync(file) ? flatten(JSON.parse(fs.readFileSync(file, "utf8"))) : null;
};
const placeholders = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");

const en = load("en");
let errors = 0;
const fail = (msg) => {
  errors += 1;
  console.error(`  ✗ ${msg}`);
};

// 1) keys used in source code exist in English (dynamic `t(\`a.${x}\`)` families are checked by prefix)
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
const used = new Set();
const families = new Set();
for (const f of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*(["'])([\w.]+)\1/g)) used.add(m[2]);
  for (const m of src.matchAll(/\bt\(\s*`([^`]+)`/g)) {
    const prefix = m[1].split("${")[0];
    if (prefix) families.add(prefix);
  }
  for (const m of src.matchAll(/\bt\(\s*[\w.]+\s*\?\s*(["'])([\w.]+)\1\s*:\s*(?:[\w.]+\s*\?\s*(["'])([\w.]+)\3\s*:\s*)?(["'])([\w.]+)\5/g))
    [m[2], m[4], m[6]].filter(Boolean).forEach((k) => used.add(k));
}
console.log("Source usage");
for (const k of used) if (!(k in en)) fail(`key used in code but missing from en.json: ${k}`);
for (const p of families) if (!Object.keys(en).some((k) => k.startsWith(p))) fail(`no keys under dynamic prefix: ${p}`);
console.log(`  ${used.size} static keys, ${families.size} dynamic families checked`);

// 1b) every translation key the server's crop data can reference exists in English
const { CROPS } = await import(path.join(root, "..", "server", "src", "data", "crops.js"));
const need = new Set();
for (const c of CROPS) {
  need.add(`crops.names.${c.key}`);
  need.add(`irrigation.${c.irrigation}`);
  need.add(`harvest.${c.harvest}`);
  need.add(`guidance.methods.${c.sowing.method}`);
  need.add(`seasons.${c.season}`);
  need.add(`waterNeed.${c.water}`);
  if (c.sowing.seedRate) need.add(`units.${c.sowing.seedRate.unit}`);
  if (c.fertilizer) {
    need.add(`fert.timing.${c.fertilizer.timing}`);
    if (c.fertilizer.extra) need.add(`fert.extra.${c.fertilizer.extra}`);
  }
}
for (const k of need) if (!(k in en)) fail(`crop data references missing key: ${k}`);
console.log(`  ${need.size} keys referenced by the crop knowledge base checked`);

// 2) each language
const total = Object.keys(en).length;
console.log(`\nCoverage (English = ${total} strings; missing strings show English)`);
let incomplete = 0;
for (const code of CODES) {
  const tr = load(code);
  if (!tr) {
    console.log(`  ${code}  —  file missing`);
    incomplete += 1;
    fail(`${code}.json not found`);
    continue;
  }
  let extra = 0;
  for (const [k, v] of Object.entries(tr)) {
    if (!(k in en)) {
      extra += 1;
      fail(`${code}: unknown key ${k}`);
    } else if (!v.trim()) fail(`${code}: empty value for ${k}`);
    else if (placeholders(v) !== placeholders(en[k])) fail(`${code}: placeholder mismatch in ${k}`);
  }
  const done = Object.keys(tr).filter((k) => k in en).length;
  if (done < total) incomplete += 1;
  const pct = ((done / total) * 100).toFixed(1).padStart(5);
  console.log(`  ${code}  ${pct}%  (${done}/${total})${extra ? `  ${extra} unknown` : ""}`);
}

if (errors) {
  console.error(`\n${errors} problem(s) found.`);
  process.exit(1);
}
if (strict && incomplete) {
  console.error(`\n${incomplete} language(s) incomplete (--strict).`);
  process.exit(1);
}
console.log("\ni18n check passed.");
