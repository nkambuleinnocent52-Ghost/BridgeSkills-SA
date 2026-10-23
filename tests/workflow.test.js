import { testStore, reopenTestStore } from "./support/database.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../server/store.js";
import { createApp } from "../server/app.js";
let store, server, origin, dir;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "skillbridge-test-"));
  store = await testStore(join(dir, "test.sqlite"));
  server = createApp(store, {
    serveStatic: false,
    enableLimits: false,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (store.cleanup) await store.cleanup();
  else await store.close();
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});
function client() {
  let cookie = "";
  return {
    async request(path, method = "GET", body, expected = 200) {
      const res = await fetch(origin + "/api" + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        ...(body
          ? {
              body: JSON.stringify(body),
            }
          : {}),
      });
      if (res.headers.get("set-cookie"))
        cookie = res.headers.get("set-cookie").split(";")[0];
      const json = await res.json();
      assert.equal(
        res.status,
        expected,
        `${method} ${path}: ${JSON.stringify(json)}`,
      );
      return json;
    },
    getCookie: () => cookie,
  };
}
async function register(c, email, role = "talent", name = "Test Talent") {
  return c.request(
    "/auth/register",
    "POST",
    {
      email,
      password: "TestingSecure!2026",
      name,
      role,
    },
    201,
  );
}
const future = () =>
  new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const evidenceInput = {
  title: "Managed the local shop stock records",
  organisation: "Neighbourhood shop",
  description:
    "I captured weekly stock counts, cleaned product records and prepared a weekly stock summary.",
  skills: ["Excel", "Stock capture"],
  period: "January–June 2026",
  workUrl: "https://example.com/stock-sample",
  publicConsent: true,
};
const taskInput = {
  title: "Create a simple stock register",
  description:
    "Create a stock spreadsheet with categories, weekly counts and a simple summary. Deliver an editable spreadsheet.",
  category: "Small-business support",
  skills: ["Excel", "Stock capture"],
  budget: 1200,
  deadline: future(),
};
test("two-account evidence confirmation, revision invalidation, public consent and link revocation", async () => {
  const talent = client(),
    contact = client(),
    stranger = client();
  await register(talent, "passport@example.com");
  await register(contact, "contact@example.com", "business", "Test Supervisor");
  await register(stranger, "stranger@example.com");
  await talent.request("/profile", "PUT", {
    name: "Test Talent",
    headline: "Stock and customer support",
    location: "Pretoria",
    bio: "Building experience.",
    skills: ["Excel", "Stock capture"],
  });
  const { id: eid } = await talent.request(
    "/evidence",
    "POST",
    evidenceInput,
    201,
  );
  await stranger.request("/evidence/" + eid, "PUT", evidenceInput, 404);
  await stranger.request("/evidence/" + eid, "DELETE", null, 404);
  await talent.request(
    "/evidence/" + eid + "/requests",
    "POST",
    {
      email: "passport@example.com",
    },
    400,
  );
  await talent.request(
    "/evidence/" + eid + "/requests",
    "POST",
    {
      email: "missing@example.com",
    },
    404,
  );
  const { id: cid } = await talent.request(
    "/evidence/" + eid + "/requests",
    "POST",
    {
      email: "contact@example.com",
    },
    201,
  );
  await talent.request(
    "/confirmations/" + cid + "/respond",
    "POST",
    {
      action: "confirm",
      relationship: "Supervisor",
      statement: "I directly supervised this work.",
    },
    404,
  );
  await stranger.request(
    "/confirmations/" + cid + "/respond",
    "POST",
    {
      action: "confirm",
      relationship: "Supervisor",
      statement: "I directly supervised this work.",
    },
    404,
  );
  assert.equal(
    (await contact.request("/confirmations")).confirmations.length,
    1,
  );
  await contact.request("/confirmations/" + cid + "/respond", "POST", {
    action: "confirm",
    relationship: "Shop supervisor",
    statement:
      "I observed the weekly stock capture and reviewed the summaries.",
  });
  const ownerPassport = await talent.request("/passport");
  const token = ownerPassport.url.split("/").at(-1);
  await talent.request("/public/passports/" + token, "GET", null, 404);
  await talent.request("/passport/qr", "GET", null, 409);
  await talent.request("/passport/sharing", "PUT", {
    sharePublic: true,
  });
  let pub = await stranger.request("/public/passports/" + token);
  assert.equal(pub.evidence.length, 1);
  assert.equal(pub.evidence[0].confirmations.length, 1);
  assert.equal(
    pub.evidence[0].confirmations[0].confirmer_name,
    "Test Supervisor",
  );
  assert.ok(pub.evidence[0].confirmations[0].responded_at);
  const serialized = JSON.stringify(pub);
  assert.ok(!serialized.includes("contact@example.com"));
  assert.ok(!serialized.includes("password_hash"));
  assert.ok(!serialized.includes("passport_token"));
  assert.match(
    (await talent.request("/passport/qr")).qrDataUrl,
    /^data:image\/png;base64,/,
  );
  await talent.request("/evidence/" + eid + "/visibility", "PUT", {
    publicConsent: false,
  });
  assert.equal(
    (await stranger.request("/public/passports/" + token)).evidence.length,
    0,
  );
  await talent.request("/evidence/" + eid + "/visibility", "PUT", {
    publicConsent: true,
  });
  assert.equal(
    (await stranger.request("/public/passports/" + token)).evidence[0]
      .confirmations.length,
    1,
    "Visibility-only changes preserve confirmations",
  );
  await talent.request("/evidence/" + eid, "PUT", {
    ...evidenceInput,
    title: "Updated stock capture responsibilities",
  });
  pub = await stranger.request("/public/passports/" + token);
  assert.equal(
    pub.evidence[0].confirmations.length,
    0,
    "Editing content invalidates confirmations",
  );
  assert.equal(
    (await contact.request("/confirmations")).confirmations[0].title,
    evidenceInput.title,
    "Previous confirmation keeps its original evidence snapshot",
  );
  const history = (await talent.request("/evidence")).evidence[0].confirmations;
  assert.equal(history[0].status, "superseded");
  const next = await talent.request(
    "/evidence/" + eid + "/requests",
    "POST",
    {
      email: "contact@example.com",
    },
    201,
  );
  await contact.request("/confirmations/" + next.id + "/respond", "POST", {
    action: "confirm",
    relationship: "Shop supervisor",
    statement: "I confirm the updated description of the stock work.",
  });
  await contact.request("/confirmations/" + next.id + "/withdraw", "POST");
  assert.equal(
    (await stranger.request("/public/passports/" + token)).evidence[0]
      .confirmations.length,
    0,
  );
  const report = await stranger.request(
    "/reports",
    "POST",
    {
      targetType: "passport",
      targetId: token,
      reason: "Please review the evidence for a possible incorrect claim.",
    },
    201,
  );
  assert.ok(report.id);
  assert.equal(
    (await store.get("SELECT status FROM reports WHERE id=?", report.id))
      .status,
    "open",
  );
  await talent.request("/passport/rotate", "POST");
  await stranger.request("/public/passports/" + token, "GET", null, 404);
  const rotated = (await talent.request("/passport")).url.split("/").at(-1);
  assert.notEqual(rotated, token);
  await talent.request("/passport/sharing", "PUT", {
    sharePublic: false,
  });
  await stranger.request("/public/passports/" + rotated, "GET", null, 404);
  await talent.request("/evidence/" + eid, "DELETE");
  assert.equal((await talent.request("/evidence")).evidence.length, 0);
});
test("business and talent complete a task with permission checks, change requests and an evidence passport", async () => {
  const business = client(),
    talent = client(),
    otherTalent = client(),
    otherBusiness = client();
  await register(business, "owner@example.com", "business", "Test Business");
  await register(talent, "worker@example.com");
  await register(otherTalent, "other-worker@example.com");
  await register(
    otherBusiness,
    "other-owner@example.com",
    "business",
    "Other Business",
  );
  await talent.request("/profile", "PUT", {
    name: "Test Worker",
    headline: "Stock support",
    location: "Soweto",
    bio: "Practical experience in stock capture.",
    skills: ["Excel", "Stock capture"],
  });
  await talent.request("/tasks", "POST", taskInput, 403);
  await talent.request("/profile", "PUT", {
    name: "Test Worker",
    headline: "Stock support",
    location: "Soweto",
    bio: "Practical stock experience.",
    skills: ["Customer service"],
  });
  await talent.request("/evidence", "POST", evidenceInput, 201);
  const { id: tid } = await business.request("/tasks", "POST", taskInput, 201);
  const recommended = (await talent.request("/tasks")).tasks.find(
    (t) => t.id === tid,
  );
  assert.deepEqual(recommended.matchedSkills, ["Excel", "Stock capture"]);
  assert.match(recommended.matchReason, /Matches your recorded skills/);
  const { id: aid } = await talent.request(
    "/tasks/" + tid + "/applications",
    "POST",
    {
      pitch:
        "I have hands-on experience capturing stock in Excel and can deliver a clear weekly register.",
    },
    201,
  );
  await talent.request(
    "/tasks/" + tid + "/applications",
    "POST",
    {
      pitch: "I have hands-on experience capturing stock in Excel.",
    },
    409,
  );
  const other = await otherTalent.request(
    "/tasks/" + tid + "/applications",
    "POST",
    {
      pitch: "I can create a stock register using a clear spreadsheet layout.",
    },
    201,
  );
  await otherBusiness.request(
    "/applications/" + aid + "/select",
    "POST",
    null,
    404,
  );
  await talent.request("/applications/" + aid + "/select", "POST", null, 403);
  await business.request("/applications/" + aid + "/select", "POST");
  await business.request(
    "/applications/" + other.id + "/select",
    "POST",
    null,
    409,
  );
  assert.equal(
    (await otherTalent.request("/projects")).projects[0].status,
    "not_selected",
  );
  await otherTalent.request(
    "/applications/" + aid + "/submit",
    "POST",
    {
      submission: "I completed the weekly stock register and summary.",
      workUrl: "https://example.com/work",
      publicConsent: true,
    },
    404,
  );
  await talent.request(
    "/applications/" + aid + "/submit",
    "POST",
    {
      submission: "I completed the weekly stock register and summary.",
      workUrl: "javascript:alert(1)",
      publicConsent: true,
    },
    400,
  );
  await talent.request("/applications/" + aid + "/submit", "POST", {
    submission: "I completed the weekly stock register and summary.",
    workUrl: "https://example.com/stock-work",
    publicConsent: true,
  });
  await otherBusiness.request(
    "/applications/" + aid + "/review",
    "POST",
    {
      action: "approve",
      feedback: "This meets the agreed project brief.",
    },
    404,
  );
  await business.request("/applications/" + aid + "/review", "POST", {
    action: "changes",
    feedback: "Please add a weekly totals column and category headings.",
  });
  assert.equal(
    (await talent.request("/projects")).projects[0].status,
    "changes_requested",
  );
  await talent.request("/applications/" + aid + "/submit", "POST", {
    submission: "I added weekly totals and category headings to the register.",
    workUrl: "https://example.com/final-stock-work",
    publicConsent: true,
  });
  await business.request("/applications/" + aid + "/review", "POST", {
    action: "approve",
    feedback:
      "The final register meets our requirements and the summary is clear.",
  });
  await business.request(
    "/applications/" + aid + "/review",
    "POST",
    {
      action: "approve",
      feedback: "Trying to approve the same work a second time.",
    },
    409,
  );
  const completed = (await talent.request("/passport")).completed;
  assert.equal(completed.length, 1);
  assert.equal(completed[0].business_name, "Test Business");
  assert.equal(
    (await talent.request("/projects")).projects[0].events.length,
    6,
  );
  await talent.request("/passport/sharing", "PUT", {
    sharePublic: true,
  });
  const token = (await talent.request("/passport")).url.split("/").at(-1);
  assert.equal(
    (await business.request("/public/passports/" + token)).completed.length,
    1,
  );
  await talent.request("/applications/" + aid + "/visibility", "PUT", {
    publicConsent: false,
  });
  assert.equal(
    (await business.request("/public/passports/" + token)).completed.length,
    0,
  );
  await otherTalent.request(
    "/applications/" + aid + "/visibility",
    "PUT",
    {
      publicConsent: true,
    },
    404,
  );
});
test("authentication, origin protection, input validation, session revocation and durable storage", async () => {
  const c = client();
  await c.request("/projects", "GET", null, 401);
  await c.request(
    "/auth/register",
    "POST",
    {
      name: "Test User",
      role: "talent",
      email: "bad",
      password: "short",
    },
    400,
  );
  const registration = await register(c, "security@example.com");
  assert.equal(registration.user.role, "talent");
  assert.ok(!JSON.stringify(registration).includes("password"));
  const cookie = c.getCookie();
  assert.ok(cookie.startsWith("sb_session="));
  assert.ok(!cookie.includes("security@example.com"));
  const duplicate = client();
  await duplicate.request(
    "/auth/register",
    "POST",
    {
      email: "security@example.com",
      password: "TestingSecure!2026",
      name: "Duplicate Talent",
      role: "talent",
    },
    409,
  );
  const foreign = await fetch(origin + "/api/profile", {
    method: "PUT",
    headers: {
      Origin: "https://evil.example",
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      name: "Attacker",
    }),
  });
  assert.equal(foreign.status, 403);
  const noOrigin = await fetch(origin + "/api/auth/logout", {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(noOrigin.status, 403);
  await c.request(
    "/evidence",
    "POST",
    {
      ...evidenceInput,
      workUrl: "https://user:password@example.com/private",
    },
    400,
  );
  await c.request(
    "/passport/sharing",
    "PUT",
    {
      sharePublic: "true",
    },
    400,
  );
  const otherConnection = reopenTestStore(store, join(dir, "test.sqlite"));
  assert.equal(
    (
      await otherConnection.get(
        "SELECT name FROM users WHERE email=?",
        "security@example.com",
      )
    ).name,
    "Test Talent",
  );
  await otherConnection.close();
  await c.request("/auth/logout", "POST");
  const replay = await fetch(origin + "/api/projects", {
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(replay.status, 401);
  await c.request(
    "/auth/login",
    "POST",
    {
      email: "security@example.com",
      password: "incorrect-password",
    },
    401,
  );
  await c.request("/auth/login", "POST", {
    email: "security@example.com",
    password: "TestingSecure!2026",
  });
  assert.equal((await c.request("/me")).user.name, "Test Talent");
});
test("production sessions use secure cookies and public responses omit private entries", async () => {
  const local = openStore(":memory:");
  const production = createApp(local, {
    production: true,
    baseUrl: "https://skillbridge.example",
    serveStatic: false,
    enableLimits: false,
  }).listen(0, "127.0.0.1");
  await once(production, "listening");
  try {
    const res = await fetch(
      "http://127.0.0.1:" + production.address().port + "/api/auth/register",
      {
        method: "POST",
        headers: {
          Origin: "https://skillbridge.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "production@example.com",
          password: "TestingSecure!2026",
          name: "Production Talent",
          role: "talent",
        }),
      },
    );
    assert.equal(res.status, 201);
    const cookie = res.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.ok(res.headers.get("content-security-policy"));
  } finally {
    await new Promise((resolve) => production.close(resolve));
    await local.close();
  }
});

test("concurrent selection cannot assign two people to the same task", async () => {
  const business = client(),
    one = client(),
    two = client();
  await register(
    business,
    "race-business@example.com",
    "business",
    "Concurrent Business",
  );
  await register(one, "race-one@example.com");
  await register(two, "race-two@example.com");
  const { id: tid } = await business.request(
    "/tasks",
    "POST",
    { ...taskInput, title: "Concurrent selection test task" },
    201,
  );
  const a = await one.request(
    "/tasks/" + tid + "/applications",
    "POST",
    {
      pitch:
        "I can deliver this stock capture task with a clear, useful spreadsheet.",
    },
    201,
  );
  const b = await two.request(
    "/tasks/" + tid + "/applications",
    "POST",
    {
      pitch:
        "I have stock capture experience and can produce this spreadsheet.",
    },
    201,
  );
  const results = await Promise.all(
    [a, b].map((application) =>
      fetch(origin + "/api/applications/" + application.id + "/select", {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: business.getCookie(),
          "Content-Type": "application/json",
        },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const records = (await business.request("/projects")).projects;
  assert.equal(records.filter((r) => r.status === "assigned").length, 1);
  assert.equal(records.filter((r) => r.status === "not_selected").length, 1);
});
