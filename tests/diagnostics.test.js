import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.js";
import { databaseFailure } from "../server/database-error.js";

test("database diagnostics distinguish actionable causes without returning error contents", () => {
  const cases = {
    SELF_SIGNED_CERT_IN_CHAIN: "DATABASE_TLS_UNTRUSTED",
    ERR_TLS_CERT_ALTNAME_INVALID: "DATABASE_TLS_HOSTNAME_MISMATCH",
    "28P01": "DATABASE_AUTH_FAILED",
    "42P01": "DATABASE_SCHEMA_MISSING",
    ENOTFOUND: "DATABASE_HOST_NOT_FOUND",
    ENETUNREACH: "DATABASE_UNREACHABLE",
  };
  for (const [code, expected] of Object.entries(cases)) {
    const result = databaseFailure({
      code,
      message: "private-connection-details",
    });
    assert.equal(result.code, expected);
    assert.ok(!JSON.stringify(result).includes("private-connection-details"));
  }
  assert.equal(
    databaseFailure(new Error("private-connection-details")).code,
    "DATABASE_UNAVAILABLE",
  );
});
test("deployed health reports a certificate failure safely and does not claim readiness", async () => {
  const store = {
    kind: "postgres",
    async get() {
      throw Object.assign(new Error("private-connection-details"), {
        code: "SELF_SIGNED_CERT_IN_CHAIN",
      });
    },
  };
  const server = createApp(store, {
    serveStatic: false,
    enableLimits: false,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const result = await fetch(
      "http://127.0.0.1:" + server.address().port + "/api/health",
    );
    assert.equal(result.status, 503);
    const body = await result.json();
    assert.equal(body.status, "unavailable");
    assert.equal(body.code, "DATABASE_TLS_UNTRUSTED");
    assert.ok(!JSON.stringify(body).includes("private-connection-details"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
