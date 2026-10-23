import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { testStore } from "./support/database.js";

test(
  "separate serverless instances share accounts, sessions and durable data",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const store = await testStore(":memory:");
    const keys = [
      "DATABASE_URL",
      "DATABASE_SCHEMA",
      "APP_BASE_URL",
      "VERCEL",
      "NODE_ENV",
    ];
    const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    Object.assign(process.env, {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      DATABASE_SCHEMA: store.schema,
      APP_BASE_URL: "https://skillbridge-test.vercel.app",
      VERCEL: "1",
      NODE_ENV: "production",
    });
    const servers = [];
    try {
      async function instance() {
        const { default: handler } = await import(
          `../api/index.js?instance=${randomUUID()}`
        );
        const server = http.createServer(handler);
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        servers.push(server);
        return "http://127.0.0.1:" + server.address().port;
      }
      const first = await instance(),
        second = await instance();
      const headers = {
        Origin: process.env.APP_BASE_URL,
        "Content-Type": "application/json",
      };
      const register = await fetch(first + "/api/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "serverless@example.com",
          password: "ServerlessTesting!2026",
          name: "Serverless Talent",
          role: "talent",
        }),
      });
      assert.equal(register.status, 201);
      assert.match(register.headers.get("set-cookie"), /Secure/);
      const cookie = register.headers.get("set-cookie").split(";")[0];
      const who = await fetch(second + "/api/me", {
        headers: { Cookie: cookie },
      });
      assert.equal((await who.json()).user.name, "Serverless Talent");
      const added = await fetch(second + "/api/evidence", {
        method: "POST",
        headers: { ...headers, Cookie: cookie },
        body: JSON.stringify({
          title: "Customer care at a small shop",
          organisation: "Local shop",
          description:
            "I handled customer questions and kept a clear record of orders for the owner.",
          skills: ["Customer service"],
          period: "2026",
          workUrl: "",
          publicConsent: false,
        }),
      });
      assert.equal(added.status, 201);
      const rows = await fetch(first + "/api/evidence", {
        headers: { Cookie: cookie },
      });
      assert.equal((await rows.json()).evidence.length, 1);
      const health = await fetch(second + "/api/health");
      assert.equal((await health.json()).storage, "postgres");
    } finally {
      for (const server of servers)
        await new Promise((resolve) => server.close(resolve));
      for (const key of keys) {
        if (old[key] === undefined) delete process.env[key];
        else process.env[key] = old[key];
      }
      await store.cleanup();
    }
  },
);
