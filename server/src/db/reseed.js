import fs from "node:fs";
import { config } from "../config.js";
import { openDatabase } from "./database.js";

// DESTRUCTIVE: replaces all data with the demo dataset. Guarded on purpose.
if (config.isProd) {
  console.error("Refusing to reseed when NODE_ENV=production.");
  process.exit(1);
}
if (!process.argv.includes("--force")) {
  console.error(
    `This will ERASE everything in ${config.databaseFile} and restore the demo data.\n` +
      "Re-run with --force to continue:  npm run reseed -w server -- --force",
  );
  process.exit(1);
}

const db = openDatabase(config.databaseFile);
db.close();
if (fs.existsSync(config.databaseFile)) {
  const backup = `${config.databaseFile}.before-reseed-${Date.now()}`;
  fs.copyFileSync(config.databaseFile, backup);
  console.log(`Backup written to ${backup}`);
}
const fresh = openDatabase(config.databaseFile);
fresh.reset();
fresh.close();
console.log(`Database reset to demo data: ${config.databaseFile}`);
