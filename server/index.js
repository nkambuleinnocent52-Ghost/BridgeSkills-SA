import { openStore, seedDemo } from "./store.js";
import { createApp } from "./app.js";
const production = process.env.NODE_ENV === "production";
const baseUrl = (
  process.env.APP_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  ""
).replace(/\/$/, "");
if (baseUrl) {
  const parsed = new URL(baseUrl);
  if (
    parsed.origin !== baseUrl ||
    !["http:", "https:"].includes(parsed.protocol)
  )
    throw new Error(
      "APP_BASE_URL must be an origin without a path, query, or login details.",
    );
}
if (production && (!baseUrl || !baseUrl.startsWith("https://")))
  throw new Error(
    "Set APP_BASE_URL to the public HTTPS app URL in production.",
  );
const store = openStore(
  process.env.DATABASE_PATH || "./data/skillbridge.sqlite",
);
if (process.env.SEED_DEMO === "true") await seedDemo(store);
const app = createApp(store, { production, baseUrl });
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, "0.0.0.0", (error) => {
  if (error) {
    console.error(
      `Could not start SkillBridge on port ${port}: ${error.code || error.message}`,
    );
    store.close();
    process.exit(1);
  }
  console.log(
    `SkillBridge API and app listening on port ${server.address().port}. Database ready.`,
  );
});
function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
