import { readFile } from "node:fs/promises";
import { createStore } from "./database.js";
import { seedDemo } from "./store.js";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Set DATABASE_URL securely in .env before running database setup.",
  );
const store = await createStore();
try {
  await store.migrate(
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  if (process.argv.includes("--demo"))
    await store.transaction(() => seedDemo(store));
  console.log(
    "PostgreSQL schema ready." +
      (process.argv.includes("--demo")
        ? " Fictional demo accounts and tasks ready."
        : ""),
  );
} catch (error) {
  console.error(
    "Database setup failed:",
    error.code || "connection_or_setup_error",
  );
  process.exitCode = 1;
} finally {
  await store.close();
}
