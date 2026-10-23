import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { openStore } from "../../server/store.js";
import { openPostgresStore } from "../../server/postgres-store.js";
export async function testStore(filename) {
  if (!process.env.TEST_DATABASE_URL) return openStore(filename);
  const schema = "test_" + randomUUID().replaceAll("-", "");
  const store = openPostgresStore(process.env.TEST_DATABASE_URL, { schema });
  await store.migrate(
    (
      await readFile(
        new URL("../../supabase/schema.sql", import.meta.url),
        "utf8",
      )
    ).replaceAll("skillbridge", schema),
  );
  return Object.assign(store, {
    schema,
    async cleanup() {
      await store.migrate(`DROP SCHEMA ${schema} CASCADE`);
      await store.close();
    },
  });
}
export function reopenTestStore(store, filename) {
  return store.kind === "postgres"
    ? openPostgresStore(process.env.TEST_DATABASE_URL, { schema: store.schema })
    : openStore(filename);
}
