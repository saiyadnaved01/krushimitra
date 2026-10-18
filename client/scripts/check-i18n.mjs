

/**
 * Translation checker.
 * - Every t("key") used in source exists in en.json.
 * - Every language file only contains keys in English.
 * - {{placeholders}} match the English string.
 * - No empty strings.
 * - Reports translation coverage.
 * - Checks crop data translation keys.
 *
 * Pass --strict to fail when any language is incomplete.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const dir = path.join(root, "src", "i18n", "locales");
const strict = process.argv.includes("--strict");

const CODES = [
  "hi", "mr", "gu", "pa", "bn", "ta",
  "te", "kn", "ml", "or", "as",
];

const flatten = (obj, prefix = "", out = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, `${prefix}${key}.`, out);
    } else {
      out[`${prefix}${key}`] = String(value);
    }
  }

  return out;
};

const load = (code) => {
  const file = path.join(dir, `${code}.json`);

  return fs.existsSync(file)
    ? flatten(JSON.parse(fs.readFileSync(file, "utf8")))
    : null;
};

const placeholders = (value) =>
  [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort()
    .join(",");

const en = load("en");

if (!en) {
  console.error(`English translation file not found: ${path.join(dir, "en.json")}`);
  process.exit(1);
}

let errors = 0;

const fail = (message) => {
  errors += 1;
  console.error(`  ✗ ${message}`);
};

// 1. Find translation keys used in the source.
const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return walk(filePath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [filePath] : [];
  });

const used = new Set();
const families = new Set();

for (const file of walk(path.join(root, "src"))) {
  const source = fs.readFileSync(file, "utf8");

  for (const match of source.matchAll(/\bt\(\s*(["'])([\w.]+)\1/g)) {
    used.add(match[2]);
  }

  for (const match of source.matchAll(/\bt\(\s*`([^`]+)`/g)) {
    const prefix = match[1].split("${")[0];

    if (prefix) {
      families.add(prefix);
    }
  }

  for (const match of source.matchAll(
    /\bt\(\s*[\w.]+\s*\?\s*(["'])([\w.]+)\1\s*:\s*(?:[\w.]+\s*\?\s*(["'])([\w.]+)\3\s*:\s*)?(["'])([\w.]+)\5/g
  )) {
    [match[2], match[4], match[6]]
      .filter(Boolean)
      .forEach((key) => used.add(key));
  }
}

console.log("Source usage");

for (const key of used) {
  if (!(key in en)) {
    fail(`key used in code but missing from en.json: ${key}`);
  }
}

for (const prefix of families) {
  if (!Object.keys(en).some((key) => key.startsWith(prefix))) {
    fail(`no keys under dynamic prefix: ${prefix}`);
  }
}

console.log(
  `  ${used.size} static keys, ${families.size} dynamic families checked`
);

// 1b. Check translation keys referenced by server crop data.
//
// Convert the Windows filesystem path into a valid file:// URL
// before using dynamic import(). This works on Windows and Linux.
const cropsPath = path.resolve(
  root,
  "..",
  "server",
  "src",
  "data",
  "crops.js"
);

if (!fs.existsSync(cropsPath)) {
  fail(`crop data file not found: ${cropsPath}`);
} else {
  try {
    const { CROPS } = await import(pathToFileURL(cropsPath).href);
    const needed = new Set();

    for (const crop of CROPS) {
      needed.add(`crops.names.${crop.key}`);
      needed.add(`irrigation.${crop.irrigation}`);
      needed.add(`harvest.${crop.harvest}`);
      needed.add(`guidance.methods.${crop.sowing.method}`);
      needed.add(`seasons.${crop.season}`);
      needed.add(`waterNeed.${crop.water}`);

      if (crop.sowing.seedRate) {
        needed.add(`units.${crop.sowing.seedRate.unit}`);
      }

      if (crop.fertilizer) {
        needed.add(`fert.timing.${crop.fertilizer.timing}`);

        if (crop.fertilizer.extra) {
          needed.add(`fert.extra.${crop.fertilizer.extra}`);
        }
      }
    }

    for (const key of needed) {
      if (!(key in en)) {
        fail(`crop data references missing key: ${key}`);
      }
    }

    console.log(
      `  ${needed.size} keys referenced by the crop knowledge base checked`
    );
  } catch (error) {
    fail(`could not load crop data: ${error.message}`);
  }
}

// 2. Check each language file.
const total = Object.keys(en).length;

console.log(
  `\nCoverage (English = ${total} strings; missing strings show English)`
);

let incomplete = 0;

for (const code of CODES) {
  const translations = load(code);

  if (!translations) {
    console.log(`  ${code}  —  file missing`);
    incomplete += 1;
    fail(`${code}.json not found`);
    continue;
  }

  let extra = 0;

  for (const [key, value] of Object.entries(translations)) {
    if (!(key in en)) {
      extra += 1;
      fail(`${code}: unknown key ${key}`);
    } else if (!value.trim()) {
      fail(`${code}: empty value for ${key}`);
    } else if (placeholders(value) !== placeholders(en[key])) {
      fail(`${code}: placeholder mismatch in ${key}`);
    }
  }

  const completed = Object.keys(translations).filter(
    (key) => key in en
  ).length;

  if (completed < total) {
    incomplete += 1;
  }

  const percentage = ((completed / total) * 100)
    .toFixed(1)
    .padStart(5);

  console.log(
    `  ${code}  ${percentage}%  (${completed}/${total})${
      extra ? `  ${extra} unknown` : ""
    }`
  );
}

// 3. Final result.
if (errors > 0) {
  console.error(`\n${errors} problem(s) found.`);
  process.exit(1);
}

if (strict && incomplete > 0) {
  console.error(`\n${incomplete} language(s) incomplete (--strict).`);
  process.exit(1);
}

console.log("\ni18n check passed.");
