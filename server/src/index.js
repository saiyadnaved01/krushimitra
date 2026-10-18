import { config } from "./config.js";
import { openDatabase } from "./db/database.js";
import { createApp } from "./app.js";
import { bootstrapAdmin } from "./lib/bootstrap.js";

const db = openDatabase(config.databaseFile, { seedDemo: config.seedDemoData });

if (db.migration.backup) {
  console.log(`Database migrated from v${db.migration.from}. Safety copy saved to ${db.migration.backup}`);
}

try {
  const result = await bootstrapAdmin(db, config);
  if (result === "created") console.log(`Created administrator ${config.adminEmail}`);
  if (result === "no-admin") {
    console.warn("No administrator account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD and restart to create one.");
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = createApp(db);

app.listen(config.port, () => {
  console.log(`KrushiMitra API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databaseFile}`);
  console.log(`Weather provider: ${config.weatherProvider}`);
  if (config.allowDemoLogin) console.log("Demo sign-in is ENABLED (development only).");
});
