import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseOptions, postgresSql } from "../server/postgres-store.js";
import { createStore, appBaseUrl } from "../server/database.js";
import { testStore } from "./support/database.js";
import { DatabaseRateLimitStore } from "../server/rate-limit-store.js";

test("deployed API refuses ephemeral SQLite and requires a canonical HTTPS origin", async () => {
  await assert.rejects(
    createStore({ VERCEL: "1", NODE_ENV: "production" }),
    /DATABASE_URL/,
  );
  assert.throws(() => appBaseUrl({ NODE_ENV: "production" }), /HTTPS/);
  assert.equal(
    appBaseUrl({
      NODE_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "skillbridge.vercel.app",
    }),
    "https://skillbridge.vercel.app",
  );
  assert.throws(
    () => appBaseUrl({ APP_BASE_URL: "https://example.com/path" }),
    /origin/,
  );
});
test("remote database connections retain TLS certificate verification even with URL SSL options", () => {
  const options = databaseOptions(
    "postgresql://app:example@project.pooler.supabase.com:6543/postgres?sslmode=disable",
  );
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.ok(!options.connectionString.includes("sslmode"));
  assert.equal(
    databaseOptions("postgresql://app:example@127.0.0.1:5432/test").ssl,
    false,
  );
  assert.equal(
    postgresSql("SELECT * FROM users WHERE email=?"),
    "SELECT * FROM skillbridge.users WHERE email=$1",
  );
});
test("SQL literals are not rewritten as table names or parameters", () => {
  assert.equal(
    postgresSql("SELECT 'evidence?' AS label FROM evidence WHERE title=?"),
    "SELECT 'evidence?' AS label FROM skillbridge.evidence WHERE title=$1",
  );
});
test("rate limits share atomic counters between independent app store instances", async () => {
  const store = await testStore(":memory:");
  try {
    const a = new DatabaseRateLimitStore(store, "auth"),
      b = new DatabaseRateLimitStore(store, "auth");
    a.init({ windowMs: 60000 });
    b.init({ windowMs: 60000 });
    const values = await Promise.all([
      a.increment("judge-ip"),
      b.increment("judge-ip"),
      a.increment("judge-ip"),
    ]);
    assert.deepEqual(values.map((v) => v.totalHits).sort(), [1, 2, 3]);
    await a.resetKey("judge-ip");
    assert.equal((await b.increment("judge-ip")).totalHits, 1);
    const row = await store.get("SELECT key FROM rate_limits LIMIT 1");
    assert.ok(!row.key.includes("judge-ip"));
  } finally {
    if (store.cleanup) await store.cleanup();
    else await store.close();
  }
});

test(
  "Supabase schema and optional demo setup are repeatable without resetting work",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const store = await testStore(":memory:");
    try {
      const { readFile } = await import("node:fs/promises");
      const schema = (
        await readFile(
          new URL("../supabase/schema.sql", import.meta.url),
          "utf8",
        )
      ).replaceAll("skillbridge", store.schema);
      const demo = (
        await readFile(new URL("../supabase/demo.sql", import.meta.url), "utf8")
      ).replace(/\bskillbridge\.(users|tasks)\b/g, `${store.schema}.$1`);
      await store.migrate(demo);
      assert.equal(
        Number((await store.get("SELECT COUNT(*) AS count FROM users")).count),
        3,
      );
      assert.equal(
        Number((await store.get("SELECT COUNT(*) AS count FROM tasks")).count),
        5,
      );
      await store.run(
        "UPDATE tasks SET status='assigned' WHERE id=?",
        "demo-coffee",
      );
      await store.migrate(schema);
      await store.migrate(demo);
      assert.equal(
        (await store.get("SELECT status FROM tasks WHERE id=?", "demo-coffee"))
          .status,
        "assigned",
      );
      assert.equal(
        Number((await store.get("SELECT COUNT(*) AS count FROM users")).count),
        3,
      );
      const security = await store.all(
        "SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=? AND c.relkind='r'",
        store.schema,
      );
      assert.equal(security.length, 10);
      assert.ok(security.every((table) => table.relrowsecurity));
      const grants = await store.all(
        "SELECT acl.privilege_type FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) acl WHERE n.nspname=? AND acl.grantee=0",
        store.schema,
      );
      assert.equal(
        grants.length,
        0,
        "PUBLIC has no privileges on the app schema",
      );
    } finally {
      await store.cleanup();
    }
  },
);
