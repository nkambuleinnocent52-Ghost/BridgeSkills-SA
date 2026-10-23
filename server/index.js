import { seedDemo } from "./store.js";
import { createStore, appBaseUrl } from "./database.js";
import { createApp } from "./app.js";
const production = process.env.NODE_ENV === "production";
const baseUrl = appBaseUrl();
const store = await createStore();
if (process.env.SEED_DEMO === "true") await seedDemo(store);
const app = createApp(store, { production, baseUrl });
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, "0.0.0.0", async (error) => {
  if (error) {
    console.error(
      `Could not start SkillBridge on port ${port}: ${error.code || error.message}`,
    );
    await store.close();
    process.exit(1);
  }
  console.log(
    `SkillBridge API and app listening on port ${server.address().port}. Database ready.`,
  );
});
function shutdown() {
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
