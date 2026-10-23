import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("accounts, evidence and login sessions survive a full server process restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "skillbridge-restart-"));
  const database = join(directory, "app.sqlite");
  async function launch() {
    const child = spawn(process.execPath, ["server/index.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        APP_BASE_URL: "",
        RENDER_EXTERNAL_URL: "",
        DATABASE_PATH: database,
        PORT: "0",
        SEED_DEMO: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "",
      errors = "";
    child.stderr.on("data", (chunk) => {
      errors += chunk.toString();
    });
    const origin = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Server readiness timeout: " + errors));
      }, 10000);
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
        const match = output.match(/listening on port (\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve("http://127.0.0.1:" + match[1]);
        }
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (!output.match(/listening on port/))
          reject(new Error("Server exited " + code + ": " + errors));
      });
    });
    return {
      origin,
      async stop() {
        child.kill("SIGTERM");
        await once(child, "exit");
      },
    };
  }
  let runtime;
  try {
    runtime = await launch();
    const registration = await fetch(runtime.origin + "/api/auth/register", {
      method: "POST",
      headers: { Origin: runtime.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Restart Test",
        email: "restart@example.com",
        password: "RestartTesting!2026",
        role: "talent",
      }),
    });
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get("set-cookie").split(";")[0];
    const added = await fetch(runtime.origin + "/api/evidence", {
      method: "POST",
      headers: {
        Origin: runtime.origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Customer support experience",
        organisation: "Local business",
        description:
          "I handled customer queries and kept a clear booking register for the owner.",
        skills: ["Customer service"],
        period: "2026",
        workUrl: "",
        publicConsent: false,
      }),
    });
    assert.equal(added.status, 201);
    await runtime.stop();
    runtime = null;
    runtime = await launch();
    const me = await fetch(runtime.origin + "/api/me", {
      headers: { Cookie: cookie },
    });
    assert.equal((await me.json()).user.name, "Restart Test");
    const records = await fetch(runtime.origin + "/api/evidence", {
      headers: { Cookie: cookie },
    });
    assert.equal(
      (await records.json()).evidence[0].title,
      "Customer support experience",
    );
    const health = await fetch(runtime.origin + "/api/health");
    assert.equal(health.status, 200);
  } finally {
    if (runtime) await runtime.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
