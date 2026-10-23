import { createApp } from "../server/app.js";
import { createStore, appBaseUrl } from "../server/database.js";
let application;
export default async function handler(req, res) {
  try {
    if (!application)
      application = (async () => {
        const store = await createStore();
        return createApp(store, {
          production: true,
          baseUrl: appBaseUrl(),
          serveStatic: false,
        });
      })().catch((error) => {
        application = undefined;
        throw error;
      });
    const app = await application;
    // Express async errors are handled inside the app. This entrypoint never opens a listener or writes local data.
    return await new Promise((resolve) => {
      res.once("finish", resolve);
      res.once("close", resolve);
      app(req, res);
    });
  } catch (error) {
    console.error(
      "API initialisation failed:",
      error.code || "configuration_error",
    );
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        error:
          "The app database is not configured yet. The deployment owner must finish setup.",
      }),
    );
  }
}
