export async function createStore(environment = process.env) {
  if (environment.DATABASE_URL) {
    const { openPostgresStore } = await import("./postgres-store.js");
    return openPostgresStore(environment.DATABASE_URL, {
      ca: environment.DATABASE_CA_CERT,
      schema: environment.DATABASE_SCHEMA || "skillbridge",
    });
  }
  if (environment.VERCEL || environment.NODE_ENV === "production")
    throw new Error(
      "Set DATABASE_URL to your Supabase transaction-pooler connection URL. Deployed apps must not use local SQLite.",
    );
  const { openStore } = await import("./store.js");
  return openStore(environment.DATABASE_PATH || "./data/skillbridge.sqlite");
}
export function appBaseUrl(environment = process.env) {
  const hostname =
    environment.VERCEL_PROJECT_PRODUCTION_URL || environment.VERCEL_URL;
  const base = (
    environment.APP_BASE_URL || (hostname ? `https://${hostname}` : "")
  ).replace(/\/$/, "");
  if (base) {
    const url = new URL(base);
    if (url.origin !== base || !["http:", "https:"].includes(url.protocol))
      throw new Error(
        "APP_BASE_URL must be an origin without a path or login details.",
      );
  }
  if (
    (environment.NODE_ENV === "production" || environment.VERCEL) &&
    !base.startsWith("https://")
  )
    throw new Error("Set APP_BASE_URL to the public HTTPS app URL.");
  return base;
}
